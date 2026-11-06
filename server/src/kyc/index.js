// Smart KYC pipeline: image buffers -> OCR -> classify -> parse -> verify.
// Images are processed in memory only and never written to disk or the database.
import fs from 'fs';
import path from 'path';
import { ocr, classify, parseFields } from './ocr.js';
import { verifyDocuments } from './verify.js';
import { KYC_DIR, leads, gstinRegistry } from '../data.js';
import { repairGstin, validateGstin, lookalikeCandidates } from './gstin.js';

const cache = new Map(); // OCR cache for the bundled specimen files only (keyed by file name).

const TYPE_FROM_NAME = [['gst', 'gst_certificate'], ['udyam', 'udyam_certificate'], ['signatory', 'signatory_id'], ['address', 'address_proof']];
export const hintFromName = (name) => (TYPE_FROM_NAME.find(([k]) => String(name).toLowerCase().includes(k)) || [])[1] || null;

export async function readDocument(buffer, cacheKey, hint) {
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  const started = Date.now();
  const { text, confidence } = await ocr(buffer);
  // If OCR can't tell what the document is (e.g. a blurred photo), trust the slot the owner uploaded it into.
  let type = classify(text);
  if (type === 'unknown' && hint) type = hint;
  const fields = parseFields(type, text);
  const out = { type, fields, confidence, ms: Date.now() - started };
  if (cacheKey) cache.set(cacheKey, out);
  return out;
}

export async function runKyc(files, ctx) {
  const docs = [];
  for (const f of files) {
    const d = await readDocument(f.buffer, f.cacheKey, f.hint || hintFromName(f.name));
    docs.push({ ...d, fileName: f.name });
  }
  // If two files classify the same, keep the later one (a retake).
  const latest = {};
  for (const d of docs) latest[d.type] = d;
  const usable = Object.values(latest).filter((d) => d.type !== 'unknown');
  const result = verifyDocuments(usable, ctx);
  result.documents = docs.map((d) => ({ fileName: d.fileName, type: d.type, confidence: Math.round(d.confidence), fields: maskFields(d.type, d.fields), ms: d.ms }));
  result.unrecognised = docs.filter((d) => d.type === 'unknown').map((d) => d.fileName);
  return result;
}

// Data minimisation: identifiers are masked before anything is sent back or stored.
function maskFields(type, f) {
  const m = { ...f };
  if (m.gstin) m.gstin = m.gstin.slice(0, 4) + '•••••••' + m.gstin.slice(-4);
  if (m.idNumber) m.idNumber = m.idNumber.replace(/\d(?=\d{2})/g, '•');
  if (m.consumerNo) m.consumerNo = m.consumerNo.replace(/\d(?=\d{3})/g, '•');
  return m;
}

export function sampleFiles(id) {
  if (!/^K\d{2}$/.test(id)) return [];
  return fs.readdirSync(KYC_DIR).filter((f) => f.startsWith(id + '_')).sort().map((f) => ({
    name: f,
    cacheKey: f,
    hint: hintFromName(f),
    buffer: fs.readFileSync(path.join(KYC_DIR, f)),
  }));
}

// For demo applicants, find the matching historical lead (by GSTIN) to prefill the applicant.
export async function sampleContext(id) {
  const files = sampleFiles(id);
  const gstFile = files.find((f) => f.name.includes('gst_certificate'));
  const sigFile = files.find((f) => f.name.includes('signatory'));
  let lead = null;
  if (gstFile) {
    const d = await readDocument(gstFile.buffer, gstFile.cacheKey, gstFile.hint);
    let g = d.fields.gstin ? repairGstin(d.fields.gstin).gstin : null;
    if (g && !validateGstin(g).valid) g = lookalikeCandidates(g).find((c) => gstinRegistry.has(c)) || g;
    lead = leads.find((l) => l.gstin === g) || null;
  }
  let business = lead?.business_name;
  if (!lead && sigFile) {
    const s = await readDocument(sigFile.buffer, sigFile.cacheKey, sigFile.hint);
    business = s.fields.business;
    lead = leads.find((l) => l.business_name === business && l.contact_name === s.fields.name)
      || leads.find((l) => l.business_name === business) || null;
  }
  return {
    applicantName: lead?.contact_name || null,
    businessName: lead?.business_name || business || null,
    hasGstin: lead ? lead.has_gstin === 'Y' : true,
    leadId: lead?.lead_id || null,
  };
}
