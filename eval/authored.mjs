/**
 * Builds an AUTHORED response for a fixture record: what the two vision passes
 * would return if they read the image perfectly.
 *
 * READ THIS BEFORE TRUSTING ANY NUMBER PRODUCED FROM IT. An authored response is
 * not a model output. It is derived from the same fixture the image was drawn
 * from, so its transcription and its categories are correct by construction.
 * Running the pipeline on one measures the code AFTER the model — the pack and
 * quantity parsers, the storage override, the accessory rules, the partition
 * step, the standard, the scorecard — and measures NOTHING about how well the
 * model reads a photograph. eval/run.mjs keeps the two apart and refuses to
 * report authored fixtures as extraction accuracy.
 *
 * Responses recorded from a real model run carry source: "recorded" instead, and
 * those are the only ones the accuracy figures are computed from.
 */
import { isPerishableStorage } from "./fixtures/lines.mjs";

/**
 * What a classifier would plausibly answer for a line that cannot be counted.
 *
 * These are not ground truth — a reader of the record cannot count these lines
 * at all, which is why fixtures/lines.mjs gives them no category. They exist so
 * an authored response looks like something a model would really return, with a
 * guess in the category field and the reason it is dropped left to whichever
 * layer is supposed to catch it:
 *
 *   accessory      the accessory-food rule, in code and in the prompt
 *   non-staple     the classifier, via excludeReason
 *   everything else  the deterministic pack/quantity parsers, which find no
 *                    printed unit count and hold the line back
 */
const CLASSIFIER_GUESS = {
  "butter-sweet-cream": ["dairy", "butter", "refrigerated"],
  "jerky-beef": ["protein", "beef jerky", "shelf_stable"],
  "rice-bulk": ["grains", "white rice", "shelf_stable"],
  "beef-ground-bulk": ["protein", "ground beef", "refrigerated"],
  bananas: ["produce", "bananas", "fresh"],
  "onions-jumbo-sack": ["produce", "onions", "fresh"],
  "tomatoes-roma": ["produce", "roma tomatoes", "fresh"],
  "tomatoes-grade": ["produce", "tomatoes", "fresh"],
  "cucumber-bushel": ["produce", "cucumbers", "fresh"],
  "cabbage-box": ["produce", "cabbage", "fresh"],
  yams: ["produce", "yams", "fresh"],
  "hw-tomatoes": ["produce", "tomatoes", "fresh"],
  "hw-rice": ["grains", "white rice", "shelf_stable"],
  "hw-bananas": ["produce", "bananas", "fresh"],
  // Non-staples. The category is the closest of the four, which is the most a
  // classifier can do with paper goods or cigarettes; excludeReason is what
  // actually drops them.
  "paper-towels": ["grains", "paper towels", "shelf_stable"],
  bleach: ["grains", "household bleach", "shelf_stable"],
  "soda-cola": ["produce", "cola", "shelf_stable"],
  "energy-drink": ["produce", "energy drink", "shelf_stable"],
  chips: ["grains", "potato chips", "shelf_stable"],
  "candy-bars": ["grains", "candy bar", "shelf_stable"],
  cigarettes: ["grains", "cigarettes", "shelf_stable"],
  "deli-prepared": ["protein", "chicken salad", "refrigerated"],
  // Illegible lines: a guess at low confidence, held back by the legibility flag.
  "illegible-glare": ["dairy", "whole milk", "refrigerated"],
  "illegible-cut": ["dairy", "cheddar cheese", "refrigerated"],
};

const LEGIBLE_CONFIDENCE = 0.93;
const ILLEGIBLE_CONFIDENCE = 0.55;

const NON_STAPLE_REASON = "Not one of the four staple food categories.";

/**
 * TWO MISTAKES THE AUTHORED RESPONSES MAKE ON PURPOSE.
 *
 * A response that reads everything correctly would not exercise the layers built
 * to catch a model that does not. The pipeline discards the model's own pack and
 * quantity figures and re-parses them from the transcription, and it overrides
 * the storage of unrefrigerated whole produce. Neither guard is measured by a
 * response that was already right, so these responses are wrong in the two ways
 * a vision model is reliably wrong:
 *
 *   1. On a line with no printed unit count, it offers the first number it can
 *      see. "ROMA TOMATOES 25 LB CS" comes back as a 25-pack. This is the error
 *      that would tell a store it passes when it does not, so the deterministic
 *      parsers have to throw it away.
 *
 *   2. Unrefrigerated whole produce comes back as shelf-stable, because the model
 *      is looking at an order record and not at a chiller. The storage override
 *      has to recover the perishable flag from the description.
 *
 * Where the guards fail, eval/RESULTS.md says so.
 */
function guessedPackCount(printed) {
  const fromPack = String(printed.pack ?? "").match(/\d+/);
  if (fromPack) return Number(fromPack[0]);
  const fromDescription = String(printed.description ?? "").match(/\d+/);
  // With no number anywhere, a model reaches for a plausible case size.
  return fromDescription ? Number(fromDescription[0]) : 24;
}

function guessedQuantity(printed) {
  const match = String(printed.qty ?? "").match(/\d+/);
  return match ? Number(match[0]) : 1;
}

/** Pass 1 as it would come back: the printed columns, copied verbatim. */
export function authoredExtract(record) {
  return {
    lines: record.lines.map((line) => ({
      lineText: line.printed.description,
      packSize: line.printed.pack ? line.printed.pack : null,
      quantity: line.printed.qty ? line.printed.qty : null,
      legible: !line.tags.includes("illegible"),
    })),
  };
}

/** Pass 2 as it would come back, before reconciliation. */
export function authoredClassify(record) {
  return {
    items: record.lines.map((line) => {
      const { truth, tags } = line;
      const illegible = tags.includes("illegible");
      const guess = CLASSIFIER_GUESS[line.id];

      const [category, variety, storage] = truth.counted
        ? [truth.category, truth.variety, truth.storage]
        : (guess ?? ["grains", "", "shelf_stable"]);

      return {
        sourceLineText: line.printed.description,
        category,
        variety,
        // Mistake 1: a number wherever one can be seen, printed unit count or not.
        packCount: truth.counted ? truth.unitsPerPack : guessedPackCount(line.printed),
        quantity: truth.counted ? truth.packs : guessedQuantity(line.printed),
        // Mistake 2: fresh whole produce read off a piece of paper as shelf-stable.
        storage: category === "produce" && storage === "fresh" ? "shelf_stable" : storage,
        accessory: tags.includes("accessory"),
        confidence: illegible ? ILLEGIBLE_CONFIDENCE : LEGIBLE_CONFIDENCE,
        excludeReason: tags.includes("non-staple") ? NON_STAPLE_REASON : null,
      };
    }),
  };
}

/** The response file written to eval/responses/<id>.json. */
export function authoredResponse(record) {
  return {
    fixture: record.id,
    source: "authored",
    note:
      "Derived from the fixture, not returned by a model. Measures the pipeline " +
      "after the model, never the model's own reading. See eval/authored.mjs.",
    generatedBy: "eval/tools/record-responses.mjs",
    extract: authoredExtract(record),
    classify: authoredClassify(record),
  };
}

export { isPerishableStorage, NON_STAPLE_REASON };
