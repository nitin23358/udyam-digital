// OCR with Tesseract.js (runs locally, no document leaves the server) + label-based field parsing.
import path from 'path';
import { createWorker } from 'tesseract.js';
import { DATA_DIR } from '../data.js';

let workerPromise = null;
function worker() {
  workerPromise ||= createWorker('eng', 1, { cachePath: path.join(DATA_DIR, '..', '.tess-cache') });
  return workerPromise;
}
// Serialise OCR jobs on the single worker.
let queue = Promise.resolve();
export function ocr(buffer) {
  const job = queue.then(async () => {
    const w = await worker();
    const { data } = await w.recognize(buffer);
    return { text: data.text, confidence: data.confidence };
  });
  queue = job.catch(() => {});
  return job;
}
export const warmUp = () => worker().catch((e) => console.warn('[ocr] warm-up failed', e.message));

const clean = (s) => (s || '').replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim();

export function classify(text) {
  const t = text.toLowerCase();
  if (/gst registration/.test(t) || /\bgstin\b/.test(t) && /legal name/.test(t)) return 'gst_certificate';
  if (/udyam/.test(t)) return 'udyam_certificate';
  if (/signatory|designation/.test(t)) return 'signatory_id';
  if (/electricity|consumer no|bill date|supply address/.test(t)) return 'address_proof';
  return 'unknown';
}

// Lines like "Label   value". Multi-line values (addresses) continue on the next line.
function lines(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !/SPECIMEN|NOT A VALID|Hackathon|Format for hackathon|Fictional utility/i.test(l));
}

function after(ls, labelRe) {
  const i = ls.findIndex((l) => labelRe.test(l));
  if (i < 0) return null;
  const v = clean(ls[i].replace(labelRe, ''));
  return { value: v, index: i };
}

const dateIn = (s) => (s?.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null;

export function parseFields(type, text) {
  const ls = lines(text);
  const f = {};
  if (type === 'gst_certificate') {
    f.gstin = (after(ls, /^GSTIN\b[:\s]*/i)?.value || '').replace(/\s/g, '').toUpperCase() || null;
    f.legalName = after(ls, /^Leg\w*[;:,]?\s*\w*ame\s*/i)?.value || null;
    f.tradeName = after(ls, /^Trade\s*\w*ame\s*/i)?.value || null;
    f.constitution = after(ls, /^Constitution[,:]?\s*/i)?.value?.replace(/[,.]$/, '') || null;
    const a = after(ls, /^Address of princip\w*\s*/i);
    if (a) {
      const next = ls[a.index + 1] ? ls[a.index + 1].replace(/^place of busin\w*\s*/i, '') : '';
      f.address = joinWrapped(a.value, next);
    }
    f.registrationDate = dateIn(after(ls, /^Date of liab\w*/i)?.value);
  } else if (type === 'udyam_certificate') {
    const n = after(ls, /^Udyam reg\.?\s*number\s*/i)?.value || '';
    f.udyamNumber = (n.match(/UDYAM-?[A-Z]{2}-?\d{2}-?\d{7}/i) || [null])[0]?.toUpperCase() || null;
    f.enterpriseName = after(ls, /^Enterprise name\s*/i)?.value || null;
    f.majorActivity = after(ls, /^Major activity\s*/i)?.value || null;
    f.city = after(ls, /^City\s*/i)?.value || null;
    f.state = after(ls, /^State\s*/i)?.value || null;
    f.registrationDate = dateIn(after(ls, /^Date of registration/i)?.value);
  } else if (type === 'signatory_id') {
    const val = (label) => {
      const i = ls.findIndex((l) => new RegExp(`^${label}$`, 'i').test(l));
      return i >= 0 ? clean(ls[i + 1]) : after(ls, new RegExp(`^${label}\\s+`, 'i'))?.value || null;
    };
    f.name = val('Name');
    f.designation = val('Designation');
    f.business = val('For business');
    f.idNumber = val('ID no\\.?');
    f.validTill = dateIn(val('Valid till'));
  } else if (type === 'address_proof') {
    f.consumerNo = after(ls, /^Consumer no\.?\s*/i)?.value || null;
    f.billedTo = after(ls, /^Billed to\s*/i)?.value || null;
    const a = after(ls, /^Supply address\s*/i);
    if (a) f.address = joinWrapped(a.value, ls[a.index + 1] && !/^Bill date/i.test(ls[a.index + 1]) ? ls[a.index + 1] : '');
    f.billDate = dateIn(after(ls, /^Bill date/i)?.value);
  }
  return f;
}

// The specimens wrap long addresses mid-word ("Maharashtr" / "a - 411231"); rejoin sensibly.
function joinWrapped(first, second) {
  first = clean(first);
  second = clean(second);
  if (!second) return first;
  const glue = (/[A-Za-z]$/.test(first) && /^[a-z]/.test(second)) || (/-\s*\d{1,5}$/.test(first) && /^\d/.test(second)) ? '' : ' ';
  return clean(first + glue + second).replace(/\s*-+\s*(\d{6})/, ' - $1');
}
