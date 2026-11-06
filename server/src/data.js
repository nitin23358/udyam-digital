// Loads the supplied synthetic CSVs once at start-up and builds lookup indexes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');
export const KYC_DIR = path.join(DATA_DIR, 'kyc_documents');

// The dataset README says to use 2026-07-15 as "today" for date-based checks.
export const DATA_TODAY = '2026-07-15';

const read = (f) => parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'), { columns: true, skip_empty_lines: true, trim: true });

const num = (v) => (v === '' || v == null ? null : Number(v));

export const catalogue = read('product_catalogue.csv').map((p) => ({
  id: p.product_id,
  category: p.category,
  name: p.product_name,
  description: p.description,
  unit: p.unit,
  priceMin: num(p.price_min_inr_per_month),
  priceMax: num(p.price_max_inr_per_month),
  setupFee: num(p.one_time_setup_inr),
  minContract: num(p.min_contract_months),
  tiers: p.available_city_tiers.split(';').map(Number),
  minEmployees: num(p.min_employees),
  minSites: num(p.min_sites),
  requiresGstin: p.requires_gstin === 'Y',
  requiresOneOf: p.requires_one_of ? p.requires_one_of.split('|') : [],
  installDays: num(p.typical_install_days),
  segments: p.target_segments.split(';'),
}));
export const productById = Object.fromEntries(catalogue.map((p) => [p.id, p]));

export const gstinRegistry = new Map(read('mock_gstin_registry.csv').map((r) => [r.gstin, r]));
export const udyamRegistry = new Map(read('mock_udyam_registry.csv').map((r) => [r.udyam_number, r]));

export const leads = read('smb_leads.csv').map((r) => ({
  ...r,
  city_tier: Number(r.city_tier),
  employee_count: Number(r.employee_count),
  num_sites: Number(r.num_sites),
  monthly_telecom_spend_inr: num(r.monthly_telecom_spend_inr),
  days_lead_to_activation: num(r.days_lead_to_activation),
  customer_follow_up_calls: num(r.customer_follow_up_calls),
  monthly_bundle_value_inr: num(r.monthly_bundle_value_inr),
  one_time_setup_inr: num(r.one_time_setup_inr),
  contract_months: num(r.contract_months),
  nps_score: num(r.nps_score),
  acquisition_cost_inr: num(r.acquisition_cost_inr),
}));
export const leadById = new Map(leads.map((l) => [l.lead_id, l]));

// City -> tier/state, learned from the leads file (the only source of tiers in the pack).
export const cities = {};
for (const l of leads) cities[l.city] = { city: l.city, tier: l.city_tier, state: l.state };

// Business type -> segment, learned from the leads file.
export const businessTypes = {};
for (const l of leads) businessTypes[l.business_type] = l.segment;

export const SEGMENT_KEY = {
  'Micro retail & services': 'micro',
  'Professional offices': 'prof',
  'Small multi-site businesses': 'multi',
  'Small manufacturers': 'mfg',
};
export const SEGMENT_NAME = Object.fromEntries(Object.entries(SEGMENT_KEY).map(([k, v]) => [v, k]));

// Specimen KYC applicants K01..K12 for the demo picker.
export function sampleApplicants() {
  const files = fs.readdirSync(KYC_DIR).filter((f) => f.endsWith('.png'));
  const by = {};
  for (const f of files) {
    const id = f.slice(0, 3);
    (by[id] ||= []).push(f);
  }
  return Object.entries(by).sort().map(([id, fs_]) => ({ id, files: fs_.sort() }));
}
