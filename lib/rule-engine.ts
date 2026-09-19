/**
 * Turns the counted items from POST /api/scan into the ScanResult scorecard the
 * UI renders, in English or Spanish.
 *
 * This file is presentation. The arithmetic that decides pass or fail lives in
 * lib/rules/standard.ts, and the fix list is solved in lib/rules/optimizer.ts;
 * both are pure and unit-tested on their own with no model in the loop. What is
 * left here is mapping scan items onto countable lines, attaching labels, and
 * writing the fix sentences.
 *
 * Per-item rules (accessory foods, minimum units per variety, rounding) come
 * from lib/rules/constants.ts rather than being reimplemented, so the scorecard
 * cannot disagree with the `varietyCounts` the route returns next to it. When
 * unsure, undercount.
 */
import type { CategoryStatus, ScanResult } from "./mock-data";
import {
  CATEGORIES,
  MIN_STOCKING_UNITS_PER_VARIETY,
  categoryForKnownFood,
  computePerishable,
  floorVarietyCount,
  isAccessoryFood,
  isPeanutButter,
  type Category,
} from "./rules/constants";
import {
  planFixes,
  type CatalogItem,
  type FixPlan,
  type OptimizeOptions,
} from "./rules/optimizer";
import {
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
  evaluateStandard,
  varietyKey,
  type CountableLine,
  type UnmetConstraint,
} from "./rules/standard";
import { SCORECARD_COPY, SUGGESTIONS, type Locale } from "./scorecard-copy";
import type { ScanItem } from "./types";

type CountedItem = CategoryStatus["items"][number];
type Fix = ScanResult["fixes"][number];

/**
 * Thresholds are defined in lib/rules/standard.ts and re-exported here because
 * lib/compliance.ts, lib/ui-copy.ts and the static fallback checker all read
 * them from this module.
 */
export {
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
};

/**
 * `scanDate` is the calendar date here, not on the server. Vercel runs in UTC,
 * so an evening scan in Los Angeles would otherwise show tomorrow's date.
 */
export const SCAN_DATE_TIME_ZONE = "America/Los_Angeles";

/** A countable line that still knows which invoice line it came from. */
interface ScoredLine extends CountableLine {
  name: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
/**
 * Whole stocking units an item contributes. partitionClassifiedItems already
 * applies these rules; they are re-checked because seed data and direct callers
 * may not go through it.
 */
function countableUnits(item: ScanItem): number {
  // RULE 1 — accessory foods count for nothing.
  const peanutButter = isPeanutButter(item.variety, item.description);
  if (!peanutButter && (item.accessory || isAccessoryFood(item.variety, item.description))) {
    return 0;
  }
  // RULE 4 — round down, never up.
  return floorVarietyCount(item.stockingUnits);
}

/** Scan items as countable lines, dropping everything that counts for nothing. */
function toScoredLines(items: readonly ScanItem[]): ScoredLine[] {
  const lines: ScoredLine[] = [];
  for (const item of items) {
    const units = countableUnits(item);
    // A blank variety cannot be told apart from other lines, so it never counts.
    if (units === 0 || !varietyKey(item.variety)) continue;
    lines.push({
      name: item.description,
      category: categoryForKnownFood(item.category, item.variety, item.description),
      variety: item.variety.trim(),
      units,
      perishable: computePerishable(item.storage),
    });
  }
  return lines;
}

function toCountedItem(line: ScoredLine): CountedItem {
  return {
    name: line.name,
    variety: line.variety,
    units: line.units,
    perishable: line.perishable,
  };
}

/**
 * Builds the scorecard from `ScanSuccess.items`. Never pass `excluded` lines:
 * they were dropped precisely because they must not count.
 *
 * `now` is injectable for tests. `locale` only changes labels and fix text; the
 * numbers, items and fix order are the same in every language.
 */
export function buildScanResult(
  items: ScanItem[],
  storeName: string,
  now: Date = new Date(),
  locale: Locale = "en",
  options: OptimizeOptions = {},
): ScanResult {
  const lines = toScoredLines(items);
  const evaluation = evaluateStandard(lines);
  const copy = SCORECARD_COPY[locale];

  const categories: CategoryStatus[] = evaluation.categories.map((category) => ({
    category: category.category,
    label: copy.categoryLabels[category.category],
    varietiesFound: category.varietiesCounted,
    unitsFound: category.unitsCounted,
    hasPerishable: category.hasPerishable,
    items: category.qualifying.flatMap((variety) => variety.lines.map(toCountedItem)),
  }));

  const plan = planFixes(lines, catalogFrom(SUGGESTIONS), options);

  return {
    storeName,
    scanDate: formatDate(now),
    overallStatus: evaluation.meets ? "pass" : "fail",
    totalUnits: evaluation.totalUnits,
    perishableCategoriesMet: evaluation.perishableCategories,
    categories,
    fixes: renderFixes(plan, evaluation, lines, locale),
    fixPlan: {
      totalAddedUnits: plan.totalAddedUnits,
      totalCost: plan.totalCost,
      objective: plan.objective,
      sufficient: plan.sufficient,
    },
  };
}

/** YYYY-MM-DD in SCAN_DATE_TIME_ZONE. Built from parts so no locale's date format can leak in. */
function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCAN_DATE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// ---------------------------------------------------------------------------
// Fix list
// ---------------------------------------------------------------------------
function catalogFrom(suggestions: typeof SUGGESTIONS): CatalogItem[] {
  return CATEGORIES.flatMap((category) =>
    suggestions[category].map((suggestion) => ({
      category,
      variety: suggestion.variety,
      perishable: suggestion.perishable,
    })),
  );
}

/**
 * Writes one sentence per action in the plan. The plan decides what to buy and
 * which requirement each purchase clears; this only puts it into words.
 */
function renderFixes(
  plan: FixPlan,
  evaluation: ReturnType<typeof evaluateStandard<ScoredLine>>,
  lines: readonly ScoredLine[],
  locale: Locale,
): Fix[] {
  const copy = SCORECARD_COPY[locale];
  const suggestionText = new Map<string, (typeof SUGGESTIONS)[Category][number]>(
    CATEGORIES.flatMap((category) =>
      SUGGESTIONS[category].map(
        (suggestion) =>
          [`${category}:${varietyKey(suggestion.variety)}`, suggestion] as [
            string,
            (typeof SUGGESTIONS)[Category][number],
          ],
      ),
    ),
  );
  // A top-up names the line the store already buys, preferring a perishable one
  // when the same variety arrives both ways.
  const lineNames = new Map<string, string>();
  for (const line of lines) {
    const key = `${line.category}:${varietyKey(line.variety)}`;
    if (!lineNames.has(key) || line.perishable) lineNames.set(key, line.name);
  }

  const varieties = new Map(
    evaluation.categories.map((c) => [c.category, c.varietiesCounted] as const),
  );
  const shortOnVarieties = new Set(
    evaluation.categories.filter((c) => c.varietiesShort > 0).map((c) => c.category),
  );
  const shortOnUnits = new Set(
    evaluation.categories.filter((c) => c.unitsShort > 0).map((c) => c.category),
  );
  const perishableCategories = new Set(
    evaluation.categories.filter((c) => c.hasPerishable).map((c) => c.category),
  );

  return plan.actions.map((action) => {
    const { category } = action;
    const key = `${category}:${action.key}`;
    const suppliesPerishable = action.perishable && !perishableCategories.has(category);

    // Say what this purchase is for. A category that already has its seven
    // varieties is not being taken to an eighth: the pick is there to supply a
    // missing perishable or to close the 84-unit total, and the sentence says so.
    let gain: string;
    if (action.kind === "extra-units") {
      gain = shortOnUnits.has(category)
        ? copy.unitGain(category, REQUIRED_UNITS_PER_CATEGORY)
        : copy.towardTotalGain(action.categoryUnitsGained, REQUIRED_TOTAL_UNITS);
    } else {
      const reached = (varieties.get(category) ?? 0) + 1;
      varieties.set(category, reached);
      if (shortOnVarieties.has(category) && reached <= REQUIRED_VARIETIES_PER_CATEGORY) {
        gain = copy.varietyGain(category, reached, REQUIRED_VARIETIES_PER_CATEGORY);
      } else if (suppliesPerishable) {
        gain = copy.perishableGain(
          category,
          REQUIRED_PERISHABLE_CATEGORIES,
          CATEGORIES.length,
        );
      } else {
        gain = copy.towardTotalGain(action.categoryUnitsGained, REQUIRED_TOTAL_UNITS);
      }
    }

    if (suppliesPerishable) {
      perishableCategories.add(category);
      // Already the whole point of the sentence when perishableGain was used.
      if (!gain.includes(copy.perishableGain(category, REQUIRED_PERISHABLE_CATEGORIES, CATEGORIES.length))) {
        gain += copy.addsMissingPerishable(category);
      }
    }

    const suffix = clearsSuffix(action.clears, locale);

    if (action.kind === "new-variety") {
      const suggestion = suggestionText.get(key);
      const text = suggestion?.[locale];
      return {
        category,
        itemSuggestion: text?.itemSuggestion ?? copy.stockSuggestion(action.variety, action.addedUnits),
        whyItHelps:
          copy.newItemReason(text?.pitch ?? "", MIN_STOCKING_UNITS_PER_VARIETY, gain) + suffix,
        addedUnits: action.addedUnits,
        clears: action.clears.map((c) => constraintPhrase(c, locale)),
      };
    }

    const name = lineNames.get(key) ?? action.variety;
    if (action.kind === "top-up") {
      const held = action.resultingVarietyUnits - action.addedUnits;
      return {
        category,
        itemSuggestion: copy.topUpSuggestion(name, action.addedUnits),
        whyItHelps:
          copy.topUpReason(
            held,
            action.variety.toLowerCase(),
            action.addedUnits,
            MIN_STOCKING_UNITS_PER_VARIETY,
            gain,
          ) + suffix,
        addedUnits: action.addedUnits,
        clears: action.clears.map((c) => constraintPhrase(c, locale)),
      };
    }

    return {
      category,
      itemSuggestion: copy.topUpSuggestion(name, action.addedUnits),
      whyItHelps: copy.extraUnitsReason(action.addedUnits, gain) + suffix,
      addedUnits: action.addedUnits,
      clears: action.clears.map((c) => constraintPhrase(c, locale)),
    };
  });
}

function clearsSuffix(clears: readonly UnmetConstraint[], locale: Locale): string {
  if (clears.length === 0) return "";
  const copy = SCORECARD_COPY[locale];
  return copy.clearsSuffix(clears.map((constraint) => constraintPhrase(constraint, locale)));
}

function constraintPhrase(constraint: UnmetConstraint, locale: Locale): string {
  const copy = SCORECARD_COPY[locale];
  switch (constraint.kind) {
    case "category-varieties":
      return copy.constraintPhrases.categoryVarieties(constraint.category, constraint.required);
    case "category-units":
      return copy.constraintPhrases.categoryUnits(constraint.category, constraint.required);
    case "total-units":
      return copy.constraintPhrases.totalUnits(REQUIRED_TOTAL_UNITS);
    case "perishable-categories":
      return copy.constraintPhrases.perishableCategories(
        REQUIRED_PERISHABLE_CATEGORIES,
        CATEGORIES.length,
      );
  }
}
