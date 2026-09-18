/**
 * A second, independent implementation of the stocking standard, written from
 * the rule as prose rather than from lib/rules/standard.ts.
 *
 * WHY A SECOND IMPLEMENTATION. The expected verdict committed on each fixture
 * record has to come from somewhere other than the code under test, or the eval
 * is the app grading its own homework. These functions were written against the
 * published Criterion A wording — seven varieties per staple category, three
 * stocking units per variety, eighty-four units across the four categories, one
 * perishable variety in three of the four — and they share no code with the app.
 * The numbers they produce were committed as literals in fixtures/records.mjs
 * and spot-checked by hand; the harness then compares the app against those
 * literals, not against a fresh run of this file.
 *
 * Deliberately naive: plain loops, no shared helpers, no normalisation cleverness
 * beyond lower-casing a variety name. If this and lib/rules/standard.ts disagree,
 * that disagreement is the finding.
 */
import { isPerishableStorage } from "./fixtures/lines.mjs";

const CATEGORIES = ["dairy", "grains", "protein", "produce"];

const RULE = {
  varietiesPerCategory: 7,
  unitsPerVariety: 3,
  unitsPerCategory: 21,
  totalUnits: 84,
  perishableCategories: 3,
};

/**
 * Score the countable truth rows of one record.
 *
 * `rows` are the `truth` halves of fixture lines, counted ones only. Held-back
 * lines are excluded by the caller, because a line a reader cannot count
 * contributes nothing.
 */
export function scoreTruth(rows) {
  const result = { categories: {}, totalUnits: 0, perishableCategories: 0, overall: "fail" };

  let categoriesMeetingBoth = 0;

  for (const category of CATEGORIES) {
    // Add up units per variety name.
    const unitsByVariety = {};
    const perishableByVariety = {};
    for (const row of rows) {
      if (row.category !== category) continue;
      const name = String(row.variety).trim().toLowerCase();
      if (name === "") continue;
      unitsByVariety[name] = (unitsByVariety[name] || 0) + Math.floor(row.units);
      if (isPerishableStorage(row.storage)) perishableByVariety[name] = true;
    }

    // A variety counts only at three units or more. Below that it counts for
    // nothing at all, and neither do its units.
    let varieties = 0;
    let units = 0;
    let perishable = false;
    const nearMisses = [];
    for (const name of Object.keys(unitsByVariety)) {
      const varietyUnits = unitsByVariety[name];
      if (varietyUnits >= RULE.unitsPerVariety) {
        varieties = varieties + 1;
        units = units + varietyUnits;
        if (perishableByVariety[name]) perishable = true;
      } else if (varietyUnits > 0) {
        nearMisses.push({ variety: name, units: varietyUnits });
      }
    }

    result.categories[category] = { varieties, units, perishable, nearMisses };
    result.totalUnits = result.totalUnits + units;
    if (perishable) result.perishableCategories = result.perishableCategories + 1;
    if (varieties >= RULE.varietiesPerCategory && units >= RULE.unitsPerCategory) {
      categoriesMeetingBoth = categoriesMeetingBoth + 1;
    }
  }

  const passes =
    categoriesMeetingBoth === CATEGORIES.length &&
    result.totalUnits >= RULE.totalUnits &&
    result.perishableCategories >= RULE.perishableCategories;
  result.overall = passes ? "pass" : "fail";
  return result;
}

/** The expected block committed on a fixture record, in its committed shape. */
export function expectedBlockFor(rows) {
  const scored = scoreTruth(rows);
  const expected = { categories: {}, totalUnits: scored.totalUnits };
  for (const category of CATEGORIES) {
    const { varieties, units, perishable } = scored.categories[category];
    expected.categories[category] = { varieties, units, perishable };
  }
  expected.perishableCategories = scored.perishableCategories;
  expected.overall = scored.overall;
  return expected;
}

export { CATEGORIES, RULE };
