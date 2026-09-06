export type ToddFallbackOfferPricingModel = 'one_time' | 'monthly' | 'annual' | 'monthly_or_annual' | 'custom';
export type ToddFallbackOfferSalesCycle = 'same_day' | 'short' | 'medium' | 'long';
export type ToddFallbackOfferDeliveryEffort = 'low' | 'medium' | 'high';
export type ToddFallbackOfferCategory = 'service' | 'product' | 'diagnostic' | 'subscription' | 'enterprise';

export interface ToddFallbackOfferCatalogItem {
  id: string;
  active: boolean;
  name: string;
  category: ToddFallbackOfferCategory;
  pricingModel: ToddFallbackOfferPricingModel;
  priceLabel: string;
  audience: string[];
  painsSolved: string[];
  valueSummary: string;
  salesCycle: ToddFallbackOfferSalesCycle;
  fastestClose: boolean;
  deliveryEffort: ToddFallbackOfferDeliveryEffort;
  cta: string;
  relatedCapabilities: string[];
}

// Static Taliferro fallback catalog for Daily Momentum only when a user's profile
// has no company.products. Public pricing remains owned by pricing.component.ts.
export const toddFallbackOfferCatalog: ToddFallbackOfferCatalogItem[] = [
  {
    id: 'same-day-rescue-fallback-offer',
    active: true,
    name: 'Same-Day Rescue',
    category: 'diagnostic',
    pricingModel: 'one_time',
    priceLabel: '$1,000 one-time',
    audience: ['founders', 'operators', 'small business owners', 'teams under pressure'],
    painsSolved: ['stalled momentum', 'unclear blockers', 'slow decision-making', 'need for fast clarity'],
    valueSummary: 'Fast clarity and a practical recovery plan when momentum has stalled.',
    salesCycle: 'same_day',
    fastestClose: true,
    deliveryEffort: 'low',
    cta: 'Book Same-Day Rescue',
    relatedCapabilities: ['Analysis', 'Momentum Inhibitors', 'Clarity Restoration']
  },
  {
    id: 'outreach-fallback-offer',
    active: true,
    name: 'Outreach',
    category: 'product',
    pricingModel: 'monthly',
    priceLabel: '$19/month',
    audience: ['founders', 'sales operators', 'business development teams'],
    painsSolved: ['inconsistent follow-up', 'weak outreach volume', 'missed opportunities'],
    valueSummary: 'Creates conversation volume through targeted outreach and follow-up.',
    salesCycle: 'short',
    fastestClose: true,
    deliveryEffort: 'medium',
    cta: 'Buy Outreach',
    relatedCapabilities: ['Email Campaigns', 'Social Media', 'Autonomous Mode']
  },
  {
    id: 'network-fallback-offer',
    active: true,
    name: 'Network',
    category: 'product',
    pricingModel: 'monthly',
    priceLabel: '$23/month',
    audience: ['founders', 'relationship-driven teams', 'business development teams'],
    painsSolved: ['thin contact coverage', 'messy data', 'weak lead quality'],
    valueSummary: 'Improves contact quality so outreach has a stronger starting point.',
    salesCycle: 'short',
    fastestClose: true,
    deliveryEffort: 'medium',
    cta: 'Buy Network',
    relatedCapabilities: ['Email Address Validation', 'Data Enrichment', 'Lead Scoring']
  },
  {
    id: 'website-package-fallback-offer',
    active: true,
    name: '5-Page Website Package',
    category: 'service',
    pricingModel: 'one_time',
    priceLabel: '$2,500 one-time',
    audience: ['small business owners', 'founders', 'organizations needing web presence'],
    painsSolved: ['weak online presence', 'no clear web offer', 'outdated website'],
    valueSummary: 'A fixed-scope website offer that gives a business a clear web presence quickly.',
    salesCycle: 'short',
    fastestClose: true,
    deliveryEffort: 'medium',
    cta: 'Book Website Package',
    relatedCapabilities: ['Design', 'Development', 'Testing', 'Hosting']
  }
];
