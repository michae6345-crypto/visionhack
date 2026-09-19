/**
 * Writes the authored response for every fixture record to eval/responses/.
 *
 * Run this after changing a fixture's lines. It only ever writes files whose
 * source is "authored" — a response recorded from a real model run is never
 * overwritten, because that recording is evidence and this script is not.
 *
 *   node eval/tools/record-responses.mjs
 *   node eval/tools/record-responses.mjs --force   overwrite recorded ones too
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { RECORDS, resolveRecord } from "../fixtures/records.mjs";
import { authoredResponse } from "../authored.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const responsesDir = resolve(here, "..", "responses");
const force = process.argv.includes("--force");

mkdirSync(responsesDir, { recursive: true });

let written = 0;
let kept = 0;

for (const record of RECORDS) {
  const path = resolve(responsesDir, `${record.id}.json`);

  if (existsSync(path) && !force) {
    const existing = JSON.parse(readFileSync(path, "utf8"));
    if (existing.source === "recorded") {
      kept++;
      continue;
    }
  }

  writeFileSync(path, `${JSON.stringify(authoredResponse(resolveRecord(record)), null, 2)}\n`);
  written++;
}

console.log(
  `${written} authored response${written === 1 ? "" : "s"} written to eval/responses/` +
    (kept > 0 ? `, ${kept} recorded response${kept === 1 ? "" : "s"} left alone` : ""),
);
