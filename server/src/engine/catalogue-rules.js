// Eligibility + dependency rules, read straight from product_catalogue.csv columns.
import { productById } from '../data.js';

export const CONNECTIVITY_MAIN = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'];

export const gstinActive = (profile) => profile.gstinStatus === 'Active';

// Returns hard eligibility failures (not dependency issues).
export function eligibilityFailures(productId, profile) {
  const p = productById[productId];
  if (!p) return [{ code: 'unknown_product' }];
  const fails = [];
  const tier = profile.tier ?? 2;
  if (!p.tiers.includes(tier)) fails.push({ code: 'tier', tier, city: profile.city });
  if ((profile.employees ?? 1) < p.minEmployees) fails.push({ code: 'min_employees', min: p.minEmployees, have: profile.employees ?? 1 });
  if ((profile.sites ?? 1) < p.minSites) fails.push({ code: 'min_sites', min: p.minSites, have: profile.sites ?? 1 });
  if (p.requiresGstin && !gstinActive(profile)) {
    fails.push({ code: 'gstin', status: profile.gstinStatus || (profile.hasGstin === false ? 'none' : 'unverified') });
  }
  return fails;
}

export const isEligible = (id, profile) => eligibilityFailures(id, profile).length === 0;

// Dependency check against the product IDs present in the bundle.
export function dependencyMissing(productId, bundleIds) {
  const p = productById[productId];
  if (!p || !p.requiresOneOf.length) return null;
  return p.requiresOneOf.some((d) => bundleIds.includes(d)) ? null : p.requiresOneOf;
}

const nameOf = (id) => productById[id]?.name || id;

export function failureText(f, lang = 'en') {
  const hi = lang === 'hi';
  switch (f.code) {
    case 'tier':
      return hi ? `${f.city || 'आपके शहर'} में अभी उपलब्ध नहीं (केवल टियर-1 शहरों में)` : `Not yet sold in ${f.city || 'your city'} (tier-${f.tier}); available in tier-1 cities only`;
    case 'min_employees':
      return hi ? `कम से कम ${f.min} कर्मचारियों वाले व्यवसायों के लिए` : `Offered to businesses with ${f.min}+ employees (you have ${f.have})`;
    case 'min_sites':
      return hi ? `कम से कम ${f.min} लोकेशन वाले व्यवसायों के लिए` : `Needs ${f.min}+ locations (you have ${f.have})`;
    case 'gstin':
      if (f.status === 'Cancelled' || f.status === 'Suspended')
        return hi ? `आपका GSTIN ${f.status === 'Cancelled' ? 'रद्द' : 'निलंबित'} है — इसके लिए सक्रिय GSTIN चाहिए` : `Needs an active GSTIN — yours shows as ${f.status.toLowerCase()} in the registry`;
      return hi ? 'इसके लिए सक्रिय GSTIN ज़रूरी है' : 'Needs an active, verified GSTIN';
    case 'dependency':
      return hi ? `इसके साथ ${f.options.map(nameOf).join(' / ')} में से एक ज़रूरी है` : `Works on top of ${f.options.map(nameOf).join(' or ')}`;
    default:
      return hi ? 'उपलब्ध नहीं' : 'Not available';
  }
}
