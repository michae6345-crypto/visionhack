/**
 * Single source of truth for site copy that repeats across pages.
 * The non-affiliation line in particular MUST NOT be retyped per page.
 */

export const NON_AFFILIATION =
  "Program names identify what Ledger tracks. Ledger is not affiliated with, endorsed by, or acting on behalf of any agency or program.";

export type ProgramTone = "neutral";

export interface Program {
  abbr: string;
  label: string;
}

/** The ten badges in the programme strip on the landing page. */
export const PROGRAM_STRIP: Program[] = [
  { abbr: "SNAP", label: "Food benefits" },
  { abbr: "WIC", label: "Vendor status" },
  { abbr: "EBT", label: "Benefit payments" },
  { abbr: "EPA", label: "Waste & refrigerant" },
  { abbr: "OSHA", label: "Workplace safety" },
  { abbr: "ABC", label: "Alcohol license" },
  { abbr: "DOT", label: "Hazmat shipping" },
  { abbr: "CHP", label: "Health permit" },
  { abbr: "W&M", label: "Scales" },
  { abbr: "TRL", label: "Tobacco" },
];

export interface Industry {
  slug: string;
  name: string;
  description: string;
  badges: string[];
  /** Long-form page copy. */
  headline: string;
  intro: string;
  /** The things that go wrong for this trade, in plain terms. */
  risks: { title: string; body: string }[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "grocery-convenience",
    name: "Grocery & convenience",
    description: "SNAP and WIC stocking, health permit, tobacco, scales",
    badges: ["SNAP", "WIC", "EBT", "CHP", "TRL", "W&M"],
    headline: "The stocking rule is the one that closes you.",
    intro:
      "A corner store answers to more programmes than a supermarket, with fewer staff to watch them. The stocking minimums behind SNAP and WIC are the ones that fail between renewals without anyone noticing, which is what the order-record scan is for.",
    risks: [
      {
        title: "Stocking minimums drift",
        body: "SNAP wants staple variety and depth in every category. One slow week of produce and you are under, with no letter to warn you.",
      },
      {
        title: "WIC vendor terms are stricter",
        body: "WIC checks specific items at specific prices. Ledger tracks the shelf against your vendor agreement rather than a generic list.",
      },
      {
        title: "Permits stack up",
        body: "Health permit, tobacco license and scales certification all renew on their own dates. They go on one calendar.",
      },
    ],
  },
  {
    slug: "auto-parts",
    name: "Auto parts & service",
    description:
      "Used oil and hazardous waste, refrigerant handling, repair registration",
    badges: ["EPA", "OSHA", "DOT", "BAR", "BTC", "FIRE"],
    headline: "The waste manifest is the paperwork that bites.",
    intro:
      "Parts and service stores carry an environmental and safety load most retailers never touch. Used oil, refrigerant and hazardous waste each have their own filing, and a lapsed registration is the kind of thing you tend to find out about during an inspection.",
    risks: [
      {
        title: "Used oil and hazardous waste",
        body: "EPA and state rules govern storage, hauling and manifests. Ledger tracks the filing dates so a missed manifest doesn't turn into a fine.",
      },
      {
        title: "Refrigerant handling",
        body: "Certification and record-keeping for anyone touching MVAC systems. Expiries land on the calendar.",
      },
      {
        title: "Repair registration",
        body: "State automotive repair registration has posting and renewal terms that are easy to let slide.",
      },
    ],
  },
  {
    slug: "liquor-tobacco",
    name: "Liquor & tobacco",
    description:
      "State license conditions, federal permits, age-verification posting",
    badges: ["ABC", "TTB", "TRL", "BTC", "FIRE"],
    headline: "The license conditions are longer than the license.",
    intro:
      "A liquor or tobacco license comes with conditions that keep applying long after it's granted: posting, hours, age verification, federal permits. Ledger holds those conditions as well as the expiry date.",
    risks: [
      {
        title: "License conditions",
        body: "State alcoholic beverage control attaches operating conditions to the license. Ledger tracks the ones you have to keep meeting.",
      },
      {
        title: "Federal permits",
        body: "TTB permits for certain products carry their own filings on top of the state license.",
      },
      {
        title: "Age-verification posting",
        body: "Required signage and records that inspectors check first. Kept on the calendar with everything else.",
      },
    ],
  },
  {
    slug: "pharmacy-health",
    name: "Pharmacy & health",
    description: "Board of pharmacy, controlled substances, cold chain",
    badges: ["BOP", "FDA", "CHP", "OSHA"],
    headline: "A missed temperature log is a finding.",
    intro:
      "Pharmacies carry heavy record-keeping: board registration, controlled-substance logs and temperature records that have to be complete rather than mostly complete. Ledger tracks the filings around them so the pharmacist can stay at the counter.",
    risks: [
      {
        title: "Board of pharmacy",
        body: "Registration and renewal terms with conditions that keep applying. Ledger holds the dates and the terms.",
      },
      {
        title: "Controlled substances",
        body: "Federal and state record-keeping with no tolerance for gaps. Filing reminders land before the deadline.",
      },
      {
        title: "Cold chain",
        body: "Refrigerated stock has temperature-log requirements. Ledger tracks the certification behind the equipment.",
      },
    ],
  },
  {
    slug: "hardware-garden",
    name: "Hardware & garden",
    description: "Pesticide sales, hazardous storage, fire load, scales",
    badges: ["EPA", "OSHA", "FIRE", "W&M", "BTC"],
    headline: "The fire load is a permit, not a suggestion.",
    intro:
      "Hardware and garden stores stock things most retailers don't, like pesticides, fuels and fertilisers, and each one carries a storage and sales rule. Ledger tracks the permits behind those aisles.",
    risks: [
      {
        title: "Pesticide sales",
        body: "Restricted-use products have licensing and record rules. Ledger tracks the license and its renewal.",
      },
      {
        title: "Hazardous storage & fire load",
        body: "Fire marshal inspections govern how much of what you can keep on site. Inspection dates go on the calendar.",
      },
      {
        title: "Scales",
        body: "Anything sold by weight needs certified scales. Weights-and-measures certification tracked with the rest.",
      },
    ],
  },
];

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

export interface CoverageLevel {
  level: string;
  programs: Program[];
}

export const COVERAGE: CoverageLevel[] = [
  {
    level: "Federal",
    programs: [
      { abbr: "SNAP", label: "SNAP retailer authorization" },
      { abbr: "WIC", label: "WIC vendor authorization" },
      { abbr: "EBT", label: "EBT benefit acceptance" },
      { abbr: "FDA", label: "FDA food facility registration" },
      { abbr: "EPA", label: "Used oil, hazardous waste and refrigerant handling" },
      { abbr: "OSHA", label: "Hazard communication and posting" },
      { abbr: "DOT", label: "Hazardous materials shipping" },
      { abbr: "TTB", label: "Alcohol and tobacco permits" },
    ],
  },
  {
    level: "State",
    programs: [
      { abbr: "ABC", label: "Alcoholic beverage control" },
      { abbr: "W&M", label: "Weights and measures" },
      { abbr: "BAR", label: "Automotive repair registration" },
      { abbr: "TRL", label: "Tobacco retail license" },
      { abbr: "RSP", label: "Seller's permit and resale" },
      { abbr: "BOP", label: "Board of pharmacy" },
    ],
  },
  {
    level: "Local",
    programs: [
      { abbr: "CHP", label: "County health permit" },
      { abbr: "FIRE", label: "Fire marshal inspection" },
      { abbr: "BTC", label: "Business tax certificate" },
      { abbr: "CoO", label: "Certificate of occupancy" },
    ],
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: "I don't sell food. Is this for me?",
    a: "Yes. Auto parts, liquor, pharmacy and hardware stores all carry permit stacks with different renewal dates and different inspectors. Only the order-record scan is specific to food. The permit tracking is not.",
  },
  {
    q: "Are you affiliated with SNAP or the EPA?",
    a: "No. Ledger tracks published programme requirements so you can see where you stand. It is not affiliated with, endorsed by, or acting for any agency, and no authorization decision is ever ours.",
  },
  {
    q: "Does the new USDA stocking rule hit me on 4 November 2026?",
    a: "Only if you are applying for the first time. The final rule (Federal Register 2026-09137, published 8 May 2026) sets 4 November 2026 as the compliance date for new applicants. An already authorized retailer is assessed against it at the next reauthorization, which runs on roughly a five-year cycle. Ledger shows you your own date, not a countdown to someone else's.",
  },
  {
    q: "What does the rule actually ask for?",
    a: "Seven varieties in each of the four staple categories, three stocking units per variety, so 84 units in total, with a perishable variety in at least three of the four categories. Butter and jerky are accessory foods and count for nothing, and so does anything multi-ingredient. Stock on order counts if it arrives inside a 21 day window.",
  },
  {
    q: "What if the photo is blurry?",
    a: "Ledger transcribes only what it can actually read. Anything it cannot make out gets listed as held back with a reason, and never counted. A blurry photo gives you a shorter count rather than a wrong one.",
  },
  {
    q: "Does a case count as one unit?",
    a: "No. A case becomes the number of sellable units inside it, so a 24-pack is 24. If an item is priced by weight there is no unit count to read, so it gets held back for you to confirm.",
  },
  {
    q: "Do I need to integrate my POS?",
    a: "No. Ledger works from a photograph of the paper wholesale order record and the permit details you enter once. Nothing to install at the register.",
  },
];

export interface PricingPlan {
  name: string;
  price: string;
  priceSuffix?: string;
  priceIsText?: boolean;
  for: string;
  featured?: boolean;
  features: string[];
}

export const PRICING: PricingPlan[] = [
  {
    name: "Single store",
    price: "$29",
    priceSuffix: "/month",
    for: "One location, one owner.",
    features: [
      "Unlimited order-record scans",
      "All 18 programmes tracked",
      "Renewal reminders",
      "7 years of scan history",
    ],
  },
  {
    name: "Group",
    price: "$24",
    priceSuffix: "/store/month",
    featured: true,
    for: "Two to ten locations.",
    features: [
      "Everything in Single store",
      "One view across every store",
      "Per-store scorecards",
      "Staff card tracking",
      "CSV export",
    ],
  },
  {
    name: "Chain",
    price: "Talk to us",
    priceIsText: true,
    for: "Eleven locations or more.",
    features: [
      "Everything in Group",
      "Bulk onboarding",
      "Priority support",
      "Custom thresholds",
    ],
  },
];

export const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/coverage", label: "Coverage" },
  { href: "/industries/grocery-convenience", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/demo", label: "Live demo" },
      { href: "/coverage", label: "Coverage" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Industries",
    links: [
      { href: "/industries/grocery-convenience", label: "Grocery & convenience" },
      { href: "/industries/auto-parts", label: "Auto parts & service" },
      { href: "/industries/liquor-tobacco", label: "Liquor & tobacco" },
      { href: "/industries/pharmacy-health", label: "Pharmacy & health" },
      { href: "/industries/hardware-garden", label: "Hardware & garden" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];
