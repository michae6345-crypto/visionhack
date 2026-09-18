/**
 * Unit tests for the rule engine (lib/rule-engine.ts): counted items in,
 * ScanResult scorecard and fix list out.
 *
 * Most fixtures are raw classifier lines run through partitionClassifiedItems
 * first, exactly as the route does, and `score()` asserts the scorecard agrees
 * with the route's own `varietyCounts`. No API call, no key.
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

const { buildScanResult } = require(resolve(root, ".smoke-build/rule-engine.js"));
const { partitionClassifiedItems } = require(resolve(root, ".smoke-build/rules/partition.js"));
const { MOCK_RESULT } = require(resolve(root, ".smoke-build/mock-data.js"));
const { SUGGESTIONS } = require(resolve(root, ".smoke-build/scorecard-copy.js"));

// 9:30 pm on Sep 12 in Los Angeles, already Sep 13 in UTC (where Vercel runs).
const SCAN_DATE = new Date("2026-09-13T04:30:00Z");

/** Seven realistic varieties per category. */
const STAPLES = {
  dairy: [
    ["Lucerne Whole Milk, 1 gal", "whole milk", "refrigerated"],
    ["Tillamook Medium Cheddar Block, 8 oz", "cheddar cheese", "refrigerated"],
    ["Dannon Plain Lowfat Yogurt, 32 oz", "plain yogurt", "refrigerated"],
    ["Cacique Queso Fresco, 10 oz", "queso fresco", "refrigerated"],
    ["Carnation Evaporated Milk, 12 oz", "evaporated milk", "shelf_stable"],
    ["Daisy Cottage Cheese, 16 oz", "cottage cheese", "refrigerated"],
    ["Nido Fortificada Dry Milk, 12.6 oz", "powdered milk", "shelf_stable"],
  ],
  grains: [
    ["Mahatma Extra Long Grain White Rice, 2 lb", "white rice", "shelf_stable"],
    ["Mission Flour Tortillas Soft Taco, 10 ct", "flour tortillas", "shelf_stable"],
    ["Barilla Spaghetti, 16 oz", "spaghetti", "shelf_stable"],
    ["Quaker Old Fashioned Oats, 18 oz", "rolled oats", "shelf_stable"],
    ["General Mills Cheerios, 8.9 oz", "oat cereal", "shelf_stable"],
    ["Maseca Instant Corn Masa Flour, 4.4 lb", "corn masa flour", "shelf_stable"],
    ["Bimbo Soft White Bread, 20 oz", "white bread", "fresh"],
  ],
  protein: [
    ["StarKist Chunk Light Tuna in Water, 5 oz", "canned tuna", "shelf_stable"],
    ["Fresh Ground Beef 80/20, 1 lb", "ground beef", "refrigerated"],
    ["Oscar Mayer Classic Beef Franks, 15 oz", "beef hot dogs", "refrigerated"],
    ["Swanson Premium White Chicken Breast, 9.75 oz", "canned chicken", "shelf_stable"],
    ["Bar-S Classic Bologna, 12 oz", "bologna", "refrigerated"],
    ["Fresh Chicken Drumsticks, family pack", "chicken", "refrigerated"],
    ["Bumble Bee Sardines in Water, 3.75 oz", "sardines", "shelf_stable"],
  ],
  produce: [
    ["Bananas, per lb", "bananas", "fresh"],
    ["Russet Potatoes, 5 lb bag", "potatoes", "fresh"],
    ["Yellow Onions, 3 lb bag", "onions", "fresh"],
    ["Del Monte Whole Kernel Corn, 15.25 oz", "canned corn", "shelf_stable"],
    ["Dole Mandarin Oranges Fruit Cups, 4 ct", "mandarin oranges", "shelf_stable"],
    ["Roma Tomatoes, per lb", "tomatoes", "fresh"],
    ["Green Cabbage, each", "cabbage", "fresh"],
  ],
};

/** One raw classifier line, shaped like lib/vision/schemas.ts ClassifiedItem. */
function line(category, [sourceLineText, variety, storage], units, over = {}) {
  return {
    sourceLineText,
    category,
    variety,
    packCount: 1,
    quantity: units,
    storage,
    accessory: false,
    confidence: 0.95,
    excludeReason: null,
    ...over,
  };
}

function stock(category, staples = STAPLES[category], units = 3) {
  return staples.map((staple) => line(category, staple, units));
}

/** Runs lines through the route's partition step, then the rule engine. */
function score(lines, storeName = "Test Store") {
  const { items, varietyCounts } = partitionClassifiedItems(lines);
  const result = buildScanResult(items, storeName, SCAN_DATE);
  for (const c of result.categories) {
    assert.equal(c.varietiesFound, varietyCounts[c.category], `${c.category} disagrees with varietyCounts`);
  }
  return result;
}

function category(result, name) {
  const found = result.categories.find((c) => c.category === name);
  assert.ok(found, `missing category ${name}`);
  return found;
}

// ---------------------------------------------------------------------------
test("a fully stocked store passes", () => {
  const result = score(
    [
      ...stock("dairy"),
      ...stock("grains"),
      ...stock("protein"),
      ...stock("produce", STAPLES.produce.filter(([, variety]) => variety !== "tomatoes")),
      // Three 1-unit tomato lines with inconsistent spelling total 3 and count as one variety.
      line("produce", ["Roma Tomato", "tomatoes", "fresh"], 1),
      line("produce", ["Tomato, Grape pint", "Tomatoes", "fresh"], 1),
      line("produce", ["Tomato 4x4", " tomatoes ", "fresh"], 1),
      // Near-miss: 2 units, so it must not count anywhere.
      line("produce", ["Select Cucumber bushel", "cucumbers", "fresh"], 2),
    ],
    "Rivera's Corner Market",
  );

  assert.equal(result.overallStatus, "pass");
  assert.equal(result.storeName, "Rivera's Corner Market");
  assert.equal(result.scanDate, "2026-09-12");
  assert.equal(result.totalUnits, 84);
  assert.equal(result.perishableCategoriesMet, 4);
  assert.deepEqual(result.fixes, []);
  for (const c of result.categories) {
    assert.equal(c.varietiesFound, 7, c.category);
    assert.equal(c.unitsFound, 21, c.category);
    assert.equal(c.hasPerishable, true, c.category);
  }

  const produce = category(result, "produce");
  assert.equal(produce.items.length, 9); // 6 single-line varieties + 3 tomato lines
  assert.ok(!produce.items.some((i) => i.variety === "cucumbers"));
});

// ---------------------------------------------------------------------------
test("a store short on dairy fails, with dairy-only fixes", () => {
  const result = score([
    ...stock("dairy", STAPLES.dairy.slice(0, 4)),
    ...stock("grains"),
    ...stock("protein"),
    ...stock("produce"),
  ]);
  const dairy = category(result, "dairy");

  assert.equal(result.overallStatus, "fail");
  assert.equal(dairy.varietiesFound, 4);
  assert.equal(dairy.unitsFound, 12);
  assert.equal(dairy.hasPerishable, true);
  assert.equal(result.totalUnits, 75);
  assert.equal(result.perishableCategoriesMet, 4);
  for (const other of ["grains", "protein", "produce"]) {
    assert.equal(category(result, other).varietiesFound, 7, other);
  }

  // The fix list is the whole gap, not a preview of it: three varieties short
  // means three fixes, and the plan says it is enough.
  assert.equal(result.fixes.length, 3);
  assert.ok(result.fixes.every((f) => f.category === "dairy"));
  assert.match(result.fixes[0].whyItHelps, /5 of 7 varieties/);
  assert.match(result.fixes[1].whyItHelps, /6 of 7 varieties/);
  assert.match(result.fixes[2].whyItHelps, /7 of 7 varieties/);
  assert.deepEqual(result.fixPlan, {
    totalAddedUnits: 9, // 3 new varieties x the 3-unit minimum
    totalCost: null, // no price list in the repo
    objective: "units",
    sufficient: true,
  });
  // The last fix is the one that clears the category, and it says so.
  assert.deepEqual(result.fixes[2].clears, [
    "the dairy minimum of 7 varieties",
    "the dairy minimum of 21 units",
    "the 84-unit total",
  ]);
  assert.ok(result.fixes.slice(0, 2).every((f) => f.clears.length === 0));
  // Never suggest a variety that's already on the shelf.
  for (const fix of result.fixes) {
    for (const { variety } of dairy.items) {
      assert.ok(!fix.itemSuggestion.toLowerCase().includes(variety), `${fix.itemSuggestion} repeats ${variety}`);
    }
  }
});

// ---------------------------------------------------------------------------
test("accessory foods never count", async (t) => {
  await t.test("butter and jerky lines are excluded before counting", () => {
    const result = score([
      // 6 real dairy varieties (buttermilk included) plus butter, which would make 7 if it counted.
      ...stock("dairy", STAPLES.dairy.slice(0, 5)),
      line("dairy", ["Knudsen Lowfat Buttermilk, 1 qt", "buttermilk", "refrigerated"], 3),
      line("dairy", ["Land O Lakes Salted Butter Sticks, 1 lb", "butter", "refrigerated"], 4),
      ...stock("grains"),
      // 7 real protein varieties plus a jerky line the model mislabeled as "dried beef".
      ...stock("protein"),
      line("protein", ["Jack Link's Original Beef Jerky, 3.25 oz", "dried beef", "shelf_stable"], 6),
      ...stock("produce"),
    ]);
    const dairy = category(result, "dairy");
    const protein = category(result, "protein");

    assert.equal(dairy.varietiesFound, 6);
    assert.equal(dairy.unitsFound, 18);
    assert.equal(protein.varietiesFound, 7);
    assert.equal(protein.unitsFound, 21);
    assert.equal(result.totalUnits, 81);
    assert.equal(result.overallStatus, "fail");

    const counted = result.categories.flatMap((c) => c.items.map((i) => i.name));
    assert.ok(!counted.some((name) => /jerky|butter sticks/i.test(name)));
    assert.ok(counted.includes("Knudsen Lowfat Buttermilk, 1 qt"));
    assert.deepEqual(result.fixes.map((f) => f.category), ["dairy"]);
  });

  await t.test("re-checked for items that skip the partition step (e.g. seed data)", () => {
    const jerky = {
      description: "Old Trapper Peppered Beef Jerky, 10 oz",
      category: "protein",
      variety: "beef jerky",
      quantity: 6,
      packCount: 1,
      stockingUnits: 6,
      accessory: false,
      storage: "shelf_stable",
      perishable: false,
      confidence: 1,
    };
    const protein = category(buildScanResult([jerky], "Test Store", SCAN_DATE), "protein");
    assert.equal(protein.varietiesFound, 0);
    assert.deepEqual(protein.items, []);
  });

  await t.test("peanut butter is corrected for callers that skip partitioning", () => {
    const peanutButter = {
      description: "Store Brand Creamy Peanut Butter, 18 oz",
      category: "dairy",
      variety: "peanut butter",
      quantity: 3,
      packCount: 1,
      stockingUnits: 3,
      accessory: true,
      storage: "shelf_stable",
      perishable: false,
      confidence: 1,
    };

    const result = buildScanResult([peanutButter], "Test Store", SCAN_DATE);
    assert.equal(category(result, "dairy").varietiesFound, 0);
    assert.equal(category(result, "protein").varietiesFound, 1);
    assert.equal(category(result, "protein").unitsFound, 3);
  });
});

// ---------------------------------------------------------------------------
test("frozen storage is re-checked as perishable for direct scorecard callers", () => {
  const frozenChicken = {
    description: "Frozen Chicken Breast, 2 lb",
    category: "protein",
    variety: "chicken breast",
    quantity: 3,
    packCount: 1,
    stockingUnits: 3,
    accessory: false,
    storage: "frozen",
    // Deliberately stale: the deterministic engine must derive this from storage.
    perishable: false,
    confidence: 1,
  };

  const result = buildScanResult([frozenChicken], "Test Store", SCAN_DATE);
  assert.equal(category(result, "protein").hasPerishable, true);
  assert.equal(result.perishableCategoriesMet, 1);
});

// ---------------------------------------------------------------------------
test("units round down per line before a variety is checked", () => {
  // Partition rejects fractional units, so these go straight to the engine.
  const item = (description, variety, stockingUnits) => ({
    description,
    category: "produce",
    variety,
    quantity: null,
    packCount: null,
    stockingUnits,
    accessory: false,
    storage: "fresh",
    perishable: true,
    confidence: 1,
  });
  const produce = category(
    buildScanResult(
      [
        item("Bananas, per lb", "bananas", 3.7),
        item("Yellow Onions, 3 lb bag", "onions", 2.9),
        // 1.5 + 1.5 would be 3, but each line rounds down to 1 first.
        item("Russet Potatoes, 5 lb bag", "potatoes", 1.5),
        item("Russet Potatoes, 10 lb bag", "potatoes", 1.5),
      ],
      "Test Store",
      SCAN_DATE,
    ),
    "produce",
  );

  assert.equal(produce.varietiesFound, 1);
  assert.equal(produce.unitsFound, 3);
  assert.deepEqual(produce.items, [
    { name: "Bananas, per lb", variety: "bananas", units: 3, perishable: true },
  ]);
});

// ---------------------------------------------------------------------------
test("sample produce invoice, read as 1 unit per case, gives the expected result", () => {
  // The classify prompt returns packCount null for lines with no printed count
  // (bushel, box, 40 lb), and partition then excludes them. This fixture pins the
  // engine's math on the conservative reading, not the classifier's output.
  const produce = (text, variety, cases) => line("produce", [text, variety, "fresh"], cases);
  const result = score(
    [
      produce("Yam Louisiana / Mississippi 40 #", "sweet potatoes", 3),
      produce("Cooking Onion 16 / 3 #", "onions", 4),
      produce("Tomato 4x4", "tomatoes", 5),
      produce("Roma Tomato", "tomatoes", 1),
      produce("Hydro Tomato", "tomatoes", 4),
      produce("Tomato, Cluster (Vine)", "tomatoes", 10),
      produce("Tomato, Grape pint", "tomatoes", 10),
      produce("Green Pepper EX-Large", "green peppers", 8),
      produce("Select Cucumber bushel", "cucumbers", 2),
      produce("Green Cabbage Box", "cabbage", 2),
      produce("Lettuce, Head 24 ct Cello Wrap", "lettuce", 8),
      produce("Celery 24 ct No Sleeve", "celery", 6),
    ],
    "Wholesale Produce Distributor",
  );

  assert.equal(category(result, "produce").varietiesFound, 6);
  assert.equal(category(result, "produce").unitsFound, 59);
  assert.equal(result.totalUnits, 59);
  assert.equal(result.perishableCategoriesMet, 1);
  assert.equal(result.overallStatus, "fail");

  // Best produce fix: one unit, topping up a variety the store already buys.
  // Produce is six varieties short of nothing — it has six and a 2-unit
  // near miss — so a single unit is the whole of its gap.
  const produceFixes = result.fixes.filter((f) => f.category === "produce");
  assert.equal(produceFixes.length, 1);
  assert.equal(produceFixes[0].itemSuggestion, "Select Cucumber bushel (stock 1 more)");
  assert.equal(produceFixes[0].addedUnits, 1);
  assert.match(produceFixes[0].whyItHelps, /^You already stock 2 units of cucumbers/);
  assert.match(produceFixes[0].whyItHelps, /7 of 7 varieties/);

  // The three empty categories need seven varieties each, and the plan buys
  // exactly that: 21 new varieties at 3 units, plus the one cucumber unit.
  for (const empty of ["dairy", "grains", "protein"]) {
    assert.equal(result.fixes.filter((f) => f.category === empty).length, 7, empty);
  }
  assert.equal(result.fixPlan.totalAddedUnits, 64);
  assert.equal(result.fixPlan.sufficient, true);
});

// ---------------------------------------------------------------------------
test("a store that only misses the perishable rule still gets fixes", () => {
  const shelfStable = (c) => stock(c).map((l) => ({ ...l, storage: "shelf_stable" }));
  const result = score([
    ...shelfStable("dairy"),
    ...shelfStable("grains"),
    ...shelfStable("protein"),
    ...stock("produce"),
  ]);

  assert.equal(result.perishableCategoriesMet, 1);
  assert.equal(result.overallStatus, "fail");
  // Three categories lack a perishable but the rule only asks for three of four,
  // so two additions clear it. Suggesting a third would be advice to overbuy.
  assert.equal(result.fixes.length, 2);
  assert.equal(new Set(result.fixes.map((f) => f.category)).size, 2);
  assert.ok(result.fixes.every((f) => /perishable/.test(f.whyItHelps)));
  assert.equal(result.fixPlan.totalAddedUnits, 6);
  assert.equal(result.fixPlan.sufficient, true);
  // Only the second one actually clears the rule.
  assert.deepEqual(result.fixes[1].clears, ["the perishable rule, 3 of 4 categories"]);
});

// ---------------------------------------------------------------------------
test("output has the same shape as MOCK_RESULT", () => {
  const { items } = partitionClassifiedItems([
    ...stock("dairy", STAPLES.dairy.slice(0, 4)),
    ...stock("grains"),
    ...stock("protein"),
    ...stock("produce"),
  ]);
  const result = buildScanResult(items, "Rivera's Corner Market");

  const keys = (o) => Object.keys(o).sort();
  assert.deepEqual(keys(result), keys(MOCK_RESULT));
  assert.match(result.scanDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(
    result.categories.map((c) => [c.category, c.label]),
    MOCK_RESULT.categories.map((c) => [c.category, c.label]),
  );
  assert.deepEqual(keys(result.categories[0]), keys(MOCK_RESULT.categories[0]));
  assert.deepEqual(keys(result.categories[0].items[0]), keys(MOCK_RESULT.categories[0].items[0]));
  assert.deepEqual(keys(result.fixes[0]), keys(MOCK_RESULT.fixes[0]));
});

test("no items gives an all-zero failing scorecard", () => {
  const result = buildScanResult([], "Test Store", SCAN_DATE);
  assert.equal(result.overallStatus, "fail");
  assert.equal(result.totalUnits, 0);
  assert.equal(result.categories.length, 4);
  // Nothing on the shelf means the plan is the standard itself: four categories
  // x seven varieties x three units.
  assert.equal(result.fixes.length, 28);
  assert.equal(result.fixPlan.totalAddedUnits, 84);
  assert.equal(result.fixPlan.sufficient, true);
});

// ---------------------------------------------------------------------------
test("scanDate is the Los Angeles date, not the server's UTC date", () => {
  assert.equal(buildScanResult([], "Test Store", SCAN_DATE).scanDate, "2026-09-12");
  // 1 am the next morning in Los Angeles.
  assert.equal(buildScanResult([], "Test Store", new Date("2026-09-13T08:00:00Z")).scanDate, "2026-09-13");
});

// ---------------------------------------------------------------------------
test("the Spanish scorecard has the same numbers, with Spanish labels and fixes", () => {
  // The sample produce invoice again: a near-miss top-up plus new-item fixes.
  const produce = (text, variety, cases) => line("produce", [text, variety, "fresh"], cases);
  const { items } = partitionClassifiedItems([
    produce("Cooking Onion 16 / 3 #", "onions", 4),
    produce("Tomato 4x4", "tomatoes", 5),
    produce("Select Cucumber bushel", "cucumbers", 2),
    produce("Lettuce, Head 24 ct Cello Wrap", "lettuce", 8),
  ]);
  const en = buildScanResult(items, "Tienda Rivera", SCAN_DATE);
  const es = buildScanResult(items, "Tienda Rivera", SCAN_DATE, "es");

  // Everything but the words is identical.
  const numbers = ({ categories, fixes, ...rest }) => ({
    ...rest,
    categories: categories.map((c) => ({ ...c, label: "" })),
    fixes: fixes.map((f) => f.category),
  });
  assert.deepEqual(numbers(es), numbers(en));

  assert.deepEqual(
    es.categories.map((c) => c.label),
    ["Lácteos", "Granos", "Proteínas", "Frutas y verduras"],
  );

  const [topUp] = es.fixes.filter((f) => f.category === "produce");
  assert.equal(topUp.itemSuggestion, "Select Cucumber bushel (surta 1 más)");
  assert.equal(
    topUp.whyItHelps,
    "Ya tiene 2 unidades de cucumbers; con 1 más cumple el mínimo de 3 unidades y lleva las frutas y verduras a 4 de 7 variedades.",
  );

  const [firstDairy] = es.fixes.filter((f) => f.category === "dairy");
  assert.equal(firstDairy.itemSuggestion, "Leche evaporada Carnation, lata de 12 oz (surta 3)");
  assert.equal(
    firstDairy.whyItHelps,
    "Se conserva sin refrigeración y no ocupa espacio en el refrigerador. Surtir 3 lleva los lácteos a 1 de 7 variedades.",
  );
  // The requirement each fix clears is reported in Spanish too.
  const clearing = es.fixes.filter((f) => f.clears.length > 0);
  assert.ok(clearing.length > 0);
  assert.ok(
    clearing.every((f) => f.clears.every((phrase) => /^(el|la)\s/.test(phrase))),
    JSON.stringify(clearing.map((f) => f.clears)),
  );

  // No English template text leaks into Spanish fixes.
  for (const fix of es.fixes) {
    assert.doesNotMatch(`${fix.itemSuggestion} ${fix.whyItHelps}`, /\b(stock|brings|gives|varieties|units?|already)\b/i);
  }
});

test("a Spanish store that only misses the perishable rule gets Spanish fixes", () => {
  const shelfStable = (c) => stock(c).map((l) => ({ ...l, storage: "shelf_stable" }));
  const { items } = partitionClassifiedItems([
    ...shelfStable("dairy"),
    ...shelfStable("grains"),
    ...shelfStable("protein"),
    ...stock("produce"),
  ]);
  const es = buildScanResult(items, "Test Store", SCAN_DATE, "es");

  // Two categories, same as the English plan — the rule asks for three of four.
  assert.equal(es.fixes.length, 2);
  assert.match(
    es.fixes[0].whyItHelps,
    /le da a (los|las) [^.]+ un producto perecedero, necesario en 3 de 4 categorías\.$/,
  );
});

test("every fix suggestion has its own Spanish text", () => {
  for (const [category, suggestions] of Object.entries(SUGGESTIONS)) {
    for (const s of suggestions) {
      assert.ok(s.es.itemSuggestion && s.es.pitch, `${category} ${s.variety} is missing Spanish`);
      assert.notEqual(s.es.itemSuggestion, s.en.itemSuggestion, `${category} ${s.variety}`);
      assert.notEqual(s.es.pitch, s.en.pitch, `${category} ${s.variety}`);
      assert.match(s.es.itemSuggestion, /\(surta 3\)$/, `${category} ${s.variety}`);
    }
  }
});
