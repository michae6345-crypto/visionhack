/**
 * The SNAP staple-food stocking standard as arithmetic, and nothing else.
 *
 * This module is the only place the pass/fail question is answered. It holds no
 * copy, no locale, no formatting, no suggestions, and it never touches the
 * vision pipeline: given a list of countable lines it returns what each
 * category has, what it is short of, and whether the standard is met. That is
 * what makes it testable on its own (scripts/standard.test.mjs runs it with no
 * API key and no model output).
 *
 * The thresholds are the published Criterion A figures, cited in
 * docs/regulatory-basis.md. Only USDA determines whether a store is authorised;
 * this is arithmetic against the numbers in the rule.
 *
 * Callers are expected to have applied the per-line rules already (accessory
 * foods zeroed, units floored) — lib/rules/partition.ts does that. Both are
 * re-checked here anyway, because seed data and direct callers do not go
 * through the partition step.
 */
import {
  CATEGORIES,
  MIN_STOCKING_UNITS_PER_VARIETY,
  floorVarietyCount,
  varietyQualifies,
  type Category,
} from "./constants";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------
/**
 * Varieties and perishables are what decide pass/fail. The unit minimums
 * follow from them (7 varieties x 3 units = 21, 4 categories x 21 = 84) and are
 * checked anyway, so the two stay consistent if any one number is corrected.
 */
export const REQUIRED_VARIETIES_PER_CATEGORY = 7;
export const REQUIRED_UNITS_PER_CATEGORY = 21;
export const REQUIRED_TOTAL_UNITS = 84;
export const REQUIRED_PERISHABLE_CATEGORIES = 3;

/** The whole standard in one object, for callers that display the numbers. */
export const STOCKING_STANDARD = {
  varietiesPerCategory: REQUIRED_VARIETIES_PER_CATEGORY,
  unitsPerVariety: MIN_STOCKING_UNITS_PER_VARIETY,
  unitsPerCategory: REQUIRED_UNITS_PER_CATEGORY,
  totalUnits: REQUIRED_TOTAL_UNITS,
  perishableCategories: REQUIRED_PERISHABLE_CATEGORIES,
  categoryCount: CATEGORIES.length,
} as const;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
/**
 * One countable line of stock. `units` is whole sellable units; an accessory
 * food arrives here as 0 units, or not at all.
 */
export interface CountableLine {
  category: Category;
  /** Free text. Lines whose variety normalises to the same key are one variety. */
  variety: string;
  units: number;
  perishable: boolean;
}

/**
 * Two lines belong to the same variety when this agrees. Shared with
 * lib/rules/partition.ts so the scorecard and the route's own variety counts
 * cannot disagree about what "the same variety" means.
 */
export function varietyKey(variety: string): string {
  return variety.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
/** One variety's stock in one category, totalled across its lines. */
export interface VarietyTotal<TLine extends CountableLine = CountableLine> {
  category: Category;
  /** Display form: the first spelling seen, trimmed. */
  variety: string;
  key: string;
  units: number;
  /** Units short of the per-variety minimum. 0 once the variety qualifies. */
  unitsShort: number;
  qualifies: boolean;
  /** True when any line of this variety is perishable. */
  perishable: boolean;
  lines: TLine[];
}

export interface CategoryEvaluation<TLine extends CountableLine = CountableLine> {
  category: Category;
  /** Varieties at or above the per-variety minimum. */
  varietiesCounted: number;
  /** Units belonging to those varieties. Units in a short variety count for nothing. */
  unitsCounted: number;
  hasPerishable: boolean;
  qualifying: VarietyTotal<TLine>[];
  /** Varieties the store already buys but has too few units of. */
  nearMisses: VarietyTotal<TLine>[];
  varietiesShort: number;
  unitsShort: number;
  meets: boolean;
}

/**
 * A requirement the store does not currently meet. This is the machine-readable
 * form the fix optimiser solves against (lib/rules/optimizer.ts).
 */
export type UnmetConstraint =
  | { kind: "category-varieties"; category: Category; required: number; found: number }
  | { kind: "category-units"; category: Category; required: number; found: number }
  | { kind: "total-units"; required: number; found: number }
  | { kind: "perishable-categories"; required: number; found: number };

export interface StandardEvaluation<TLine extends CountableLine = CountableLine> {
  categories: CategoryEvaluation<TLine>[];
  totalUnits: number;
  totalUnitsShort: number;
  /** Categories carrying at least one perishable qualifying variety. */
  perishableCategories: number;
  perishableCategoriesShort: number;
  /** True only when every requirement below is met. */
  meets: boolean;
  unmet: UnmetConstraint[];
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
/** Units a line contributes: whole units only, never negative, never fractional up. */
function lineUnits(line: CountableLine): number {
  return floorVarietyCount(line.units);
}

function groupVarieties<TLine extends CountableLine>(
  category: Category,
  lines: TLine[],
): VarietyTotal<TLine>[] {
  const groups = new Map<string, VarietyTotal<TLine>>();

  for (const line of lines) {
    const key = varietyKey(line.variety);
    // A blank variety cannot be told apart from any other line, so unrelated
    // lines would otherwise total together as one variety. It never counts.
    if (!key) continue;
    const units = lineUnits(line);

    const existing = groups.get(key);
    if (existing) {
      existing.units += units;
      existing.perishable = existing.perishable || line.perishable;
      existing.lines.push(line);
      continue;
    }
    groups.set(key, {
      category,
      variety: line.variety.trim(),
      key,
      units,
      unitsShort: 0,
      qualifies: false,
      perishable: line.perishable,
      lines: [line],
    });
  }

  for (const group of groups.values()) {
    group.qualifies = varietyQualifies(group.units);
    group.unitsShort = Math.max(0, MIN_STOCKING_UNITS_PER_VARIETY - group.units);
  }
  return [...groups.values()];
}

function evaluateCategory<TLine extends CountableLine>(
  category: Category,
  lines: TLine[],
): CategoryEvaluation<TLine> {
  const varieties = groupVarieties(category, lines);
  const qualifying = varieties.filter((v) => v.qualifies);
  // A variety with no units at all is not something the store buys, so it is
  // not a near miss either.
  const nearMisses = varieties.filter((v) => !v.qualifies && v.units > 0);

  // Round down, never up.
  const varietiesCounted = floorVarietyCount(qualifying.length);
  const unitsCounted = qualifying.reduce((sum, v) => sum + v.units, 0);
  const hasPerishable = qualifying.some((v) => v.perishable);

  return {
    category,
    varietiesCounted,
    unitsCounted,
    hasPerishable,
    qualifying,
    nearMisses,
    varietiesShort: Math.max(0, REQUIRED_VARIETIES_PER_CATEGORY - varietiesCounted),
    unitsShort: Math.max(0, REQUIRED_UNITS_PER_CATEGORY - unitsCounted),
    meets:
      varietiesCounted >= REQUIRED_VARIETIES_PER_CATEGORY &&
      unitsCounted >= REQUIRED_UNITS_PER_CATEGORY,
  };
}

/**
 * Score countable lines against the standard.
 *
 * Deterministic and side-effect free: the same lines always give the same
 * answer, and nothing here calls a model, reads the clock, or formats a string.
 */
export function evaluateStandard<TLine extends CountableLine>(
  lines: readonly TLine[],
): StandardEvaluation<TLine> {
  const byCategory = new Map<Category, TLine[]>(CATEGORIES.map((c) => [c, []]));
  for (const line of lines) {
    byCategory.get(line.category)?.push(line);
  }

  const categories = CATEGORIES.map((category) =>
    evaluateCategory(category, byCategory.get(category) ?? []),
  );

  const totalUnits = categories.reduce((sum, c) => sum + c.unitsCounted, 0);
  const perishableCategories = categories.filter((c) => c.hasPerishable).length;

  const unmet: UnmetConstraint[] = [];
  for (const c of categories) {
    if (c.varietiesCounted < REQUIRED_VARIETIES_PER_CATEGORY) {
      unmet.push({
        kind: "category-varieties",
        category: c.category,
        required: REQUIRED_VARIETIES_PER_CATEGORY,
        found: c.varietiesCounted,
      });
    }
    if (c.unitsCounted < REQUIRED_UNITS_PER_CATEGORY) {
      unmet.push({
        kind: "category-units",
        category: c.category,
        required: REQUIRED_UNITS_PER_CATEGORY,
        found: c.unitsCounted,
      });
    }
  }
  if (totalUnits < REQUIRED_TOTAL_UNITS) {
    unmet.push({ kind: "total-units", required: REQUIRED_TOTAL_UNITS, found: totalUnits });
  }
  if (perishableCategories < REQUIRED_PERISHABLE_CATEGORIES) {
    unmet.push({
      kind: "perishable-categories",
      required: REQUIRED_PERISHABLE_CATEGORIES,
      found: perishableCategories,
    });
  }

  return {
    categories,
    totalUnits,
    totalUnitsShort: Math.max(0, REQUIRED_TOTAL_UNITS - totalUnits),
    perishableCategories,
    perishableCategoriesShort: Math.max(
      0,
      REQUIRED_PERISHABLE_CATEGORIES - perishableCategories,
    ),
    meets: unmet.length === 0,
    unmet,
  };
}
