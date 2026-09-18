/**
 * Recomputes the `expected` block of every fixture record from
 * eval/reference-scoring.mjs and reports where the committed literal disagrees.
 *
 * This is how the committed expectations were produced, and it is how a change
 * to a fixture's lines is checked afterwards. It is a maintenance tool, not part
 * of the eval: the harness reads the committed literals, never this file, so the
 * app is always measured against a fixed expectation.
 *
 *   node eval/tools/expected.mjs           report disagreements
 *   node eval/tools/expected.mjs --print   print the blocks to paste in
 */
import { RECORDS, resolveRecord } from "../fixtures/records.mjs";
import { expectedBlockFor } from "../reference-scoring.mjs";

const print = process.argv.includes("--print");
let disagreements = 0;

for (const record of RECORDS) {
  const resolved = resolveRecord(record);
  const counted = resolved.lines.map((line) => line.truth).filter((truth) => truth.counted);
  const computed = expectedBlockFor(counted);

  if (print) {
    console.log(`// ${record.id}`);
    console.log(`    expected: ${JSON.stringify(computed, null, 2).replace(/\n/g, "\n    ")},`);
    continue;
  }

  const committed = JSON.stringify(record.expected);
  if (committed !== JSON.stringify(computed)) {
    disagreements++;
    console.log(`\n${record.id}`);
    for (const category of ["dairy", "grains", "protein", "produce"]) {
      const a = record.expected.categories[category];
      const b = computed.categories[category];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.log(`  ${category.padEnd(8)} committed ${JSON.stringify(a)}`);
        console.log(`  ${" ".repeat(8)} reference ${JSON.stringify(b)}`);
      }
    }
    for (const key of ["totalUnits", "perishableCategories", "overall"]) {
      if (record.expected[key] !== computed[key]) {
        console.log(`  ${key.padEnd(8)} committed ${record.expected[key]} / reference ${computed[key]}`);
      }
    }
  }
}

if (!print) {
  console.log(
    disagreements === 0
      ? `\nAll ${RECORDS.length} committed expectations agree with eval/reference-scoring.mjs.`
      : `\n${disagreements} of ${RECORDS.length} records disagree.`,
  );
  process.exitCode = disagreements === 0 ? 0 : 1;
}
