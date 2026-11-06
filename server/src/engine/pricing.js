// Deterministic quote engine. Every number shown to the customer comes from here.
//
// Pricing rule (documented assumption — the catalogue gives a min-max band per product):
//   24-month term  -> catalogue price_min   (longest commitment gets the floor price)
//   12-month term  -> midpoint of the band, rounded up to the rupee
// Setup fee = catalogue one_time_setup_inr x quantity (matches every activated bundle in smb_leads.csv).
// Products whose min_contract_months is 24 force the bundle to a 24-month term.
import { productById } from '../data.js';
import { eligibilityFailures, dependencyMissing } from './catalogue-rules.js';

export const GST_RATE = 0.18;

export function unitPrice(p, term) {
  return term >= 24 ? p.priceMin : Math.ceil((p.priceMin + p.priceMax) / 2);
}

export function allowedTerms(lines) {
  const needs24 = lines.some((l) => (productById[l.productId]?.minContract || 0) > 12);
  return needs24 ? [24] : [12, 24];
}

export function priceQuote({ lines = [], term = 12 }, profile = {}) {
  const clean = lines
    .filter((l) => productById[l.productId] && Number(l.qty) > 0)
    .map((l) => ({ productId: l.productId, qty: Math.min(Math.max(Math.round(Number(l.qty)), 1), 200) }));

  const terms = allowedTerms(clean);
  const effectiveTerm = terms.includes(Number(term)) ? Number(term) : terms[0];
  const ids = clean.map((l) => l.productId);
  const issues = [];

  const priced = clean.map((l) => {
    const p = productById[l.productId];
    const unit = unitPrice(p, effectiveTerm);
    const fails = eligibilityFailures(l.productId, profile);
    const dep = dependencyMissing(l.productId, ids);
    if (dep) fails.push({ code: 'dependency', options: dep });
    if (fails.length) issues.push({ productId: l.productId, fails });
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      qty: l.qty,
      unitPrice: unit,
      monthly: unit * l.qty,
      setup: p.setupFee * l.qty,
      priceBand: [p.priceMin, p.priceMax],
      installDays: p.installDays,
      ok: fails.length === 0,
    };
  });

  const monthly = priced.reduce((s, l) => s + l.monthly, 0);
  const setup = priced.reduce((s, l) => s + l.setup, 0);
  const alt24 = effectiveTerm === 12 && terms.includes(24)
    ? priced.reduce((s, l) => s + productById[l.productId].priceMin * l.qty, 0)
    : null;

  return {
    term: effectiveTerm,
    allowedTerms: terms,
    lines: priced,
    monthly,
    monthlyGst: Math.round(monthly * GST_RATE),
    monthlyWithGst: Math.round(monthly * (1 + GST_RATE)),
    setup,
    setupWithGst: Math.round(setup * (1 + GST_RATE)),
    firstBill: Math.round((monthly + setup) * (1 + GST_RATE)),
    savingsWith24: alt24 != null ? monthly - alt24 : 0,
    activationDays: priced.length ? Math.max(...priced.map((l) => l.installDays)) : 0,
    issues,
    valid: issues.length === 0 && priced.length > 0,
    pricingRule: '12-month term = midpoint of catalogue price band; 24-month term = catalogue floor price. Prices exclude 18% GST.',
  };
}
