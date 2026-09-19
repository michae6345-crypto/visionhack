/**
 * Unit tests for the interactive shelf's catalogue and presets (lib/shelf.ts).
 *
 * The point of these is narrow and worth stating: a preset labelled "meets the
 * standard" in the UI has to actually meet it, and one labelled "one unit
 * short" has to actually fail. A visitor learns the rule from whatever the
 * buttons do, so a mislabelled preset teaches the rule wrong.
 *
 * Scored with the real lib/rules/standard.ts. No API key, no model, no fetch.
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
  SHELF_CATALOGUE,
  SHELF_PRESETS,
  ONE_SHORT_ID,
  shelfLines,
  presetUnits,
  meetsPreset,
  varietiesIn,
  varietyById,
} = require(resolve(root, ".smoke-build/shelf.js"));
const {
  evaluateStandard,
  REQUIRED_VARIETIES_PER_CATEGORY,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_PERISHABLE_CATEGORIES,
} = require(resolve(root, ".smoke-build/rules/standard.js"));
const { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY } = require(
  resolve(root, ".smoke-build/rules/constants.js"),
);

const score = (units) => evaluateStandard(shelfLines(units));

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------
test("every category offers more varieties than the rule requires", () => {
  for (const category of CATEGORIES) {
    assert.ok(
      varietiesIn(category).length > REQUIRED_VARIETIES_PER_CATEGORY,
      `${category} must offer room to overshoot the ${REQUIRED_VARIETIES_PER_CATEGORY}-variety threshold`,
    );
  }
});

test("variety ids are unique", () => {
  const ids = SHELF_CATALOGUE.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every variety is named in both locales", () => {
  for (const variety of SHELF_CATALOGUE) {
    assert.ok(variety.en.trim().length > 0, `${variety.id} has no English name`);
    assert.ok(variety.es.trim().length > 0, `${variety.id} has no Spanish name`);
  }
});

test("each category lists its perishable varieties first", () => {
  // meetsPreset() fills from the front of each category, so this ordering is
  // what makes that preset satisfy the perishable requirement. If someone
  // reorders the catalogue, this fails before the preset silently stops
  // meeting the standard.
  for (const category of CATEGORIES) {
    const flags = varietiesIn(category).map((v) => v.perishable);
    const firstShelfStable = flags.indexOf(false);
    if (firstShelfStable === -1) continue;
    assert.ok(
      !flags.slice(firstShelfStable).includes(true),
      `${category} mixes a perishable variety in after a shelf-stable one`,
    );
  }
});

test("shelfLines drops varieties with no units rather than passing zeroes", () => {
  const lines = shelfLines({ bananas: 4, apples: 0 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].units, 4);
});

test("shelfLines carries the catalogue's perishable flag through", () => {
  const [fresh] = shelfLines({ bananas: 3 });
  const [canned] = shelfLines({ "canned-corn": 3 });
  assert.equal(fresh.perishable, true);
  assert.equal(canned.perishable, false);
});

// ---------------------------------------------------------------------------
// The presets land where they claim
// ---------------------------------------------------------------------------
test("the empty preset meets nothing and reports every requirement unmet", () => {
  const result = score(presetUnits("empty"));
  assert.equal(result.meets, false);
  assert.equal(result.totalUnits, 0);
  assert.equal(result.perishableCategories, 0);
  // Two per category (varieties and units), plus the total and the perishables.
  assert.equal(result.unmet.length, CATEGORIES.length * 2 + 2);
});

test("the 'meets the standard' preset actually meets the standard", () => {
  const result = score(presetUnits("meets"));
  assert.equal(result.meets, true);
  assert.deepEqual(result.unmet, []);
});

test("the 'meets' preset sits exactly on the thresholds, not above them", () => {
  // Exactly at the line is the honest demo: it shows there is no slack.
  const result = score(presetUnits("meets"));
  assert.equal(result.totalUnits, REQUIRED_TOTAL_UNITS);
  for (const category of result.categories) {
    assert.equal(category.varietiesCounted, REQUIRED_VARIETIES_PER_CATEGORY);
    assert.equal(category.unitsCounted, REQUIRED_UNITS_PER_CATEGORY);
  }
  assert.ok(result.perishableCategories >= REQUIRED_PERISHABLE_CATEGORIES);
});

test("the 'one unit short' preset differs from 'meets' by exactly one unit", () => {
  const meets = presetUnits("meets");
  const short = presetUnits("oneShort");
  assert.deepEqual(Object.keys(short).sort(), Object.keys(meets).sort());
  const moved = Object.keys(meets).filter((id) => meets[id] !== short[id]);
  assert.deepEqual(moved, [ONE_SHORT_ID]);
  assert.equal(meets[ONE_SHORT_ID] - short[ONE_SHORT_ID], 1);
});

test("one unit short fails, and costs the category a variety and three units", () => {
  const result = score(presetUnits("oneShort"));
  assert.equal(result.meets, false);

  const dropped = varietyById(ONE_SHORT_ID);
  const hit = result.categories.find((c) => c.category === dropped.category);
  // The unit removed was one of three. All three stop counting, because a
  // variety below the per-variety minimum contributes nothing at all.
  assert.equal(hit.varietiesCounted, REQUIRED_VARIETIES_PER_CATEGORY - 1);
  assert.equal(
    hit.unitsCounted,
    REQUIRED_UNITS_PER_CATEGORY - MIN_STOCKING_UNITS_PER_VARIETY,
  );
  assert.equal(
    result.totalUnits,
    REQUIRED_TOTAL_UNITS - MIN_STOCKING_UNITS_PER_VARIETY,
  );
  // And it shows up as a near miss, not as an absence.
  assert.ok(hit.nearMisses.some((v) => v.variety === dropped.en));
});

test("the 'typical corner store' preset falls short, which is the whole demo", () => {
  const result = score(presetUnits("typical"));
  assert.equal(result.meets, false);
  assert.ok(result.unmet.length > 0);
});

test("every preset id in the map produces a shelf the standard can score", () => {
  for (const id of Object.keys(SHELF_PRESETS)) {
    const result = score(presetUnits(id));
    assert.equal(typeof result.meets, "boolean");
    assert.equal(result.categories.length, CATEGORIES.length);
  }
});

test("stocking one more unit never lowers the counted total", () => {
  // Monotonicity: the shelf's steppers should never punish adding stock. This
  // is a property of the standard, checked here through the shelf's own mapping
  // because that mapping is what the UI actually calls.
  const base = presetUnits("typical");
  const before = score(base).totalUnits;
  for (const variety of SHELF_CATALOGUE) {
    const bumped = { ...base, [variety.id]: (base[variety.id] ?? 0) + 1 };
    assert.ok(
      score(bumped).totalUnits >= before,
      `adding a unit of ${variety.id} lowered the counted total`,
    );
  }
});

test("meetsPreset is derived from the thresholds, not from stored numbers", () => {
  // Every value in it is the per-variety minimum; nothing is hand-tuned.
  const values = Object.values(meetsPreset());
  assert.equal(values.length, CATEGORIES.length * REQUIRED_VARIETIES_PER_CATEGORY);
  assert.ok(values.every((v) => v === MIN_STOCKING_UNITS_PER_VARIETY));
});
