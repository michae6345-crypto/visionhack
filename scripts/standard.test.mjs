/**
 * Unit tests for the stocking standard (lib/rules/standard.ts).
 *
 * The verdict a store is shown is arithmetic, so it is tested as arithmetic:
 * countable lines in, met/not met out. NOTHING HERE TOUCHES THE VISION MODEL.
 * There is no fetch, no API key, no image and no scan response anywhere in this
 * file, which is the point — a prompt edit cannot move these numbers.
 *
 *   npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const {
  evaluateStandard,
  varietyKey,
  STOCKING_STANDARD,
  REQUIRED_VARIETIES_PER_CATEGORY,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_PERISHABLE_CATEGORIES,
} = require(resolve(root, ".smoke-build/rules/standard.js"));
const { MIN_STOCKING_UNITS_PER_VARIETY, CATEGORIES } = require(
  resolve(root, ".smoke-build/rules/constants.js"),
);

/** `count` distinct varieties in one category, each at `units`. */
function varieties(category, count, units = MIN_STOCKING_UNITS_PER_VARIETY, perishables = 1) {
  return Array.from({ length: count }, (_, i) => ({
    category,
    variety: `${category} variety ${i + 1}`,
    units,
    perishable: i < perishables,
  }));
}

/** A store that meets the standard exactly, with nothing to spare. */
function exactlyCompliant() {
  return CATEGORIES.flatMap((category) =>
    varieties(category, REQUIRED_VARIETIES_PER_CATEGORY, MIN_STOCKING_UNITS_PER_VARIETY),
  );
}

const only = (evaluation, category) =>
  evaluation.categories.find((c) => c.category === category);

// ---------------------------------------------------------------------------
test("the encoded thresholds are the published Criterion A figures", () => {
  assert.equal(REQUIRED_VARIETIES_PER_CATEGORY, 7);
  assert.equal(MIN_STOCKING_UNITS_PER_VARIETY, 3);
  assert.equal(REQUIRED_TOTAL_UNITS, 84);
  assert.equal(REQUIRED_PERISHABLE_CATEGORIES, 3);
  assert.equal(CATEGORIES.length, 4);
  // The unit minimums follow from the variety minimums, so they must agree.
  assert.equal(
    REQUIRED_UNITS_PER_CATEGORY,
    REQUIRED_VARIETIES_PER_CATEGORY * MIN_STOCKING_UNITS_PER_VARIETY,
  );
  assert.equal(REQUIRED_TOTAL_UNITS, REQUIRED_UNITS_PER_CATEGORY * CATEGORIES.length);
  assert.deepEqual(STOCKING_STANDARD, {
    varietiesPerCategory: 7,
    unitsPerVariety: 3,
    unitsPerCategory: 21,
    totalUnits: 84,
    perishableCategories: 3,
    categoryCount: 4,
  });
});

// ---------------------------------------------------------------------------
test("exactly at the threshold: met, with nothing spare", () => {
  const evaluation = evaluateStandard(exactlyCompliant());

  assert.equal(evaluation.meets, true);
  assert.deepEqual(evaluation.unmet, []);
  assert.equal(evaluation.totalUnits, REQUIRED_TOTAL_UNITS);
  assert.equal(evaluation.totalUnitsShort, 0);
  assert.equal(evaluation.perishableCategories, 4);

  for (const category of evaluation.categories) {
    assert.equal(category.varietiesCounted, REQUIRED_VARIETIES_PER_CATEGORY, category.category);
    assert.equal(category.unitsCounted, REQUIRED_UNITS_PER_CATEGORY, category.category);
    assert.equal(category.varietiesShort, 0, category.category);
    assert.equal(category.unitsShort, 0, category.category);
    assert.equal(category.nearMisses.length, 0, category.category);
    assert.equal(category.meets, true, category.category);
  }
});

// ---------------------------------------------------------------------------
test("one unit short: the whole variety stops counting, not just the unit", () => {
  // Take one unit off a single dairy variety. That variety drops below the
  // 3-unit minimum, so all three of its units leave the count: dairy loses 3,
  // not 1. Undercounting is the safe direction.
  const lines = exactlyCompliant();
  const target = lines.find((line) => line.category === "dairy");
  target.units = MIN_STOCKING_UNITS_PER_VARIETY - 1;

  const evaluation = evaluateStandard(lines);
  const dairy = only(evaluation, "dairy");

  assert.equal(evaluation.meets, false);
  assert.equal(dairy.varietiesCounted, REQUIRED_VARIETIES_PER_CATEGORY - 1);
  assert.equal(dairy.unitsCounted, REQUIRED_UNITS_PER_CATEGORY - MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(dairy.varietiesShort, 1);
  assert.equal(dairy.unitsShort, MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(evaluation.totalUnits, REQUIRED_TOTAL_UNITS - MIN_STOCKING_UNITS_PER_VARIETY);

  // The short variety is reported as a near miss, one unit away.
  assert.equal(dairy.nearMisses.length, 1);
  assert.equal(dairy.nearMisses[0].units, 2);
  assert.equal(dairy.nearMisses[0].unitsShort, 1);
  assert.equal(dairy.nearMisses[0].qualifies, false);

  assert.deepEqual(evaluation.unmet, [
    { kind: "category-varieties", category: "dairy", required: 7, found: 6 },
    { kind: "category-units", category: "dairy", required: 21, found: 18 },
    { kind: "total-units", required: 84, found: 81 },
  ]);
});

// ---------------------------------------------------------------------------
test("one variety short: the category and the total both fail", () => {
  const lines = [
    ...varieties("dairy", REQUIRED_VARIETIES_PER_CATEGORY - 1),
    ...varieties("grains", REQUIRED_VARIETIES_PER_CATEGORY),
    ...varieties("protein", REQUIRED_VARIETIES_PER_CATEGORY),
    ...varieties("produce", REQUIRED_VARIETIES_PER_CATEGORY),
  ];
  const evaluation = evaluateStandard(lines);
  const dairy = only(evaluation, "dairy");

  assert.equal(evaluation.meets, false);
  assert.equal(dairy.varietiesCounted, 6);
  assert.equal(dairy.varietiesShort, 1);
  assert.equal(dairy.meets, false);
  assert.equal(dairy.nearMisses.length, 0); // nothing bought at all, so no near miss
  for (const other of ["grains", "protein", "produce"]) {
    assert.equal(only(evaluation, other).meets, true, other);
  }
  assert.equal(evaluation.totalUnits, REQUIRED_TOTAL_UNITS - MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(evaluation.totalUnitsShort, MIN_STOCKING_UNITS_PER_VARIETY);
});

// ---------------------------------------------------------------------------
test("extra stock in one category does not make up for a shortfall in another", () => {
  // Grains carries triple what it needs; dairy is still one variety short. The
  // 84-unit total is comfortably met, and the store still fails.
  const lines = [
    ...varieties("dairy", REQUIRED_VARIETIES_PER_CATEGORY - 1),
    ...varieties("grains", REQUIRED_VARIETIES_PER_CATEGORY, MIN_STOCKING_UNITS_PER_VARIETY * 4),
    ...varieties("protein", REQUIRED_VARIETIES_PER_CATEGORY),
    ...varieties("produce", REQUIRED_VARIETIES_PER_CATEGORY),
  ];
  const evaluation = evaluateStandard(lines);

  assert.ok(evaluation.totalUnits > REQUIRED_TOTAL_UNITS);
  assert.equal(evaluation.totalUnitsShort, 0);
  assert.equal(evaluation.meets, false);
  assert.deepEqual(evaluation.unmet, [
    { kind: "category-varieties", category: "dairy", required: 7, found: 6 },
    { kind: "category-units", category: "dairy", required: 21, found: 18 },
  ]);
});

// ---------------------------------------------------------------------------
test("perishables in 2 of 4 categories fails; 3 of 4 passes", async (t) => {
  const withPerishables = (count) =>
    CATEGORIES.flatMap((category, index) =>
      varieties(
        category,
        REQUIRED_VARIETIES_PER_CATEGORY,
        MIN_STOCKING_UNITS_PER_VARIETY,
        index < count ? 1 : 0,
      ),
    );

  await t.test("2 of 4 is not enough", () => {
    const evaluation = evaluateStandard(withPerishables(2));
    assert.equal(evaluation.perishableCategories, 2);
    assert.equal(evaluation.perishableCategoriesShort, 1);
    assert.equal(evaluation.meets, false);
    // Everything else is met: the perishable rule is the only thing failing.
    assert.deepEqual(evaluation.unmet, [
      { kind: "perishable-categories", required: 3, found: 2 },
    ]);
    assert.ok(evaluation.categories.every((c) => c.meets));
  });

  await t.test("3 of 4 is enough", () => {
    const evaluation = evaluateStandard(withPerishables(3));
    assert.equal(evaluation.perishableCategories, 3);
    assert.equal(evaluation.perishableCategoriesShort, 0);
    assert.equal(evaluation.meets, true);
    assert.deepEqual(evaluation.unmet, []);
  });

  await t.test("a perishable in a variety that is one unit short does not count", () => {
    // The only perishable in the third category is on a 2-unit variety. That
    // variety does not qualify, so the category has no counted perishable.
    const lines = withPerishables(3);
    const perishable = lines.find((line) => line.category === "protein" && line.perishable);
    perishable.units = MIN_STOCKING_UNITS_PER_VARIETY - 1;

    const evaluation = evaluateStandard(lines);
    assert.equal(only(evaluation, "protein").hasPerishable, false);
    assert.equal(evaluation.perishableCategories, 2);
    assert.equal(evaluation.meets, false);
  });
});

// ---------------------------------------------------------------------------
test("empty input: every requirement unmet, no crash, no partial credit", () => {
  const evaluation = evaluateStandard([]);

  assert.equal(evaluation.meets, false);
  assert.equal(evaluation.totalUnits, 0);
  assert.equal(evaluation.totalUnitsShort, REQUIRED_TOTAL_UNITS);
  assert.equal(evaluation.perishableCategories, 0);
  assert.equal(evaluation.perishableCategoriesShort, REQUIRED_PERISHABLE_CATEGORIES);
  assert.equal(evaluation.categories.length, CATEGORIES.length);

  for (const category of evaluation.categories) {
    assert.equal(category.varietiesCounted, 0, category.category);
    assert.equal(category.unitsCounted, 0, category.category);
    assert.equal(category.varietiesShort, REQUIRED_VARIETIES_PER_CATEGORY, category.category);
    assert.equal(category.qualifying.length, 0, category.category);
    assert.equal(category.nearMisses.length, 0, category.category);
  }

  // One unmet entry per category for varieties, one per category for units,
  // plus the total and the perishable rule.
  assert.equal(evaluation.unmet.length, CATEGORIES.length * 2 + 2);
});

// ---------------------------------------------------------------------------
test("lines of the same variety total together, however they are spelled", () => {
  const evaluation = evaluateStandard([
    { category: "produce", variety: "Roma Tomato", units: 1, perishable: true },
    { category: "produce", variety: "roma tomato", units: 1, perishable: false },
    { category: "produce", variety: " ROMA TOMATO ", units: 1, perishable: false },
  ]);
  const produce = only(evaluation, "produce");

  assert.equal(produce.qualifying.length, 1);
  assert.equal(produce.qualifying[0].units, 3);
  assert.equal(produce.qualifying[0].lines.length, 3);
  // Perishable if any line of the variety is.
  assert.equal(produce.qualifying[0].perishable, true);
  assert.equal(varietyKey(" ROMA TOMATO "), "roma tomato");
});

test("a blank variety never counts, however many units it carries", () => {
  const evaluation = evaluateStandard([
    { category: "dairy", variety: "", units: 50, perishable: true },
    { category: "dairy", variety: "   ", units: 50, perishable: true },
  ]);
  assert.equal(only(evaluation, "dairy").varietiesCounted, 0);
  assert.equal(evaluation.totalUnits, 0);
});

test("fractional and negative units are floored, never rounded up", () => {
  const evaluation = evaluateStandard([
    { category: "dairy", variety: "whole milk", units: 2.9, perishable: true },
    { category: "grains", variety: "white rice", units: -5, perishable: false },
  ]);
  // 2.9 floors to 2, which is below the minimum, so dairy counts nothing.
  assert.equal(only(evaluation, "dairy").varietiesCounted, 0);
  assert.equal(only(evaluation, "dairy").nearMisses[0].units, 2);
  assert.equal(only(evaluation, "grains").varietiesCounted, 0);
  assert.equal(evaluation.totalUnits, 0);
});

test("evaluation is a pure function of its input", () => {
  const lines = exactlyCompliant();
  const snapshot = JSON.stringify(lines);
  const first = evaluateStandard(lines);
  const second = evaluateStandard(lines);

  assert.deepEqual(first, second);
  // The input is not mutated on the way through.
  assert.equal(JSON.stringify(lines), snapshot);
});
