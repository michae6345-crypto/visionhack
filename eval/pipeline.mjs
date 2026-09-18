/**
 * Runs a stored response through the real pipeline code, with no network.
 *
 * Everything downstream of the two model calls is the shipped implementation,
 * imported from the same build the unit tests use: reconcileClassification (the
 * pack and quantity parsers, the storage override, the legibility rule), then
 * partitionClassifiedItems, then the scorecard. Nothing is reimplemented here,
 * because a reimplementation would measure the copy instead of the app.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const BUILD = resolve(root, ".smoke-build");

if (!existsSync(resolve(BUILD, "rule-engine.js"))) {
  throw new Error(
    "eval needs the TypeScript compiled first: run `npx tsc -p tsconfig.smoke.json` (npm run eval does this for you).",
  );
}

const { reconcileClassification } = require(resolve(BUILD, "vision/pipeline.js"));
const { partitionClassifiedItems } = require(resolve(BUILD, "rules/partition.js"));
const { buildScanResult } = require(resolve(BUILD, "rule-engine.js"));
const { CATEGORIES } = require(resolve(BUILD, "rules/constants.js"));

/**
 * Fixed date, so a scorecard built today and one built tomorrow compare equal.
 * The eval never asserts anything about the date.
 */
const SCAN_DATE = new Date("2026-09-18T17:00:00Z");

/**
 * One line's outcome, as the pipeline decides it.
 *
 * Each line is partitioned on its own so its outcome can be attributed to it.
 * partitionClassifiedItems treats lines independently, so this gives the same
 * answer as partitioning the whole record at once — the scorecard below is built
 * from the whole record regardless.
 */
function lineOutcomes(classifiedItems) {
  return classifiedItems.map((item) => {
    const { items, excluded } = partitionClassifiedItems([item]);
    const kept = items[0];
    const dropped = excluded[0];

    // An accessory food is kept for display at zero units. It contributes
    // nothing, so for measurement it is held back, not counted.
    const counted = Boolean(kept) && kept.stockingUnits > 0;

    return {
      counted,
      reason: dropped
        ? dropped.reason
        : kept && kept.accessory
          ? "Accessory food: counted for nothing."
          : null,
      predicted: {
        category: kept?.category ?? dropped?.category ?? null,
        variety: kept?.variety ?? null,
        unitsPerPack: kept?.packCount ?? null,
        packs: kept?.quantity ?? null,
        units: counted ? kept.stockingUnits : null,
        perishable: kept ? kept.perishable : null,
        storage: kept?.storage ?? null,
        accessory: kept?.accessory ?? false,
      },
    };
  });
}

/**
 * Replay one stored response for one record.
 *
 * Returns the per-line outcomes lined up with the fixture's lines, plus the
 * scorecard the app would show, reduced to the shape the fixture commits an
 * expectation in.
 */
export function replay(record, response) {
  const raw = response.extract;
  const classified = reconcileClassification(raw, response.classify);
  const outcomes = lineOutcomes(classified.items);

  const { items } = partitionClassifiedItems(classified.items);
  const scorecard = buildScanResult(items, record.storeName, SCAN_DATE);

  return { outcomes, scorecard, actual: summarize(scorecard), counted: items };
}

/** The scorecard reduced to the numbers a fixture commits an expectation for. */
export function summarize(scorecard) {
  const categories = {};
  for (const category of CATEGORIES) {
    const row = scorecard.categories.find((c) => c.category === category);
    categories[category] = {
      varieties: row.varietiesFound,
      units: row.unitsFound,
      perishable: row.hasPerishable,
    };
  }
  return {
    categories,
    totalUnits: scorecard.totalUnits,
    perishableCategories: scorecard.perishableCategoriesMet,
    overall: scorecard.overallStatus,
  };
}

export { CATEGORIES, SCAN_DATE, buildScanResult, partitionClassifiedItems, reconcileClassification };
