/**
 * The obligations a Los Angeles corner store answers to, and the SNAP stocking
 * constants the calculator scores against.
 *
 * This is reference data, not user data. Anything the store types lives in
 * lib/store.ts. Keep the two apart so a data-model change never edits facts.
 *
 * The scoring thresholds in SNAP_RULE are re-exported from the rule engine
 * rather than retyped, so the calculator and the scanner can never drift apart.
 * The dates and the non-scoring figures are from the final rule itself
 * (Federal Register 2026-09137, published 8 May 2026).
 */
import {
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
} from "./rule-engine";
import { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY } from "./rules/constants";

export type ObligationKey =
  | "snap"
  | "wic"
  | "healthPermit"
  | "foodHandler"
  | "abc"
  | "tobacco"
  | "scale"
  | "businessTax";

/** A value the store fills in. `date` fields drive the status engine. */
export interface ObligationField {
  key: string;
  label: string;
  type: "date" | "text";
  /** Renewal dates are what expire. Only one per obligation drives status. */
  drivesStatus?: boolean;
  hint?: string;
}

export interface Obligation {
  key: ObligationKey;
  name: string;
  agency: string;
  /** How often it comes back around. */
  cadence: string;
  /** What happens if it lapses. Plain language, no scare figures. */
  penalty: string;
  fields: ObligationField[];
  /** Checklist the store ticks off. Progress shows on the detail page. */
  requirements: string[];
  notes: string;
}

/**
 * SNAP staple-stocking standard, as it actually reads.
 *
 * CAVEAT worth repeating wherever this is shown: existing retailers are
 * assessed at their regular reauthorization, roughly a five-year cycle. They do
 * NOT all face 4 November 2026. Only new applicants face that as a hard date.
 */
export const SNAP_RULE = {
  publishedOn: "2026-05-08",
  federalRegisterNumber: "2026-09137",
  complianceDate: "2026-11-04",
  /** Varieties required in each staple category. */
  varietiesPerCategory: REQUIRED_VARIETIES_PER_CATEGORY,
  /** Stocking units a variety needs before it counts at all. */
  unitsPerVariety: MIN_STOCKING_UNITS_PER_VARIETY,
  /** Stocking units a single category needs. */
  unitsPerCategory: REQUIRED_UNITS_PER_CATEGORY,
  /** 4 categories x 7 varieties x 3 units. */
  totalUnits: REQUIRED_TOTAL_UNITS,
  /** Categories that must carry at least one perishable variety. */
  perishableCategoriesRequired: REQUIRED_PERISHABLE_CATEGORIES,
  categoryCount: CATEGORIES.length,
  /** Days an invoice stays valid as evidence of stock on the shelf. */
  recentOrderWindowDays: 21,
  /** Months a withdrawn retailer must wait before reapplying. */
  reapplyWaitMonths: 6,
} as const;

/** Display labels for the rule engine's categories. Keys come from there. */
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  dairy: "Dairy",
  grains: "Grains",
  protein: "Protein",
  produce: "Fruits and vegetables",
};

export const STAPLE_CATEGORIES = CATEGORIES.map((key) => ({
  key,
  label: CATEGORY_LABELS[key],
}));

export const OBLIGATIONS: Obligation[] = [
  {
    key: "snap",
    name: "SNAP retailer authorization",
    agency: "USDA Food and Nutrition Service",
    cadence: "Reauthorization roughly every 5 years",
    penalty: `Withdrawal from SNAP. A withdrawn store cannot reapply for ${SNAP_RULE.reapplyWaitMonths} months.`,
    fields: [
      { key: "fnsNumber", label: "FNS number", type: "text" },
      {
        key: "reauthorizationDue",
        label: "Next reauthorization",
        type: "date",
        drivesStatus: true,
        hint: "The date FNS reassesses you, not 4 November 2026.",
      },
    ],
    requirements: [
      `Stock ${SNAP_RULE.varietiesPerCategory} varieties in each of the ${SNAP_RULE.categoryCount} staple categories`,
      `Carry at least ${SNAP_RULE.unitsPerVariety} stocking units of every variety you count`,
      `Hold a perishable variety in at least ${SNAP_RULE.perishableCategoriesRequired} of the ${SNAP_RULE.categoryCount} categories`,
      "Keep purchase invoices where you can reach them",
      "Display the SNAP window decal",
    ],
    notes:
      `The staple-stocking standard was published on 8 May 2026 (Federal Register ` +
      `${SNAP_RULE.federalRegisterNumber}) with a compliance date of 4 November 2026. ` +
      `Existing retailers are measured at their regular reauthorization, not on that ` +
      `date. Only new applicants face 4 November as a deadline. Orders received in ` +
      `the last ${SNAP_RULE.recentOrderWindowDays} days count toward stock, which is ` +
      `why an invoice is evidence.`,
  },
  {
    key: "wic",
    name: "WIC vendor status",
    agency: "California Department of Public Health, WIC Division",
    cadence: "Contract renewed every 3 years",
    penalty: "Loss of WIC sales and a bar on reapplying until the next contract cycle.",
    fields: [
      { key: "vendorNumber", label: "Vendor number", type: "text" },
      { key: "contractEnds", label: "Contract ends", type: "date", drivesStatus: true },
    ],
    requirements: [
      "Meet the minimum stock list for every WIC food category",
      "Keep shelf price labels current",
      "Train staff on WIC card transactions",
      "Pass the unannounced monitoring visit",
    ],
    notes:
      "WIC minimum stock is a separate list from the SNAP staple categories. " +
      "Passing one does not pass the other.",
  },
  {
    key: "healthPermit",
    name: "Public health permit",
    agency: "LA County Department of Public Health, Environmental Health",
    cadence: "Annual",
    penalty: "Closure notice. Reopening needs a re-inspection and a fee.",
    fields: [
      { key: "permitNumber", label: "Permit number", type: "text" },
      { key: "expires", label: "Permit expires", type: "date", drivesStatus: true },
      { key: "lastGrade", label: "Last inspection grade", type: "text" },
    ],
    requirements: [
      "Post the current grade card where customers see it",
      "Hold cold food at or below 41F and log it",
      "Keep a certified food safety manager on the payroll",
      "Clear the last inspection's corrections",
    ],
    notes: "The grade card must face the street, not the counter.",
  },
  {
    key: "foodHandler",
    name: "Food handler cards",
    agency: "LA County Department of Public Health",
    cadence: "Per employee, valid 3 years",
    penalty: "Per-employee fine at inspection and a correction notice.",
    fields: [],
    requirements: [
      "Every food handler carries a card within 30 days of hire",
      "Keep copies on site for inspection",
      "Diary each card's expiry before it lands",
    ],
    notes:
      "Tracked per employee on this page rather than as one store-wide date. " +
      "The roster below drives the status.",
  },
  {
    key: "abc",
    name: "Beer and wine license",
    agency: "California Department of Alcoholic Beverage Control",
    cadence: "Annual renewal",
    penalty: "Sales must stop the day it lapses. Late renewal carries a penalty fee.",
    fields: [
      { key: "licenseNumber", label: "License number", type: "text" },
      { key: "licenseType", label: "Type", type: "text", hint: "Type 20 off-sale beer and wine." },
      { key: "renewsOn", label: "Renews on", type: "date", drivesStatus: true },
    ],
    requirements: [
      "Post the license in plain view",
      "Keep the LEAD server training current",
      "Observe posted sale hours",
      "Check ID on every sale under 40",
    ],
    notes: "ABC renewal runs on the license anniversary, not the calendar year.",
  },
  {
    key: "tobacco",
    name: "Tobacco retail license",
    agency: "CDTFA, plus the city tobacco retail permit",
    cadence: "State annual. City permit due 31 December.",
    penalty: "Seizure of stock and suspension of the retail permit.",
    fields: [
      { key: "stateLicense", label: "State license number", type: "text" },
      { key: "cityPermitDue", label: "City permit due", type: "date", drivesStatus: true },
    ],
    requirements: [
      "Hold both the state license and the city permit",
      "Post the no-sale-under-21 sign",
      "Buy only from licensed distributors and keep the invoices",
      "Keep flavoured products off the shelf",
    ],
    notes: "Two separate permits. Stores usually remember the state one and miss the city one.",
  },
  {
    key: "scale",
    name: "Scale registration",
    agency: "LA County Agricultural Commissioner, Weights and Measures",
    cadence: "Annual device registration",
    penalty: "The scale is tagged out of service until it is sealed again.",
    fields: [
      { key: "deviceCount", label: "Registered devices", type: "text" },
      { key: "registrationDue", label: "Registration due", type: "date", drivesStatus: true },
    ],
    requirements: [
      "Register every commercial weighing device",
      "Keep the county seal intact on each scale",
      "Show unit pricing where you sell by weight",
    ],
    notes: "Only applies if you sell anything by weight. Mark it not applicable if you do not.",
  },
  {
    key: "businessTax",
    name: "Business tax registration",
    agency: "City of Los Angeles Office of Finance",
    cadence: "Annual renewal, due 28 February",
    penalty: "Interest and penalties accrue from the due date.",
    fields: [
      { key: "accountNumber", label: "Account number", type: "text" },
      { key: "renewalDue", label: "Renewal due", type: "date", drivesStatus: true },
    ],
    requirements: [
      "File the renewal even in a year with no tax owed",
      "Post the registration certificate",
      "Report gross receipts for the correct classification",
    ],
    notes: "Filing is what keeps the small-business exemption. Skipping it forfeits it.",
  },
];

export const OBLIGATION_BY_KEY: Record<ObligationKey, Obligation> = Object.fromEntries(
  OBLIGATIONS.map((o) => [o.key, o]),
) as Record<ObligationKey, Obligation>;

export function getObligation(key: string): Obligation | undefined {
  return OBLIGATION_BY_KEY[key as ObligationKey];
}

/** The one date field that drives an obligation's status, if it has one. */
export function statusField(o: Obligation): ObligationField | undefined {
  return o.fields.find((f) => f.drivesStatus);
}
