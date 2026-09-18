/**
 * The eval harness. One command, and it writes eval/RESULTS.md.
 *
 *   npm run eval          replay the stored responses, no key, no network
 *   npm run eval:live     call the model on every fixture image and record it
 *   npm run eval -- --fixture 05-weight-priced-produce   one record, verbose
 *
 * WHAT IT REPORTS, AND WHY IT IS IN TWO HALVES. A stored response is either
 * authored (derived from the fixture, correct by construction) or recorded from a
 * real model run. Authored responses can only measure the code after the model.
 * Extraction accuracy — how often the model reads a photographed record right —
 * can only come from recorded responses, so with none stored the accuracy tables
 * say "not measured" and the README says the same. The harness will not average
 * the two together, and will not print an accuracy figure it did not measure.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RECORDS, resolveRecord, allTags } from "./fixtures/records.mjs";
import { isPerishableStorage } from "./fixtures/lines.mjs";
import { replay, summarize, CATEGORIES } from "./pipeline.mjs";
import {
  byTag,
  categoryConfusion,
  countedConfusion,
  fieldAccuracy,
  number,
  percent,
  unitsPerPackError,
  verdictAgreement,
} from "./metrics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const responsesDir = resolve(here, "responses");
const imagesDir = resolve(here, "fixtures", "images");

const args = process.argv.slice(2);
const live = args.includes("--live");
const only = args[args.indexOf("--fixture") + 1] || null;
const selected = only && only !== "--live" ? RECORDS.filter((r) => r.id === only) : RECORDS;

if (selected.length === 0) {
  console.error(`No fixture matches "${only}".`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------
function storedResponse(id) {
  const path = resolve(responsesDir, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Call the model on a fixture image and store what it says.
 *
 * Only reachable with --live and a key. The response is written with
 * source: "recorded" plus the model id, and from then on the offline run uses it.
 */
async function recordLive(record) {
  const imagePath = resolve(imagesDir, `${record.id}.png`);
  if (!existsSync(imagePath)) {
    throw new Error(`no image for ${record.id}: run \`npm run eval:images\` first`);
  }

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const build = resolve(here, "..", ".smoke-build");
  const { extractRawLines, classifyRawLines } = require(resolve(build, "vision/pipeline.js"));
  const { MODEL } = require(resolve(build, "rules/constants.js"));

  const base64 = readFileSync(imagePath).toString("base64");
  const extract = await extractRawLines(base64, "image/png");
  const classify = await classifyRawLines(extract);

  const response = {
    fixture: record.id,
    source: "recorded",
    model: MODEL,
    recordedAt: new Date().toISOString().slice(0, 10),
    note: "Returned by the model for eval/fixtures/images/" + record.id + ".png.",
    extract,
    classify,
  };
  mkdirSync(responsesDir, { recursive: true });
  writeFileSync(resolve(responsesDir, `${record.id}.json`), `${JSON.stringify(response, null, 2)}\n`);
  return response;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const results = [];
const missing = [];

for (const record of selected) {
  const resolved = resolveRecord(record);
  let response = storedResponse(record.id);

  if (live) {
    try {
      response = await recordLive(resolved);
    } catch (error) {
      console.error(`${record.id}: live run failed — ${error.message}`);
      if (!response) {
        missing.push({ id: record.id, why: error.message });
        continue;
      }
    }
  }

  if (!response) {
    missing.push({ id: record.id, why: "no stored response" });
    continue;
  }

  // A recorded response can disagree with the fixture about how many lines are
  // on the record. That is a finding, not an error: it is the model missing or
  // inventing a line, and it is reported as such.
  let outcome = null;
  let replayError = null;
  try {
    outcome = replay(resolved, response);
  } catch (error) {
    replayError = error.message;
  }

  results.push({ record: resolved, response, outcome, replayError });
}

// ---------------------------------------------------------------------------
// Pairs
// ---------------------------------------------------------------------------
/** One (truth, prediction) pair per fixture line, for the line-level metrics. */
function pairsFrom(entries) {
  const pairs = [];
  for (const { record, outcome } of entries) {
    if (!outcome) continue;
    record.lines.forEach((line, index) => {
      const result = outcome.outcomes[index];
      if (!result) return;
      pairs.push({
        fixture: record.id,
        lineText: line.printed.description,
        tags: line.tags,
        truth: {
          ...line.truth,
          perishable: line.truth.counted ? isPerishableStorage(line.truth.storage) : null,
        },
        counted: result.counted,
        reason: result.reason,
        predicted: result.predicted,
      });
    });
  }
  return pairs;
}

const authored = results.filter((r) => r.response.source === "authored");
const recorded = results.filter((r) => r.response.source === "recorded");

function report(entries) {
  const pairs = pairsFrom(entries);
  const scored = entries
    .filter((entry) => entry.outcome)
    .map((entry) => ({
      fixture: entry.record.id,
      expected: entry.record.expected,
      actual: entry.outcome.actual,
    }));

  return {
    fixtures: entries.length,
    lines: pairs.length,
    pairs,
    counted: countedConfusion(pairs),
    category: categoryConfusion(pairs, CATEGORIES),
    variety: fieldAccuracy(pairs, "variety"),
    unitsPerPack: unitsPerPackError(pairs),
    packs: fieldAccuracy(pairs, "packs"),
    units: fieldAccuracy(pairs, "units"),
    perishable: fieldAccuracy(pairs, "perishable"),
    storage: fieldAccuracy(pairs, "storage"),
    verdict: verdictAgreement(scored),
    tags: byTag(pairs, allTags()),
    replayErrors: entries.filter((e) => e.replayError).map((e) => ({ fixture: e.record.id, error: e.replayError })),
  };
}

const conformance = report(authored);
const accuracy = recorded.length > 0 ? report(recorded) : null;

// ---------------------------------------------------------------------------
// RESULTS.md
// ---------------------------------------------------------------------------
const out = [];
const w = (line = "") => out.push(line);

w("# Extraction and scoring eval");
w();
w(
  "Generated by `npm run eval`. Do not edit by hand: the numbers come from " +
    "replaying stored model responses through the shipped pipeline.",
);
w();
w("## What this measures");
w();
w(
  "Ledger makes a regulatory claim from a photograph, so the question this " +
    "harness exists to answer is how often it is right. The answer comes in two " +
    "halves, and they must not be added together.",
);
w();
w(
  "**Extraction accuracy** is how well the vision model reads a photographed " +
    "order record. It can only be measured from responses recorded from a real " +
    "model run against the fixture images.",
);
w();
w(
  "**Pipeline conformance** is how well everything after the model behaves: the " +
    "pack and quantity parsers, the storage override, the accessory rules, the " +
    "partition step, the stocking standard and the scorecard. It is measured by " +
    "feeding the pipeline a response derived from the fixture itself, so the " +
    "transcription is correct by construction and any error that shows up belongs " +
    "to our code.",
);
w();

const fixtureCount = RECORDS.length;
const syntheticCount = RECORDS.filter((r) => r.synthetic).length;
w("## Fixtures");
w();
w(`- ${fixtureCount} order records, ${syntheticCount} of them synthetic.`);
w(
  `- ${RECORDS.reduce((n, r) => n + r.lines.length, 0)} line items with hand-labelled ` +
    "ground truth: category, variety, storage, units per pack, packs, and whether the " +
    "line can be counted at all.",
);
w(
  "- Expected verdicts come from `eval/reference-scoring.mjs`, a second implementation " +
    "of the stocking standard written from the rule rather than from the app, and are " +
    "committed as literals on each record.",
);
w(
  "- **Every fixture is synthetic.** No real store's order record is in this " +
    "repository. `eval/README.md` sets out what that costs these numbers.",
);
w();

// --- extraction accuracy ---------------------------------------------------
w("## 1. Extraction accuracy (the model)");
w();
if (!accuracy) {
  w("**Not measured.**");
  w();
  w(
    `There are ${authored.length} stored responses and none of them is a recording of a ` +
      "real model run, so this section has no data. Nothing in this repository " +
      "reports how often the vision model reads an order record correctly, and the " +
      "README says so too.",
  );
  w();
  w("To measure it, with an `OPENROUTER_API_KEY`:");
  w();
  w("```bash");
  w("npm run eval:images   # render the fixture images (needs Chromium)");
  w("npm run eval:live     # call the model on each one and record what it says");
  w("```");
  w();
  w(
    "That writes `source: \"recorded\"` responses into `eval/responses/`, and this " +
      "section fills in on the next run.",
  );
} else {
  const models = [...new Set(recorded.map((r) => r.response.model).filter(Boolean))];
  const dates = [...new Set(recorded.map((r) => r.response.recordedAt).filter(Boolean))].sort();
  w(
    `From ${recorded.length} recorded response${recorded.length === 1 ? "" : "s"}` +
      (models.length ? ` (${models.join(", ")})` : "") +
      (dates.length ? `, recorded ${dates[0]}${dates.length > 1 ? ` to ${dates[dates.length - 1]}` : ""}` : "") +
      ".",
  );
  w();
  w(fieldTable(accuracy));
  w();
  w(`Units per pack: MAE ${number(accuracy.unitsPerPack.mae)} over ${accuracy.unitsPerPack.compared} lines, exact on ${percent(accuracy.unitsPerPack.exactRate)}. No prediction at all on ${accuracy.unitsPerPack.noPrediction} lines.`);
  w();
  w(confusionTable(accuracy.category));
  if (accuracy.replayErrors.length > 0) {
    w();
    w("Responses the pipeline rejected outright:");
    w();
    for (const error of accuracy.replayErrors) w(`- \`${error.fixture}\`: ${error.error}`);
  }
}
w();

// --- conformance -----------------------------------------------------------
w("## 2. Pipeline conformance (everything after the model)");
w();
w(
  `From ${conformance.fixtures} authored responses covering ${conformance.lines} lines. ` +
    "A perfect score here says nothing about the model; it says the deterministic " +
    "layers do what the fixtures say they should.",
);
w();
w(fieldTable(conformance));
w();
w("### Counting decisions");
w();
w("| Outcome | Lines |");
w("| --- | --- |");
w(`| Counted, and should have been | ${conformance.counted.countedBoth} |`);
w(`| Held back, and should have been | ${conformance.counted.heldBoth} |`);
w(`| Held back but countable (undercount) | ${conformance.counted.undercounted} |`);
w(`| **Counted but not countable (overcount)** | **${conformance.counted.overcounted}** |`);
w();
w(
  "An overcount is the only error in this table that can tell a store it passes " +
    "when it does not, which is why it is the harness's hard failure condition.",
);
if (conformance.counted.overcounts.length > 0) {
  w();
  for (const over of conformance.counted.overcounts) {
    w(`- \`${over.fixture}\` counted \`${over.line}\` as ${over.units} units.`);
  }
}
if (conformance.counted.undercounts.length > 0) {
  w();
  w("Undercounted lines:");
  w();
  for (const under of conformance.counted.undercounts) {
    w(`- \`${under.fixture}\` held back \`${under.line}\` — ${under.reason ?? "no reason given"}`);
  }
}
w();
w(`Units per pack: MAE ${number(conformance.unitsPerPack.mae)} over ${conformance.unitsPerPack.compared} lines, exact on ${percent(conformance.unitsPerPack.exactRate)}. No prediction on ${conformance.unitsPerPack.noPrediction} lines.`);
if (conformance.unitsPerPack.worst.length > 0) {
  w();
  w("| Fixture | Line | Expected | Read as |");
  w("| --- | --- | --- | --- |");
  for (const miss of conformance.unitsPerPack.worst) {
    w(`| \`${miss.fixture}\` | ${miss.line} | ${miss.expected} | ${miss.actual} |`);
  }
}
w();
w(confusionTable(conformance.category));
w();

// --- end to end ------------------------------------------------------------
w("## 3. End-to-end agreement with a human scoring");
w();
w(verdictSection(conformance.verdict, "Conformance"));
if (accuracy) {
  w();
  w(verdictSection(accuracy.verdict, "Recorded model responses"));
}
w();

// --- failure modes ---------------------------------------------------------
w("## 4. Failure modes");
w();
w("Line-level results split by the failure mode each line is tagged with.");
w();
w("| Failure mode | Lines | Counted correctly | Overcount | Undercount | Units/pack MAE |");
w("| --- | --- | --- | --- | --- | --- |");
const tagSource = accuracy ?? conformance;
for (const [tag, stats] of Object.entries(tagSource.tags)) {
  w(
    `| ${tag} | ${stats.lines} | ${percent(stats.countedCorrectly)} | ${stats.overcounted} | ` +
      `${stats.undercounted} | ${number(stats.unitsPerPack.mae)} |`,
  );
}
w();
w(
  "`weight-only`, `size-grade` and `container-word` lines are held back on purpose: " +
    "a case priced by weight carries no sellable unit count, so there is nothing to " +
    "count without guessing. They are the largest single source of undercounting, and " +
    "the reason a scan can read a full order record and still report very few units.",
);
w();

if (missing.length > 0) {
  w("## Fixtures with no result");
  w();
  for (const entry of missing) w(`- \`${entry.id}\`: ${entry.why}`);
  w();
}

w("## What these numbers cannot tell you");
w();
w(
  "- Whether the model reads real handwriting, real glare or a real dot-matrix " +
    "printer. The images are drawn from HTML, and the hand-written ones simulate an " +
    "irregular hand rather than photographing one.",
);
w(
  "- Whether the order record reflects what is on the shelf. The eval scores the " +
    "record, and so does the app.",
);
w(
  "- Whether USDA would classify these products or varieties the same way. The " +
    "category and perishable labels here are our reading of the rule.",
);
w("- Anything about Criterion B, specialty-store treatment, or authorisation itself.");
w();

// ---------------------------------------------------------------------------
function fieldTable(data) {
  const rows = [
    ["Line counted or held back", data.counted.rate, data.counted.total],
    ["Category", data.category.rate, data.category.considered],
    ["Variety", data.variety.rate, data.variety.considered],
    ["Storage", data.storage.rate, data.storage.considered],
    ["Perishable flag", data.perishable.rate, data.perishable.considered],
    ["Units per pack (exact)", data.unitsPerPack.exactRate, data.unitsPerPack.compared],
    ["Packs on the line", data.packs.rate, data.packs.considered],
    ["Stocking units", data.units.rate, data.units.considered],
  ];
  const lines = ["| Field | Agreement | Lines scored |", "| --- | --- | --- |"];
  for (const [label, rate, considered] of rows) {
    lines.push(`| ${label} | ${percent(rate)} | ${considered} |`);
  }
  return lines.join("\n");
}

function confusionTable({ matrix, columns, rate, considered }) {
  const lines = [
    "### Category confusion",
    "",
    `Rows are the truth, columns are what the pipeline produced. ${percent(rate)} correct over ${considered} countable lines.`,
    "",
    `| truth \\ read as | ${columns.join(" | ")} |`,
    `| --- | ${columns.map(() => "---").join(" | ")} |`,
  ];
  for (const [truth, row] of Object.entries(matrix)) {
    lines.push(`| **${truth}** | ${columns.map((c) => row[c]).join(" | ")} |`);
  }
  return lines.join("\n");
}

function verdictSection(verdict, label) {
  const lines = [
    `**${label}.** ${verdict.verdictAgreed} of ${verdict.records} records reach the same pass/fail verdict as the hand scoring (${percent(verdict.verdictRate)}).`,
    "",
    `- False passes (scan says pass, human says fail): **${verdict.falsePasses}**`,
    `- False fails (scan says fail, human says pass): ${verdict.falseFails}`,
    `- Category rows where variety count, units and perishable flag all agree: ${verdict.categoryRowsAgreed} of ${verdict.categoryRows} (${percent(verdict.categoryRowRate)})`,
    `- Category rows where the variety count agrees: ${verdict.varietyRowsAgreed} of ${verdict.varietyRows} (${percent(verdict.varietyRowRate)})`,
  ];
  if (verdict.disagreements.length > 0) {
    lines.push("", "| Fixture | Human | Scan | Direction |", "| --- | --- | --- | --- |");
    for (const d of verdict.disagreements) {
      lines.push(`| \`${d.fixture}\` | ${d.expected} | ${d.actual} | ${d.direction} |`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Write and gate
// ---------------------------------------------------------------------------
const resultsPath = resolve(here, "RESULTS.md");
if (selected.length === RECORDS.length) {
  writeFileSync(resultsPath, `${out.join("\n")}\n`);
}

const summaryLines = [
  `fixtures ${results.length}/${RECORDS.length}`,
  `lines ${conformance.lines}`,
  `verdict agreement ${percent(conformance.verdict.verdictRate)}`,
  `false passes ${conformance.verdict.falsePasses}`,
  `overcounted lines ${conformance.counted.overcounted}`,
  `undercounted ${conformance.counted.undercounted}`,
];
console.log(summaryLines.join("  |  "));
if (selected.length === RECORDS.length) console.log(`wrote ${resultsPath}`);

if (only) {
  // Single-fixture runs are for looking at one record, so print its detail.
  for (const entry of results) {
    console.log(`\n${entry.record.id} — ${entry.record.title}`);
    console.log(`  expected ${JSON.stringify(entry.record.expected)}`);
    console.log(`  actual   ${JSON.stringify(entry.outcome ? entry.outcome.actual : entry.replayError)}`);
    entry.record.lines.forEach((line, index) => {
      const result = entry.outcome?.outcomes[index];
      if (!result) return;
      const mark = result.counted === line.truth.counted ? " " : "!";
      console.log(
        `  ${mark} ${line.printed.description.padEnd(40).slice(0, 40)} ` +
          `truth ${line.truth.counted ? `${line.truth.units} units` : "held"} / ` +
          `read ${result.counted ? `${result.predicted.units} units` : `held: ${result.reason}`}`,
      );
    });
  }
}

// The gate. An authored response is exact by construction, so anything the
// pipeline reports differently from the hand scoring is a bug in our code and
// fails the run — including a numeric disagreement that happens to land on the
// same verdict, which is how a wrong threshold hides. Figures from recorded
// model responses are reported and never gated: that is the measurement.
const failures = [];
if (conformance.counted.overcounted > 0) {
  failures.push(`${conformance.counted.overcounted} line(s) counted that should have been held back`);
}
if (conformance.verdict.falsePasses > 0) {
  failures.push(`${conformance.verdict.falsePasses} record(s) scored as a pass that should fail`);
}
if (conformance.verdict.falseFails > 0) {
  failures.push(`${conformance.verdict.falseFails} record(s) scored as a fail that should pass`);
}
if (conformance.verdict.categoryRowsAgreed < conformance.verdict.categoryRows) {
  const off = conformance.verdict.categoryRows - conformance.verdict.categoryRowsAgreed;
  failures.push(
    `${off} category row(s) disagree with the hand scoring on varieties, units or the perishable flag`,
  );
}
if (conformance.counted.undercounted > 0) {
  failures.push(`${conformance.counted.undercounted} countable line(s) held back`);
}
if (conformance.replayErrors.length > 0) {
  failures.push(`${conformance.replayErrors.length} authored response(s) the pipeline rejected`);
}
if (missing.length > 0 && !only) {
  failures.push(`${missing.length} fixture(s) with no stored response`);
}

if (failures.length > 0) {
  console.error(`\neval failed:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exitCode = 1;
}
