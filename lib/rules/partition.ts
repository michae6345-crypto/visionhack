/**
 * Splits classified items into the COUNTED set and the EXCLUDED set, applies
 * the four scoring rules, and rolls up qualifying varieties per category.
 *
 * This is the enforcement point for the product rule: undercounting is safer
 * than overcounting. The pass-2 prompt asks the model to apply these rules,
 * but a prompt is not a guarantee — every rule is re-checked here in code, so
 * a confidently-wrong model response still cannot inflate the count.
 *
 * What this deliberately does NOT do is build Role C's pass/fail scorecard.
 * It stops at "here are the classified items and the qualifying-variety
 * counts"; turning that into a pass or a fail is C's rule engine.
 */
import {
  CATEGORIES,
  MIN_COUNTED_CONFIDENCE,
  categoryForKnownFood,
  computePerishable,
  computeStockingUnits,
  floorVarietyCount,
  isAccessoryFood,
  isPeanutButter,
  varietyQualifies,
  type Category,
} from "./constants";
import { varietyKey } from "./standard";
import type { ExcludedItem, ScanItem, VarietyCountsByCategory } from "../types";
import type { ClassifiedItem } from "../vision/schemas";

export interface Partitioned {
  items: ScanItem[];
  excluded: ExcludedItem[];
  varietyCounts: VarietyCountsByCategory;
}

export function partitionClassifiedItems(classified: ClassifiedItem[]): Partitioned {
  const items: ScanItem[] = [];
  const excluded: ExcludedItem[] = [];

  for (const item of classified) {
    // Clamp: the schema constrains the type, not the range.
    const confidence = Math.min(1, Math.max(0, item.confidence));

    // RULE 1 — deterministic product decisions override a stale model flag.
    const peanutButter = isPeanutButter(item.variety, item.sourceLineText);
    const category = categoryForKnownFood(item.category, item.variety, item.sourceLineText);
    const accessory = peanutButter
      ? false
      : item.accessory || isAccessoryFood(item.variety, item.sourceLineText);

    const rawUnits = computeStockingUnits(item.quantity, item.packCount);

    // The model's own exclusion and the confidence floor always apply.
    const hardReason =
      (item.excludeReason && item.excludeReason.trim().length > 0
        ? item.excludeReason
        : null) ??
      (confidence < MIN_COUNTED_CONFIDENCE
        ? `Low confidence (${confidence.toFixed(2)}).`
        : null);

    if (hardReason !== null) {
      excluded.push({
        description: item.sourceLineText,
        reason: hardReason,
        confidence,
        category,
      });
      continue;
    }

    // An accessory contributes zero regardless of pack size, so an unknown
    // pack size is not a reason to hide it — RULE 1 says keep it visible.
    if (!accessory && rawUnits === null) {
      excluded.push({
        description: item.sourceLineText,
        reason: unknownUnitsReason(item.quantity, item.packCount),
        confidence,
        category,
      });
      continue;
    }

    items.push({
      description: item.sourceLineText,
      category,
      variety: item.variety,
      quantity: item.quantity,
      packCount: item.packCount,
      // RULE 1 — accessory foods contribute zero stocking units.
      stockingUnits: accessory ? 0 : (rawUnits as number),
      accessory,
      storage: item.storage,
      // RULE 3 — perishability is derived from storage.
      perishable: computePerishable(item.storage),
      confidence,
    });
  }

  return { items, excluded, varietyCounts: countQualifyingVarieties(items) };
}

/** Name the missing factor, so a zero-unit scan can be diagnosed from its response. */
function unknownUnitsReason(quantity: number | null, packCount: number | null): string {
  if (quantity !== null && packCount === null) return "Could not determine the pack count.";
  if (quantity === null && packCount !== null) return "Could not read the quantity.";
  return "Could not determine pack size or quantity.";
}

/**
 * RULE 2 + RULE 4 — a variety needs at least the minimum stocking units to
 * count at all, and the resulting counts round down.
 *
 * lib/rules/standard.ts computes the same totals on its way to a verdict; both
 * group varieties with the shared varietyKey, so the two cannot disagree about
 * what counts as the same variety. The tests assert the numbers match.
 *
 * Accessory foods contribute 0 toward any variety count (RULE 1), so they are
 * skipped entirely here rather than contributing a zero-unit variety.
 */
export function countQualifyingVarieties(items: ScanItem[]): VarietyCountsByCategory {
  const totals = new Map<Category, Map<string, number>>();
  for (const category of CATEGORIES) totals.set(category, new Map());

  for (const item of items) {
    if (item.accessory) continue; // RULE 1
    const byVariety = totals.get(item.category);
    if (!byVariety) continue;
    const key = varietyKey(item.variety);
    // Unrelated lines with a blank variety would otherwise total as one variety.
    if (!key) continue;
    byVariety.set(key, (byVariety.get(key) ?? 0) + item.stockingUnits);
  }

  const counts = {} as VarietyCountsByCategory;
  for (const category of CATEGORIES) {
    const byVariety = totals.get(category);
    let qualifying = 0;
    if (byVariety) {
      for (const total of byVariety.values()) {
        if (varietyQualifies(total)) qualifying++;
      }
    }
    // RULE 4 — round down, never up.
    counts[category] = floorVarietyCount(qualifying);
  }
  return counts;
}
