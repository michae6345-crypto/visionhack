/**
 * Unit tests for the eval metrics (eval/metrics.mjs).
 *
 * A metric that is quietly wrong is worse than no metric: it publishes a number
 * nobody rechecks. These are hand-worked examples small enough to verify by
 * reading them, covering the decisions that make the difference between an
 * honest figure and a flattering one — held-back lines not being averaged in as
 * zero error, an overcount being distinguished from an undercount, and a false
 * pass from a false fail.
 *
 *   npm test
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  byTag,
  categoryConfusion,
  countedConfusion,
  fieldAccuracy,
  number,
  percent,
  unitsPerPackError,
  verdictAgreement,
} from "../eval/metrics.mjs";

const CATEGORIES = ["dairy", "grains", "protein", "produce"];

/** One (truth, prediction) pair, with sensible defaults. */
const pair = (truth, predicted, extra = {}) => ({
  fixture: "test",
  lineText: "A LINE",
  tags: [],
  truth: { counted: true, ...truth },
  counted: predicted !== null,
  reason: null,
  predicted,
  ...extra,
});

// ---------------------------------------------------------------------------
test("field accuracy ignores fields the truth leaves open", () => {
  const pairs = [
    pair({ unitsPerPack: 12 }, { unitsPerPack: 12 }),
    pair({ unitsPerPack: 24 }, { unitsPerPack: 6 }),
    // A line no reader could count has no expected value, so it is not scored.
    pair({ counted: false, unitsPerPack: null }, { unitsPerPack: null }),
  ];
  const result = fieldAccuracy(pairs, "unitsPerPack");

  assert.equal(result.considered, 2);
  assert.equal(result.agreed, 1);
  assert.equal(result.rate, 0.5);
  assert.equal(result.misses.length, 1);
  assert.deepEqual(result.misses[0].expected, 24);
  assert.deepEqual(result.misses[0].actual, 6);
});

test("field accuracy compares strings case- and space-insensitively", () => {
  const pairs = [
    pair({ variety: "Whole Milk" }, { variety: "whole milk" }),
    pair({ variety: "roma tomato" }, { variety: " ROMA   TOMATO " }),
    pair({ variety: "cheddar cheese" }, { variety: "cheese" }),
  ];
  assert.equal(fieldAccuracy(pairs, "variety").agreed, 2);
});

test("a missing prediction counts as a miss, not as a skip", () => {
  const pairs = [pair({ variety: "whole milk" }, null)];
  const result = fieldAccuracy(pairs, "variety");
  assert.equal(result.considered, 1);
  assert.equal(result.agreed, 0);
});

// ---------------------------------------------------------------------------
test("counting confusion separates overcounts from undercounts", () => {
  const pairs = [
    pair({ counted: true }, { units: 12 }), // right
    pair({ counted: false }, null), // right
    pair({ counted: true }, null), // held back but countable: undercount
    pair({ counted: false }, { units: 25 }), // counted but uncountable: OVERCOUNT
  ];
  const result = countedConfusion(pairs);

  assert.equal(result.countedBoth, 1);
  assert.equal(result.heldBoth, 1);
  assert.equal(result.undercounted, 1);
  assert.equal(result.overcounted, 1);
  assert.equal(result.total, 4);
  assert.equal(result.rate, 0.5);
  // The overcount is reported with the units it wrongly credited, because that
  // is the number that could push a store over a threshold it has not met.
  assert.equal(result.overcounts.length, 1);
  assert.equal(result.overcounts[0].units, 25);
  assert.equal(result.undercounts.length, 1);
});

// ---------------------------------------------------------------------------
test("category confusion keeps held-back lines in their own column", () => {
  const pairs = [
    pair({ counted: true, category: "dairy" }, { category: "dairy" }),
    pair({ counted: true, category: "dairy" }, { category: "protein" }),
    pair({ counted: true, category: "produce" }, null), // dropped entirely
    // Uncountable, so its category is not scored either way.
    pair({ counted: false, category: "protein" }, null),
  ];
  const result = categoryConfusion(pairs, CATEGORIES);

  assert.equal(result.considered, 3);
  assert.equal(result.correct, 1);
  assert.equal(result.matrix.dairy.dairy, 1);
  assert.equal(result.matrix.dairy.protein, 1);
  assert.equal(result.matrix.produce.held, 1);
  // The accessory line contributed nothing to any row.
  assert.equal(Object.values(result.matrix.protein).reduce((a, b) => a + b, 0), 0);
});

// ---------------------------------------------------------------------------
test("units-per-pack error never averages a missing prediction in as zero", () => {
  const pairs = [
    pair({ unitsPerPack: 12 }, { unitsPerPack: 12 }), // error 0
    pair({ unitsPerPack: 24 }, { unitsPerPack: 20 }), // error 4
    pair({ unitsPerPack: 16 }, { unitsPerPack: null }), // no prediction
  ];
  const result = unitsPerPackError(pairs);

  assert.equal(result.compared, 2);
  assert.equal(result.noPrediction, 1);
  assert.equal(result.mae, 2); // (0 + 4) / 2, not (0 + 4 + 0) / 3
  assert.equal(result.exact, 1);
  assert.equal(result.exactRate, 0.5);
  assert.equal(result.worst[0].error, 4);
});

test("units-per-pack error is null when there is nothing to compare", () => {
  const result = unitsPerPackError([pair({ counted: false, unitsPerPack: null }, null)]);
  assert.equal(result.compared, 0);
  assert.equal(result.mae, null);
  assert.equal(result.exactRate, null);
});

// ---------------------------------------------------------------------------
test("verdict agreement tells a false pass from a false fail", () => {
  const row = (varieties, units, perishable) => ({ varieties, units, perishable });
  const card = (overall, dairy) => ({
    overall,
    categories: { dairy, grains: row(7, 21, true), protein: row(7, 21, true), produce: row(7, 21, true) },
  });

  const result = verdictAgreement([
    { fixture: "a", expected: card("pass", row(7, 21, true)), actual: card("pass", row(7, 21, true)) },
    // Says pass when the human says fail: the error that matters most.
    { fixture: "b", expected: card("fail", row(6, 18, true)), actual: card("pass", row(7, 21, true)) },
    // Says fail when the human says pass: wrong, but in the safe direction.
    { fixture: "c", expected: card("pass", row(7, 21, true)), actual: card("fail", row(6, 18, true)) },
  ]);

  assert.equal(result.records, 3);
  assert.equal(result.verdictAgreed, 1);
  assert.equal(percent(result.verdictRate), "33.3%");
  assert.equal(result.falsePasses, 1);
  assert.equal(result.falseFails, 1);
  assert.deepEqual(
    result.disagreements.map((d) => [d.fixture, d.direction]),
    [
      ["b", "false pass"],
      ["c", "false fail"],
    ],
  );

  // Row agreement is the harder test: 12 rows, 2 of them wrong.
  assert.equal(result.categoryRows, 12);
  assert.equal(result.categoryRowsAgreed, 10);
});

test("a record can reach the right verdict with the wrong numbers", () => {
  const rows = (varieties) => ({
    dairy: { varieties, units: varieties * 3, perishable: true },
    grains: { varieties: 7, units: 21, perishable: true },
    protein: { varieties: 7, units: 21, perishable: true },
    produce: { varieties: 7, units: 21, perishable: true },
  });
  const result = verdictAgreement([
    { fixture: "a", expected: { overall: "fail", categories: rows(3) }, actual: { overall: "fail", categories: rows(5) } },
  ]);

  assert.equal(result.verdictRate, 1); // the verdict agrees
  assert.equal(result.varietyRowsAgreed, 3); // and three of four rows do not
  assert.equal(result.categoryRowsAgreed, 3);
});

// ---------------------------------------------------------------------------
test("per-tag breakdown only reports tags with lines", () => {
  const pairs = [
    { ...pair({ counted: false, unitsPerPack: null }, null), tags: ["weight-only"] },
    { ...pair({ counted: true, unitsPerPack: 12 }, { unitsPerPack: 12 }), tags: ["multi-pack"] },
  ];
  const result = byTag(pairs, ["weight-only", "multi-pack", "handwritten"]);

  assert.deepEqual(Object.keys(result), ["weight-only", "multi-pack"]);
  assert.equal(result["weight-only"].lines, 1);
  assert.equal(result["weight-only"].countedCorrectly, 1);
  assert.equal(result["multi-pack"].unitsPerPack.mae, 0);
});

// ---------------------------------------------------------------------------
test("formatters say n/a rather than inventing a zero", () => {
  assert.equal(percent(null), "n/a");
  assert.equal(percent(undefined), "n/a");
  assert.equal(percent(0), "0.0%");
  assert.equal(percent(1), "100.0%");
  assert.equal(percent(0.8421), "84.2%");
  assert.equal(number(null), "n/a");
  assert.equal(number(0), "0.00");
  assert.equal(number(1.4159), "1.42");
});
