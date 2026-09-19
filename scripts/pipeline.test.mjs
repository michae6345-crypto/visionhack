/**
 * Unit tests for the OpenRouter single-tool request shape and error mapping.
 *
 * `global.fetch` is stubbed, so these make NO network call and need NO key —
 * they run in CI alongside the scoring-rule tests. They exist because the live
 * smoke test is the only other thing that exercises this file, and that needs
 * both a key and reachable egress.
 *
 * The contract under test: each pass declares exactly ONE function and accepts
 * only a single correctly-named, schema-valid tool call. OpenRouter's sole
 * Nemotron endpoint currently rejects every explicit `tool_choice` value, so
 * the request omits it and the response parser fails closed if the model does
 * not call the declared function. Prose in message.content is never an answer.
 *
 *   npm test
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { decisionSignature } from "./smoke-signature.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const constants = require(resolve(root, ".smoke-build/rules/constants.js"));
const { extractRawLines, classifyLines, ScanPipelineError } = require(
  resolve(root, ".smoke-build/vision/pipeline.js"),
);
const { partitionClassifiedItems } = require(
  resolve(root, ".smoke-build/rules/partition.js"),
);
const { buildScanResult } = require(resolve(root, ".smoke-build/rule-engine.js"));

const VALID_EXTRACTION = {
  lines: [{ lineText: "WHL MLK", packSize: "6/1 GAL", quantity: "2", legible: true }],
};
const VALID_CLASSIFICATION = {
  items: [{
    sourceLineText: "WHL MLK",
    category: "dairy",
    variety: "whole milk",
    packCount: 6,
    quantity: 2,
    storage: "refrigerated",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }],
};
const EXTRACT_ARGS = JSON.stringify(VALID_EXTRACTION);
const CLASSIFY_ARGS = JSON.stringify(VALID_CLASSIFICATION);
const EXTRACT_TOOL = constants.EXTRACT_TOOL_NAME;
const CLASSIFY_TOOL = constants.CLASSIFY_TOOL_NAME;

/** OpenRouter-shaped envelope carrying one declared tool call. */
function toolCompletion(name, args, extra = {}) {
  return {
    choices: [
      {
        message: {
          // Reasoning models emit prose next to the call. It must be ignored.
          content: "Let me think about this invoice...",
          tool_calls: [
            { id: "call_1", type: "function", function: { name, arguments: args } },
          ],
          ...(extra.message ?? {}),
        },
        finish_reason: extra.finishReason ?? "tool_calls",
      },
    ],
  };
}

/** An envelope whose message is whatever the test needs. */
function rawCompletion(message, extra = {}) {
  return { choices: [{ message, finish_reason: extra.finishReason ?? "stop" }] };
}

/**
 * Swap in a fetch stub for one call, capturing the request. Always restores,
 * so a failing assertion cannot leak the stub into the next test.
 */
async function withFetch(impl, run) {
  const captured = {};
  const real = global.fetch;
  global.fetch = async (url, init) => {
    captured.url = url;
    captured.init = init;
    captured.body = JSON.parse(init.body);
    return impl(captured);
  };
  process.env.OPENROUTER_API_KEY = "sk-or-test-not-a-real-key";
  try {
    return { captured, result: await run() };
  } finally {
    global.fetch = real;
    delete process.env.OPENROUTER_API_KEY;
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Run `fn` and return the ScanPipelineError it threw. */
async function caught(fn) {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the pipeline to throw");
}

/** Drive one pass with a canned upstream response. */
function runExtract(impl) {
  return withFetch(impl, () => extractRawLines("QUJD", "image/png"));
}
function failExtract(impl) {
  return withFetch(impl, () => caught(() => extractRawLines("QUJD", "image/png")));
}

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------
test("pass 1 sends the image as a data URL, before the text part", async () => {
  const { captured, result } = await runExtract(() =>
    jsonResponse(toolCompletion(EXTRACT_TOOL, EXTRACT_ARGS)),
  );

  assert.equal(captured.url, constants.OPENROUTER_API_URL);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.Authorization, "Bearer sk-or-test-not-a-real-key");

  const [system, user] = captured.body.messages;
  assert.equal(system.role, "system");
  assert.equal(user.role, "user");
  assert.equal(user.content[0].type, "image_url");
  assert.equal(user.content[0].image_url.url, "data:image/png;base64,QUJD");
  assert.equal(user.content[1].type, "text");

  assert.deepEqual(result, VALID_EXTRACTION);
});

test("both passes use the exact Nemotron model id at temperature 0", async () => {
  assert.equal(constants.MODEL, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");

  for (const [tool, args, run] of [
    [EXTRACT_TOOL, EXTRACT_ARGS, () => extractRawLines("QUJD", "image/png")],
    [CLASSIFY_TOOL, CLASSIFY_ARGS, () => classifyLines(VALID_EXTRACTION)],
  ]) {
    const { captured } = await withFetch(
      () => jsonResponse(toolCompletion(tool, args)),
      run,
    );
    assert.equal(captured.body.model, constants.MODEL, tool);
    assert.equal(captured.body.temperature, 0, tool);
  }
});

test("neither pass sends response_format — Nemotron would reject it", async () => {
  for (const [tool, args, run] of [
    [EXTRACT_TOOL, EXTRACT_ARGS, () => extractRawLines("QUJD", "image/png")],
    [CLASSIFY_TOOL, CLASSIFY_ARGS, () => classifyLines(VALID_EXTRACTION)],
  ]) {
    const { captured } = await withFetch(
      () => jsonResponse(toolCompletion(tool, args)),
      run,
    );
    assert.equal(captured.body.response_format, undefined, tool);
    assert.equal("response_format" in captured.body, false, tool);
  }
});

test("each pass declares one function from its Zod schema", async () => {
  for (const [tool, args, run] of [
    [EXTRACT_TOOL, EXTRACT_ARGS, () => extractRawLines("QUJD", "image/png")],
    [CLASSIFY_TOOL, CLASSIFY_ARGS, () => classifyLines(VALID_EXTRACTION)],
  ]) {
    const { captured } = await withFetch(
      () => jsonResponse(toolCompletion(tool, args)),
      run,
    );

    // Exactly one tool, so there is nothing to choose between.
    assert.equal(captured.body.tools.length, 1, tool);
    const fn = captured.body.tools[0].function;
    assert.equal(captured.body.tools[0].type, "function", tool);
    assert.equal(fn.name, tool);
    assert.equal(typeof fn.description, "string", tool);

    // Schema generated from Zod, with the dialect key stripped.
    assert.equal(fn.parameters.$schema, undefined, tool);
    assert.equal(fn.parameters.type, "object", tool);
    assert.equal(fn.parameters.additionalProperties, false, tool);
    assert.ok(Array.isArray(fn.parameters.required), tool);

    // Must still route only to providers that honour the declared tool.
    assert.equal(captured.body.provider.require_parameters, true, tool);
  }
});

test("both passes omit tool_choice because Nemotron's live endpoint rejects every explicit value", async () => {
  for (const [tool, args, run] of [
    [EXTRACT_TOOL, EXTRACT_ARGS, () => extractRawLines("QUJD", "image/png")],
    [CLASSIFY_TOOL, CLASSIFY_ARGS, () => classifyLines(VALID_EXTRACTION)],
  ]) {
    const { captured } = await withFetch(
      () => jsonResponse(toolCompletion(tool, args)),
      run,
    );
    assert.equal("tool_choice" in captured.body, false, tool);
  }
});

test("both passes disable reasoning to stay within the scan route's latency budget", async () => {
  for (const [tool, args, run] of [
    [EXTRACT_TOOL, EXTRACT_ARGS, () => extractRawLines("QUJD", "image/png")],
    [CLASSIFY_TOOL, CLASSIFY_ARGS, () => classifyLines(VALID_EXTRACTION)],
  ]) {
    const { captured } = await withFetch(
      () => jsonResponse(toolCompletion(tool, args)),
      run,
    );
    assert.deepEqual(captured.body.reasoning, { effort: "none", exclude: true }, tool);
  }
});

test("the extraction tool schema matches the Zod schema's own shape", async () => {
  const { captured } = await runExtract(() =>
    jsonResponse(toolCompletion(EXTRACT_TOOL, EXTRACT_ARGS)),
  );
  const params = captured.body.tools[0].function.parameters;
  assert.deepEqual(params.required, ["lines"]);
  const line = params.properties.lines.items;
  assert.deepEqual(line.required.sort(), ["legible", "lineText", "packSize", "quantity"]);
  assert.equal(line.additionalProperties, false);
});

test("classification short-circuits with no lines, making no request", async () => {
  let called = false;
  const real = global.fetch;
  global.fetch = async () => {
    called = true;
    return jsonResponse(toolCompletion(CLASSIFY_TOOL, "{}"));
  };
  try {
    assert.deepEqual(await classifyLines({ lines: [] }), { items: [] });
    assert.equal(called, false);
  } finally {
    global.fetch = real;
  }
});

test("classification reconciles the supplied produce invoice to explicit counts only", async () => {
  const raw = {
    lines: [
      { lineText: "35150 Yam Louisiana / Mississippi 40 #", packSize: "40 #", quantity: "3", legible: true },
      { lineText: "25010 Cooking Onion 16 / 3 #", packSize: "16 / 3 #", quantity: "4", legible: true },
      { lineText: "60082 Tomato 4x4", packSize: "4x4", quantity: "5", legible: true },
      { lineText: "60070 Roma Tomato", packSize: null, quantity: "1", legible: true },
      { lineText: "60050 Hydro Tomato", packSize: null, quantity: "4", legible: true },
      { lineText: "60020 Tomato, Cluster (Vine)", packSize: null, quantity: "10", legible: true },
      { lineText: "60030 Tomato, Grape pint", packSize: "pint", quantity: "10", legible: true },
      { lineText: "30040 Green Pepper EX-Large", packSize: null, quantity: "8", legible: true },
      { lineText: "13010 Select Cucumber bushel", packSize: "bushel", quantity: "2", legible: true },
      { lineText: "7010 Green Cabbage Box", packSize: "Box", quantity: "2", legible: true },
      { lineText: "20060 Lettuce, Head 24 ct Cello Wrap", packSize: "24 ct", quantity: "8", legible: true },
      { lineText: "10010 Celery 24 ct No Sleeve", packSize: "24 ct", quantity: "6", legible: true },
    ],
  };
  const varieties = [
    "yam louisiana mississippi",
    "cooking onion",
    "tomato 4x4",
    "roma tomato",
    "hydro tomato",
    "tomato cluster vine",
    "tomato grape pint",
    "green pepper ex-large",
    "select cucumber bushel",
    "green cabbage box",
    "lettuce head 24 ct cello wrap",
    "celery 24 ct no sleeve",
  ];
  const unsafeItems = raw.lines.map((line, index) => ({
    sourceLineText: line.lineText,
    category: "produce",
    variety: varieties[index],
    packCount: 16,
    quantity: 99,
    storage: "shelf_stable",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }));

  const { result: classified } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items: unsafeItems }))),
    () => classifyLines(raw),
  );
  assert.deepEqual(
    classified.items.map((item) => item.storage),
    Array(raw.lines.length).fill("fresh"),
  );
  const partitioned = partitionClassifiedItems(classified.items);

  assert.deepEqual(
    partitioned.items.map((item) => [item.description, item.quantity, item.packCount, item.stockingUnits]),
    [
      ["25010 Cooking Onion 16 / 3 #", 4, 16, 64],
      ["20060 Lettuce, Head 24 ct Cello Wrap", 8, 24, 192],
      ["10010 Celery 24 ct No Sleeve", 6, 24, 144],
    ],
  );
  assert.equal(partitioned.excluded.length, 9);
  assert.deepEqual(partitioned.varietyCounts, {
    dairy: 0,
    grains: 0,
    protein: 0,
    produce: 3,
  });
  assert.equal(partitioned.items.reduce((sum, item) => sum + item.stockingUnits, 0), 400);
  assert.ok(partitioned.items.every((item) => item.storage === "fresh" && item.perishable));

  const scorecard = buildScanResult(
    partitioned.items,
    "",
    new Date("2026-09-12T12:00:00-07:00"),
  );
  assert.equal(scorecard.overallStatus, "fail");
  assert.equal(scorecard.totalUnits, 400);
  assert.equal(scorecard.perishableCategoriesMet, 1);
  assert.deepEqual(
    scorecard.categories.map((category) => [
      category.category,
      category.varietiesFound,
      category.unitsFound,
      category.hasPerishable,
    ]),
    [
      ["dairy", 0, 0, false],
      ["grains", 0, 0, false],
      ["protein", 0, 0, false],
      ["produce", 3, 400, true],
    ],
  );
});

/** Classify `raw` with a model that guesses 16 per pack and 99 packs on every line. */
async function classifyWithUnsafeGuesses(raw, category = "produce") {
  const items = raw.lines.map((line) => ({
    sourceLineText: line.lineText,
    category,
    variety: line.lineText.toLowerCase().replace(/^\d+\s+/, ""),
    packCount: 16,
    quantity: 99,
    storage: "fresh",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }));
  const { result } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
    () => classifyLines(raw),
  );
  return result;
}

test("classification reads produce case counts printed inside the description", async () => {
  // A live scan of the supplied invoice (2026-09-12) counted none of its 12
  // lines: the pack sizes are printed in the description, not a pack column.
  const raw = {
    lines: [
      ["35150 Yam Louisiana / Mississippi 40 #", "3"],
      ["25010 Cooking Onion 16 / 3 #", "4"],
      ["60082 Tomato 4x4", "5"],
      ["60070 Roma Tomato", "1"],
      ["60050 Hydro Tomato", "4"],
      ["60020 Tomato, Cluster (Vine)", "10"],
      ["60030 Tomato, Grape pint", "10"],
      ["30040 Green Pepper EX-Large", "8"],
      ["13010 Select Cucumber bushel", "2"],
      ["7010 Green Cabbage Box", "2"],
      ["20060 Lettuce, Head 24 ct Cello Wrap", "8"],
      ["10010 Celery 24 ct No Sleeve", "6"],
    ].map(([lineText, quantity]) => ({ lineText, packSize: null, quantity, legible: true })),
  };

  const classified = await classifyWithUnsafeGuesses(raw);
  const partitioned = partitionClassifiedItems(classified.items);

  assert.deepEqual(
    partitioned.items.map((item) => [item.description, item.quantity, item.packCount, item.stockingUnits]),
    [
      ["25010 Cooking Onion 16 / 3 #", 4, 16, 64],
      ["20060 Lettuce, Head 24 ct Cello Wrap", 8, 24, 192],
      ["10010 Celery 24 ct No Sleeve", 6, 24, 144],
    ],
  );
  assert.equal(partitioned.excluded.length, 9);
  assert.ok(
    partitioned.excluded.every((line) => line.reason === "Could not determine the pack count."),
  );
  assert.deepEqual(partitioned.varietyCounts, { dairy: 0, grains: 0, protein: 0, produce: 3 });
  assert.equal(partitioned.items.reduce((sum, item) => sum + item.stockingUnits, 0), 400);
});

test("produce pack counts are read when pass 1 copies extra words into packSize", async () => {
  const raw = {
    lines: [
      { lineText: "20060 Lettuce, Head 24 ct Cello Wrap", packSize: "24 ct Cello Wrap", quantity: "8", legible: true },
      { lineText: "10010 Celery 24 ct No Sleeve", packSize: "Celery 24 ct No Sleeve", quantity: "6", legible: true },
    ],
  };

  const classified = await classifyWithUnsafeGuesses(raw);

  assert.deepEqual(classified.items.map((item) => item.packCount), [24, 24]);
});

test("description pack counts stay unknown outside unambiguous whole produce", async () => {
  const produce = {
    lines: [
      // Two different counts: no way to tell which is the case pack.
      { lineText: "LETTUCE 12 CT 24 CT", packSize: null, quantity: "2", legible: true },
      { lineText: "20060 Lettuce, Head 24 ct Cello Wrap", packSize: "12 ct wrap", quantity: "8", legible: true },
      // Prepared or preserved produce is not on the whole-produce allowlist.
      { lineText: "FROZEN BROCCOLI 12 CT", packSize: null, quantity: "4", legible: true },
      // A leading item code is not a pack, and a weight or grade is not a count.
      { lineText: "24 Roma Tomato", packSize: null, quantity: "3", legible: true },
      { lineText: "Yam 40 #", packSize: null, quantity: "3", legible: true },
      { lineText: "Tomato 4x4", packSize: null, quantity: "5", legible: true },
    ],
  };
  // Packaged goods: "10 ct" in the name is one retail pack, not the case.
  const packaged = {
    lines: [
      { lineText: "MISSION FLOUR TORTILLAS 10 CT", packSize: null, quantity: "12", legible: true },
    ],
  };
  // The model must also call it produce.
  const miscategorized = {
    lines: [
      { lineText: "10010 Celery 24 ct No Sleeve", packSize: null, quantity: "6", legible: true },
    ],
  };

  for (const [raw, category] of [[produce, "produce"], [packaged, "grains"], [miscategorized, "grains"]]) {
    const classified = await classifyWithUnsafeGuesses(raw, category);
    assert.deepEqual(
      classified.items.map((item) => item.packCount),
      raw.lines.map(() => null),
      raw.lines.map((line) => line.lineText).join(" | "),
    );
  }
});

test("classification accepts common explicit multipack formats", async () => {
  const raw = {
    lines: [
      { lineText: "WHL MLK", packSize: "6/1 GAL", quantity: "2", legible: true },
      { lineText: "GREEK YOGURT", packSize: "24 x 5.3 OZ", quantity: "3", legible: true },
      { lineText: "PAPER TOWELS", packSize: "30 ROLL", quantity: "4", legible: true },
    ],
  };
  const items = raw.lines.map((line) => ({
    sourceLineText: line.lineText,
    category: "dairy",
    variety: line.lineText.toLowerCase(),
    packCount: 999,
    quantity: 999,
    storage: "refrigerated",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }));

  const { result } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
    () => classifyLines(raw),
  );

  assert.deepEqual(
    result.items.map((item) => [item.quantity, item.packCount]),
    [[2, 6], [3, 24], [4, 30]],
  );
});

test("classification accepts whole-number decimal quantities but rejects fractions", async () => {
  const raw = {
    lines: [
      { lineText: "WHOLE MILK", packSize: "6/1 GAL", quantity: "2.00", legible: true },
      { lineText: "HALF CASE MILK", packSize: "6/1 GAL", quantity: "2.5", legible: true },
    ],
  };
  const items = raw.lines.map((line) => ({
    sourceLineText: line.lineText,
    category: "dairy",
    variety: line.lineText.toLowerCase(),
    packCount: 999,
    quantity: 999,
    storage: "refrigerated",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }));

  const { result } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
    () => classifyLines(raw),
  );

  assert.deepEqual(result.items.map((item) => item.quantity), [2, null]);
});

test("fresh-produce correction preserves explicit frozen, preserved and prepared foods", async () => {
  const raw = {
    lines: [
      { lineText: "ROMA TOMATO", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "CANNED TOMATOES", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "FROZEN BROCCOLI", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "DRIED TOMATOES", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "TOMATO SAUCE", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "POTATO CHIPS", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "ONION POWDER", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "TOMATO PUREE", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "CRISPY FRIED ONIONS", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "TOMATOES IN BRINE", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "BANANA FLOUR", packSize: "3 CT", quantity: "1", legible: true },
      { lineText: "TOMATOES CAN", packSize: "3 CT", quantity: "1", legible: true },
    ],
  };
  const items = raw.lines.map((line, index) => ({
    sourceLineText: line.lineText,
    category: "produce",
    variety: line.lineText.toLowerCase(),
    packCount: 3,
    quantity: 1,
    storage: index === 2 ? "frozen" : "shelf_stable",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  }));

  const { result } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
    () => classifyLines(raw),
  );

  assert.deepEqual(
    result.items.map((item) => item.storage),
    [
      "fresh",
      "shelf_stable",
      "frozen",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
      "shelf_stable",
    ],
  );
});

function signatureBody() {
  return {
    ok: true,
    items: [{
      description: "ROMA TOMATO",
      category: "produce",
      variety: "Roma Tomato",
      quantity: 1,
      packCount: 3,
      stockingUnits: 3,
      accessory: false,
      storage: "fresh",
      perishable: true,
      confidence: 0.7,
    }],
    excluded: [{
      description: "BOX",
      category: "produce",
      reason: "Low confidence (0.70).",
    }],
    varietyCounts: { dairy: 0, grains: 0, protein: 0, produce: 1 },
    scorecard: {
      overallStatus: "fail",
      totalUnits: 3,
      perishableCategoriesMet: 1,
      categories: [{
        category: "produce",
        varietiesFound: 1,
        unitsFound: 3,
        hasPerishable: true,
      }],
    },
  };
}

test("smoke consistency ignores confidence and free-form exclusion explanations", () => {
  const first = signatureBody();
  const second = structuredClone(first);
  second.items[0].confidence = 0.71;
  second.excluded[0].reason = "Insufficiently certain classification (0.71).";

  assert.equal(decisionSignature(first), decisionSignature(second));
});

test("smoke consistency normalizes variety keys but detects changed grouping", () => {
  const first = signatureBody();
  const normalized = structuredClone(first);
  normalized.items[0].variety = "  roma TOMATO  ";
  const regrouped = structuredClone(first);
  regrouped.items[0].variety = "hydro tomato";

  assert.equal(decisionSignature(first), decisionSignature(normalized));
  assert.notEqual(decisionSignature(first), decisionSignature(regrouped));
});

test("classification fails closed when item count or source-line order drifts", async () => {
  const item = {
    sourceLineText: "WRONG LINE",
    category: "dairy",
    variety: "whole milk",
    packCount: 6,
    quantity: 2,
    storage: "refrigerated",
    accessory: false,
    confidence: 0.9,
    excludeReason: null,
  };
  for (const [name, items] of [
    ["missing item", []],
    ["wrong source line", [item]],
  ]) {
    const { result: err } = await withFetch(
      () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
      () => caught(() => classifyLines(VALID_EXTRACTION)),
    );
    assert.ok(err instanceof ScanPipelineError, name);
    assert.equal(err.code, "unparseable_model_output", name);
    assert.equal(err.status, 502, name);
  }
});

test("an illegible raw line stays excluded even if classification tries to count it", async () => {
  const raw = {
    lines: [{ lineText: "BLURRED MILK", packSize: "6/1 GAL", quantity: "2", legible: false }],
  };
  const items = [{
    sourceLineText: "BLURRED MILK",
    category: "dairy",
    variety: "whole milk",
    packCount: 6,
    quantity: 2,
    storage: "refrigerated",
    accessory: false,
    confidence: 0.99,
    excludeReason: null,
  }];

  const { result } = await withFetch(
    () => jsonResponse(toolCompletion(CLASSIFY_TOOL, JSON.stringify({ items }))),
    () => classifyLines(raw),
  );

  assert.match(result.items[0].excludeReason, /legible/i);
});

// ---------------------------------------------------------------------------
// Reading the tool call
// ---------------------------------------------------------------------------
test("valid arguments are parsed and Zod-validated", async () => {
  const { result } = await runExtract(() =>
    jsonResponse(toolCompletion(EXTRACT_TOOL, EXTRACT_ARGS)),
  );
  assert.deepEqual(result, VALID_EXTRACTION);
});

test("an object-valued arguments field is accepted, still schema-checked", async () => {
  const { result } = await runExtract(() =>
    jsonResponse(toolCompletion(EXTRACT_TOOL, VALID_EXTRACTION)),
  );
  assert.deepEqual(result, VALID_EXTRACTION);
});

test("prose in message.content is never treated as the answer", async () => {
  // Content carries a perfectly valid payload; there is no tool call. Fail closed.
  const { result: err } = await failExtract(() =>
    jsonResponse(rawCompletion({ content: EXTRACT_ARGS })),
  );
  assert.equal(err.code, "unparseable_model_output");
  assert.equal(err.status, 502);
});

test("missing, duplicate, wrong-name, malformed and off-schema calls all fail closed", async () => {
  const cases = [
    ["no tool_calls key", rawCompletion({ content: "thinking..." })],
    ["empty tool_calls", rawCompletion({ content: "", tool_calls: [] })],
    [
      "duplicate calls",
      rawCompletion({
        tool_calls: [
          { function: { name: EXTRACT_TOOL, arguments: EXTRACT_ARGS } },
          { function: { name: EXTRACT_TOOL, arguments: EXTRACT_ARGS } },
        ],
      }),
    ],
    ["wrong function name", toolCompletion("submit_something_else", EXTRACT_ARGS)],
    ["arguments not valid JSON", toolCompletion(EXTRACT_TOOL, "{lines: [")],
    ["arguments missing", rawCompletion({ tool_calls: [{ function: { name: EXTRACT_TOOL } }] })],
    ["wrong type in schema", toolCompletion(EXTRACT_TOOL, JSON.stringify({ lines: "nope" }))],
    [
      "missing required keys",
      toolCompletion(EXTRACT_TOOL, JSON.stringify({ lines: [{ lineText: "x" }] })),
    ],
  ];
  for (const [name, body] of cases) {
    const { result: err } = await failExtract(() => jsonResponse(body));
    assert.ok(err instanceof ScanPipelineError, name);
    assert.equal(err.code, "unparseable_model_output", name);
    assert.equal(err.status, 502, name);
  }
});

test("a truncated tool call says so instead of blaming the schema", async () => {
  const { result: err } = await failExtract(() =>
    jsonResponse(toolCompletion(EXTRACT_TOOL, '{"lines": [', { finishReason: "length" })),
  );
  assert.equal(err.code, "unparseable_model_output");
  assert.match(err.message, /limit/i);
});

// ---------------------------------------------------------------------------
// Errors — unchanged behavior
// ---------------------------------------------------------------------------
test("a missing key fails as server_misconfigured before any request", async () => {
  const real = global.fetch;
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  global.fetch = async () => {
    throw new Error("must not be called");
  };
  try {
    const err = await caught(() => extractRawLines("QUJD", "image/png"));
    assert.ok(err instanceof ScanPipelineError);
    assert.equal(err.code, "server_misconfigured");
    assert.equal(err.status, 500);
    assert.match(err.message, /redeploy/i);
  } finally {
    global.fetch = real;
    if (previous !== undefined) process.env.OPENROUTER_API_KEY = previous;
  }
});

test("HTTP statuses map onto the frozen error codes", async () => {
  const cases = [
    [401, "server_misconfigured", 500],
    [403, "server_misconfigured", 500],
    [402, "server_misconfigured", 500],
    [429, "rate_limited", 429],
    [404, "upstream_error", 502],
    [408, "upstream_unreachable", 504],
    [500, "upstream_error", 502],
    [503, "upstream_error", 502],
  ];
  for (const [status, code, mapped] of cases) {
    const { result: err } = await failExtract(() =>
      jsonResponse({ error: { code: status, message: "upstream said no" } }, status),
    );
    assert.ok(err instanceof ScanPipelineError, `${status}`);
    assert.equal(err.code, code, `${status}`);
    assert.equal(err.status, mapped, `${status}`);
  }
});

test("402 names credits, not a redeploy", async () => {
  const { result: err } = await failExtract(() =>
    jsonResponse({ error: { message: "Insufficient credits" } }, 402),
  );
  assert.match(err.message, /credit/i);
});

test("'no endpoints' on a 400 reads as upstream_error, not a bad request", async () => {
  // This is what a provider that cannot honour tool_choice looks like.
  const { result: err } = await failExtract(() =>
    jsonResponse({ error: { message: "No endpoints found that support tool use" } }, 400),
  );
  assert.equal(err.code, "upstream_error");
  assert.match(err.message, new RegExp(constants.MODEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("a transport failure is upstream_unreachable", async () => {
  const { result: err } = await failExtract(() => {
    throw new TypeError("fetch failed");
  });
  assert.equal(err.code, "upstream_unreachable");
  assert.equal(err.status, 504);
});

test("a refusal is model_refused", async () => {
  for (const body of [
    rawCompletion({ refusal: "I can't help with that." }),
    rawCompletion({ content: "" }, { finishReason: "content_filter" }),
  ]) {
    const { result: err } = await failExtract(() => jsonResponse(body));
    assert.equal(err.code, "model_refused");
    assert.equal(err.status, 422);
  }
});

test("an upstream error echoing a key never reaches the message", async () => {
  const { result: err } = await failExtract(() =>
    jsonResponse({ error: { message: "bad key sk-or-v1-abc123DEF supplied" } }, 500),
  );
  assert.doesNotMatch(err.message, /sk-or-/);
  assert.match(err.message, /redacted/);
});
