/**
 * Scores one order record end to end and prints it, with no API key and no
 * network.
 *
 *   npm run demo                              a weekly order, two categories short
 *   npm run demo -- 01-full-restock-laser     one that meets the standard
 *   npm run demo -- --list                    every record available
 *
 * It replays a stored model response from eval/responses/ through the real
 * pipeline: reconciliation, the pack and quantity parsers, the partition step,
 * the stocking standard, the fix optimiser and the scorecard. The only thing
 * standing in for the live system is the model call itself, and the header says
 * which kind of response it is reading.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RECORDS, recordById } from "../eval/fixtures/records.mjs";
import { replay } from "../eval/pipeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FIXTURE = "18-mixed-bodega-order";

// ---------------------------------------------------------------------------
const colour = process.env.NO_COLOR === undefined && process.stdout.isTTY;
const paint = (code, text) => (colour ? `[${code}m${text}[0m` : text);
const bold = (text) => paint("1", text);
const dim = (text) => paint("2", text);
const red = (text) => paint("31", text);
const green = (text) => paint("32", text);
const yellow = (text) => paint("33", text);

const args = process.argv.slice(2);

if (args.includes("--list")) {
  console.log(bold("\nRecords you can score:\n"));
  for (const record of RECORDS) {
    console.log(`  ${record.id.padEnd(30)} ${dim(record.title)}`);
  }
  console.log(`\nUsage: npm run demo -- <record-id>\n`);
  process.exit(0);
}

const fixtureId = args.find((arg) => !arg.startsWith("-")) ?? DEFAULT_FIXTURE;

let record;
try {
  record = recordById(fixtureId);
} catch {
  console.error(`No record called "${fixtureId}". Try: npm run demo -- --list`);
  process.exit(1);
}

const responsePath = resolve(root, "eval", "responses", `${record.id}.json`);
if (!existsSync(responsePath)) {
  console.error(`No stored response for ${record.id}. Run: node eval/tools/record-responses.mjs`);
  process.exit(1);
}
const response = JSON.parse(readFileSync(responsePath, "utf8"));
const { scorecard, outcomes } = replay(record, response);

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const line = (char = "─") => dim(char.repeat(74));

console.log();
console.log(line("═"));
console.log(bold(`  ${scorecard.storeName}`));
console.log(`  ${record.title}   ${dim(`${record.vendor} · ${record.date}`)}`);
console.log(line("═"));

const sourceNote =
  response.source === "recorded"
    ? `model response recorded from ${response.model ?? "a live run"}${response.recordedAt ? ` on ${response.recordedAt}` : ""}`
    : "authored model response: it demonstrates the pipeline, not the model's accuracy";
console.log(
  `  ${dim("Image:")}    eval/fixtures/images/${record.id}.png ${dim("(synthetic)")}\n` +
    `  ${dim("Response:")} ${response.source} — ${dim(sourceNote)}`,
);
console.log();

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
const passes = scorecard.overallStatus === "pass";
console.log(
  passes
    ? `  ${green("✔")}  ${bold("Estimated to meet the SNAP stocking standard")}`
    : `  ${red("✖")}  ${bold("May not meet the stocking standard yet")}`,
);
console.log(
  dim(
    "     Readiness estimate for this record only. Ledger checks the lines it can\n" +
      "     read against the Criterion A thresholds. It is not a USDA determination.",
  ),
);
console.log();

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
console.log(`  ${bold("Category".padEnd(24))}${bold("Varieties".padEnd(14))}${bold("Units".padEnd(12))}${bold("Perishable")}`);
console.log(line());

for (const category of scorecard.categories) {
  const varietiesOk = category.varietiesFound >= 7;
  const unitsOk = category.unitsFound >= 21;
  const mark = (ok, text) => (ok ? green(text) : red(text));
  console.log(
    `  ${category.label.padEnd(24)}` +
      mark(varietiesOk, `${category.varietiesFound} of 7`.padEnd(14)) +
      mark(unitsOk, `${category.unitsFound} of 21`.padEnd(12)) +
      (category.hasPerishable ? green("yes") : yellow("no")),
  );
}
console.log(line());
console.log(
  `  ${"Total stocking units".padEnd(24)}${(scorecard.totalUnits >= 84 ? green : red)(`${scorecard.totalUnits} of 84`)}`,
);
console.log(
  `  ${"Perishable categories".padEnd(24)}${(scorecard.perishableCategoriesMet >= 3 ? green : red)(`${scorecard.perishableCategoriesMet} of 3 required`)}`,
);
console.log();

// ---------------------------------------------------------------------------
// Held back
// ---------------------------------------------------------------------------
const heldBack = record.lines
  .map((entry, index) => ({ entry, result: outcomes[index] }))
  .filter(({ result }) => !result.counted);

if (heldBack.length > 0) {
  console.log(bold(`  Held back — ${heldBack.length} of ${record.lines.length} lines counted for nothing`));
  console.log(line());
  for (const { entry, result } of heldBack) {
    console.log(`  ${entry.printed.description.padEnd(40).slice(0, 40)} ${dim(result.reason ?? "")}`);
  }
  console.log();
  console.log(
    dim(
      "  A held-back line is not a claim about what the store stocks. It is a line\n" +
        "  that counts for nothing here: the record shows no sellable unit count, or\n" +
        "  the item is not a staple food, or nobody could read it.",
    ),
  );
  console.log();
}

// ---------------------------------------------------------------------------
// Fix plan
// ---------------------------------------------------------------------------
if (scorecard.fixes.length > 0) {
  const plan = scorecard.fixPlan;
  console.log(
    bold(`  Smallest order that clears every requirement`) +
      dim(`  — ${plan.totalAddedUnits} stocking units across ${scorecard.fixes.length} items`),
  );
  console.log(line());
  for (const fix of scorecard.fixes) {
    console.log(`  ${dim(fix.category.padEnd(9))}${fix.itemSuggestion}`);
    console.log(`  ${" ".repeat(9)}${dim(fix.whyItHelps)}`);
  }
  console.log(line());
  if (!plan.sufficient) {
    console.log(
      `  ${yellow("!")}  ${bold("This list is not enough to meet the standard.")} The suggestion\n` +
        `     catalogue cannot close every gap on this record.`,
    );
  } else {
    console.log(dim("  Solved for the fewest added stocking units, not ranked by hand."));
  }
  console.log();
}

console.log(line("═"));
console.log(
  dim(
    "  Self-assessment aid, not a compliance determination. Only USDA decides\n" +
      "  whether a store is authorised. Count your own shelves before acting on this.",
  ),
);
console.log(line("═"));
console.log();
