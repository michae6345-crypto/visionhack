/**
 * Unit tests for the fix optimizer (lib/rules/optimizer.ts).
 *
 * The claim the optimizer makes is "buy these and you meet the standard, and
 * there is no cheaper set that does". Both halves are checked here:
 *
 *   1. every plan is applied and re-scored, so "you pass" is verified, not
 *      asserted; and
 *   2. on small instances the answer is compared against a brute-force search
 *      over every subset of candidates, so "no cheaper set" is a measurement.
 *
 * No model, no API key, no network.
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

const { planFixes, projectLines, looseVarietyKey, costKey } = require(
  resolve(root, ".smoke-build/rules/optimizer.js"),
);
const { evaluateStandard, REQUIRED_VARIETIES_PER_CATEGORY } = require(
  resolve(root, ".smoke-build/rules/standard.js"),
);
const { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY } = require(
  resolve(root, ".smoke-build/rules/constants.js"),
);

// ---------------------------------------------------------------------------
// Brute-force oracle
// ---------------------------------------------------------------------------
/**
 * Every addition available to a store, derived independently of the optimizer:
 * raise a variety it already buys to the minimum, or start one from the
 * catalog it does not carry.
 */
function actionSpace(lines, catalog) {
  const evaluation = evaluateStandard(lines);
  const actions = [];

  for (const category of evaluation.categories) {
    for (const nearMiss of category.nearMisses) {
      actions.push({
        category: category.category,
        variety: nearMiss.variety,
        units: nearMiss.unitsShort,
        perishable: nearMiss.perishable,
      });
    }
    const carried = new Set(
      [...category.qualifying, ...category.nearMisses].map((v) => looseVarietyKey(v.variety)),
    );
    for (const item of catalog) {
      if (item.category !== category.category) continue;
      if (carried.has(looseVarietyKey(item.variety))) continue;
      actions.push({
        category: item.category,
        variety: item.variety,
        units: MIN_STOCKING_UNITS_PER_VARIETY,
        perishable: item.perishable,
      });
    }
  }
  return actions;
}

/**
 * Cheapest subset of the action space that makes the standard met, by exhaustive
 * enumeration. Deliberately dumb: it shares no code with the optimizer beyond
 * the scoring function they are both judged by.
 */
function bruteForce(lines, catalog, unitCosts = null) {
  const actions = actionSpace(lines, catalog);
  assert.ok(actions.length <= 20, `action space too large to brute force: ${actions.length}`);

  const priceOf = (action) =>
    unitCosts === null
      ? action.units
      : action.units * unitCosts[costKey(action.category, action.variety)];

  let best = null;
  for (let mask = 0; mask < 1 << actions.length; mask++) {
    const chosen = actions.filter((_, i) => mask & (1 << i));
    const projected = [...lines, ...chosen];
    if (!evaluateStandard(projected).meets) continue;
    const price = chosen.reduce((sum, a) => sum + priceOf(a), 0);
    if (best === null || price < best.price) best = { price, chosen };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const variety = (category, name, units, perishable = false) => ({
  category,
  variety: name,
  units,
  perishable,
});

/** A category holding `count` qualifying varieties, the first one perishable. */
function stocked(category, count, perishables = 1) {
  return Array.from({ length: count }, (_, i) =>
    variety(category, `${category} v${i + 1}`, MIN_STOCKING_UNITS_PER_VARIETY, i < perishables),
  );
}

/** Small per-category catalog, so the action space stays brute-forceable. */
function smallCatalog(perCategory = 2) {
  return CATEGORIES.flatMap((category) =>
    Array.from({ length: perCategory }, (_, i) => ({
      category,
      variety: `${category} catalog ${i + 1}`,
      // One shelf-stable, one perishable.
      perishable: i % 2 === 1,
    })),
  );
}

const fullCatalog = smallCatalog(2);

/** Deterministic PRNG, so a failure is reproducible from the seed alone. */
function rng(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
test("a store that already meets the standard is told to buy nothing", () => {
  const lines = CATEGORIES.flatMap((c) => stocked(c, REQUIRED_VARIETIES_PER_CATEGORY));
  const plan = planFixes(lines, fullCatalog);

  assert.deepEqual(plan.actions, []);
  assert.equal(plan.totalAddedUnits, 0);
  assert.equal(plan.sufficient, true);
  assert.deepEqual(plan.unresolved, []);
});

// ---------------------------------------------------------------------------
test("topping up a variety the store already buys beats starting a new one", () => {
  // Dairy has six varieties plus one at 2 units. One added unit makes the
  // seventh variety count; a catalog item would cost three.
  const lines = [
    ...stocked("dairy", 6),
    variety("dairy", "queso fresco", 2, true),
    ...CATEGORIES.filter((c) => c !== "dairy").flatMap((c) =>
      stocked(c, REQUIRED_VARIETIES_PER_CATEGORY),
    ),
  ];
  const plan = planFixes(lines, fullCatalog);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].kind, "top-up");
  assert.equal(plan.actions[0].variety, "queso fresco");
  assert.equal(plan.actions[0].addedUnits, 1);
  // One unit bought, three units counted: a short variety's units only start
  // counting once the variety qualifies.
  assert.equal(plan.actions[0].categoryUnitsGained, MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(plan.totalAddedUnits, 1);
  assert.equal(plan.sufficient, true);
  assert.equal(bruteForce(lines, fullCatalog).price, 1);
});

// ---------------------------------------------------------------------------
test("the perishable rule buys only the shortfall, in the cheapest category", () => {
  // Two categories already carry a perishable and the rule asks for three of
  // four, so exactly one addition is needed — not one per bare category.
  const bare = (category) => stocked(category, REQUIRED_VARIETIES_PER_CATEGORY, 0);
  const lines = [
    ...bare("dairy"),
    ...bare("grains"),
    ...stocked("protein", REQUIRED_VARIETIES_PER_CATEGORY, 1),
    ...stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY, 1),
  ];
  const evaluation = evaluateStandard(lines);
  assert.deepEqual(evaluation.unmet, [{ kind: "perishable-categories", required: 3, found: 2 }]);

  const plan = planFixes(lines, fullCatalog);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].perishable, true);
  assert.equal(plan.totalAddedUnits, MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(plan.sufficient, true);
  assert.deepEqual(plan.actions[0].clears, [
    { kind: "perishable-categories", required: 3, found: 2 },
  ]);

  // Two bare categories means two additions, still one short of one each.
  const twoShort = [
    ...bare("dairy"),
    ...bare("grains"),
    ...bare("protein"),
    ...stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY, 1),
  ];
  const second = planFixes(twoShort, fullCatalog);
  assert.equal(second.actions.length, 2);
  assert.equal(second.totalAddedUnits, 2 * MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(second.sufficient, true);
  assert.equal(bruteForce(twoShort, fullCatalog).price, 2 * MIN_STOCKING_UNITS_PER_VARIETY);
});

// ---------------------------------------------------------------------------
test("one purchase can clear a variety gap and the perishable rule together", () => {
  // Dairy is one variety short AND has no perishable; so do grains. The cheapest
  // plan uses the perishable catalog item in both, clearing four requirements
  // with two purchases.
  const lines = [
    ...stocked("dairy", REQUIRED_VARIETIES_PER_CATEGORY - 1, 0),
    ...stocked("grains", REQUIRED_VARIETIES_PER_CATEGORY - 1, 0),
    ...stocked("protein", REQUIRED_VARIETIES_PER_CATEGORY, 0),
    ...stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY, 1),
  ];
  const plan = planFixes(lines, fullCatalog);

  assert.equal(plan.sufficient, true);
  assert.equal(plan.actions.length, 2);
  assert.ok(plan.actions.every((a) => a.perishable));
  assert.equal(plan.totalAddedUnits, 2 * MIN_STOCKING_UNITS_PER_VARIETY);
  assert.equal(bruteForce(lines, fullCatalog).price, 2 * MIN_STOCKING_UNITS_PER_VARIETY);

  // Between them the two purchases clear every requirement that was unmet.
  const cleared = plan.actions.flatMap((a) => a.clears);
  const before = evaluateStandard(lines).unmet;
  assert.equal(cleared.length, before.length);
});

// ---------------------------------------------------------------------------
test("every plan, applied, makes the standard met", () => {
  const scenarios = [
    ["empty store", []],
    ["one category only", stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY)],
    [
      "three varieties short in two categories",
      [
        ...stocked("dairy", 4),
        ...stocked("grains", 4),
        ...stocked("protein", REQUIRED_VARIETIES_PER_CATEGORY),
        ...stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY),
      ],
    ],
    [
      "near misses everywhere",
      CATEGORIES.flatMap((c) => [...stocked(c, 6), variety(c, `${c} near`, 2, true)]),
    ],
  ];

  // Seven per category, matching the shipped catalog, so gaps are closable.
  const catalog = smallCatalog(7);

  for (const [name, lines] of scenarios) {
    const plan = planFixes(lines, catalog);
    const after = evaluateStandard(projectLines(lines, plan.actions));
    assert.equal(plan.sufficient, true, name);
    assert.equal(after.meets, true, name);
    assert.deepEqual(plan.unresolved, [], name);
    assert.equal(
      plan.totalAddedUnits,
      plan.actions.reduce((sum, a) => sum + a.addedUnits, 0),
      name,
    );
  }
});

// ---------------------------------------------------------------------------
test("minimal on random near-compliant stores, checked against brute force", () => {
  const random = rng(20261104);
  let compared = 0;

  for (let trial = 0; trial < 200; trial++) {
    const lines = [];
    for (const category of CATEGORIES) {
      // 5, 6 or 7 qualifying varieties, sometimes with a short variety as well.
      const qualifying = 5 + Math.floor(random() * 3);
      const perishables = random() < 0.5 ? 1 : 0;
      lines.push(...stocked(category, qualifying, perishables));
      if (random() < 0.5) {
        lines.push(
          variety(
            category,
            `${category} near`,
            1 + Math.floor(random() * 2),
            random() < 0.5,
          ),
        );
      }
    }
    // Two catalog items per category keeps the action space inside 20.
    const catalog = smallCatalog(2);
    const plan = planFixes(lines, catalog);
    const best = bruteForce(lines, catalog);

    if (best === null) {
      // No subset passes, so the optimizer must not claim one does.
      assert.equal(plan.sufficient, false, `trial ${trial}: claimed a plan that cannot exist`);
      continue;
    }
    compared++;
    assert.equal(plan.sufficient, true, `trial ${trial}: missed a reachable plan`);
    assert.equal(
      plan.totalAddedUnits,
      best.price,
      `trial ${trial}: ${plan.totalAddedUnits} units planned, ${best.price} was possible`,
    );
    assert.equal(evaluateStandard(projectLines(lines, plan.actions)).meets, true, `trial ${trial}`);
  }

  // Guard against a run where every instance happened to be infeasible.
  assert.ok(compared > 50, `only ${compared} feasible instances compared`);
});

// ---------------------------------------------------------------------------
test("with a price list it minimizes cost, not units", () => {
  // Grains is one variety short. The shelf-stable catalog item is dearer per
  // unit than the perishable one, so the cheapest plan is not the first listed.
  const lines = [
    ...stocked("dairy", REQUIRED_VARIETIES_PER_CATEGORY),
    ...stocked("grains", REQUIRED_VARIETIES_PER_CATEGORY - 1),
    ...stocked("protein", REQUIRED_VARIETIES_PER_CATEGORY),
    ...stocked("produce", REQUIRED_VARIETIES_PER_CATEGORY),
  ];
  const catalog = smallCatalog(2);
  const unitCosts = {};
  for (const item of catalog) {
    unitCosts[costKey(item.category, item.variety)] = item.perishable ? 1 : 4;
  }
  for (const line of lines) unitCosts[costKey(line.category, line.variety)] = 1;

  const byCost = planFixes(lines, catalog, { objective: "cost", unitCosts });
  assert.equal(byCost.objective, "cost");
  assert.equal(byCost.actions.length, 1);
  assert.equal(byCost.actions[0].perishable, true);
  assert.equal(byCost.totalCost, 3); // 3 units at 1 each
  assert.equal(byCost.sufficient, true);
  assert.equal(bruteForce(lines, catalog, unitCosts).price, 3);

  // Asking for cost without a complete price list falls back to units and says so.
  const unpriced = planFixes(lines, catalog, { objective: "cost" });
  assert.equal(unpriced.objective, "units");
  assert.equal(unpriced.totalCost, null);
  assert.equal(unpriced.sufficient, true);
});

// ---------------------------------------------------------------------------
test("a catalog too small to close the gap reports what is left", () => {
  // An empty store needs seven varieties per category; this catalog offers
  // two. The plan must still be the best available, and must not claim to pass.
  const plan = planFixes([], smallCatalog(2));

  assert.equal(plan.sufficient, false);
  assert.equal(plan.actions.length, 8); // everything the catalog has
  assert.ok(plan.unresolved.length > 0);
  assert.ok(
    plan.unresolved.some((c) => c.kind === "category-varieties"),
    JSON.stringify(plan.unresolved),
  );
  // No filler: padding units onto a total the store cannot reach is not advice.
  assert.ok(plan.actions.every((a) => a.kind !== "extra-units"));
  // What it does report is honest arithmetic.
  const after = evaluateStandard(projectLines([], plan.actions));
  assert.equal(after.meets, false);
  assert.deepEqual(plan.unresolved, after.unmet);
});

// ---------------------------------------------------------------------------
test("an empty catalog and an empty store produce no false promises", () => {
  const plan = planFixes([], []);
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.sufficient, false);
  assert.equal(plan.unresolved.length, CATEGORIES.length * 2 + 2);
});

// ---------------------------------------------------------------------------
test("a variety the store already carries is never suggested again", () => {
  const lines = [
    // "canned salmon" vs "salmon", "tomatoes" vs "tomato": the loose match
    // catches both.
    variety("protein", "canned salmon", MIN_STOCKING_UNITS_PER_VARIETY),
    variety("produce", "tomatoes", MIN_STOCKING_UNITS_PER_VARIETY),
  ];
  const catalog = [
    { category: "protein", variety: "salmon", perishable: false },
    { category: "produce", variety: "tomato", perishable: true },
    { category: "produce", variety: "bananas", perishable: true },
  ];
  const plan = planFixes(lines, catalog);
  const suggested = plan.actions.map((a) => a.variety);

  assert.ok(!suggested.includes("salmon"));
  assert.ok(!suggested.includes("tomato"));
  assert.ok(suggested.includes("bananas"));
});

// ---------------------------------------------------------------------------
test("plans are deterministic", () => {
  const lines = [...stocked("dairy", 5), ...stocked("grains", 6), ...stocked("produce", 7)];
  const catalog = smallCatalog(7);
  const first = JSON.stringify(planFixes(lines, catalog));
  for (let i = 0; i < 5; i++) {
    assert.equal(JSON.stringify(planFixes(lines, catalog)), first);
  }
});
