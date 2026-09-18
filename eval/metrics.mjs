/**
 * The metrics, as pure functions over (truth, prediction) pairs.
 *
 * Kept separate from eval/run.mjs so they can be unit-tested against hand-worked
 * examples (scripts/eval-metrics.test.mjs). A metric that is wrong is worse than
 * no metric: it reports a number nobody checks.
 *
 * Nothing here knows about images, models or files.
 */

/** Per-field agreement over the lines both sides have an opinion about. */
export function fieldAccuracy(pairs, field) {
  let considered = 0;
  let agreed = 0;
  const misses = [];

  for (const pair of pairs) {
    const expected = pair.truth[field];
    // A field the truth leaves open (a line no reader could count) is not scored.
    if (expected === null || expected === undefined) continue;
    considered++;
    const actual = pair.predicted?.[field] ?? null;
    if (same(expected, actual)) agreed++;
    else misses.push({ fixture: pair.fixture, line: pair.lineText, expected, actual });
  }

  return {
    considered,
    agreed,
    rate: considered === 0 ? null : agreed / considered,
    misses,
  };
}

function same(expected, actual) {
  if (typeof expected === "string" && typeof actual === "string") {
    return normalize(expected) === normalize(actual);
  }
  return expected === actual;
}

/** Variety and description comparisons ignore case, spacing and outer punctuation. */
function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Whether each line was counted, as a confusion matrix.
 *
 * Held back when it should have counted is an undercount: the store is told it
 * is shorter than it is. Counted when it should have been held back is an
 * OVERCOUNT, and the only error here that can tell a store it passes when it
 * does not.
 */
export function countedConfusion(pairs) {
  const matrix = { countedBoth: 0, heldBoth: 0, undercounted: 0, overcounted: 0 };
  const overcounts = [];
  const undercounts = [];

  for (const pair of pairs) {
    const shouldCount = pair.truth.counted === true;
    const didCount = pair.counted === true;
    if (shouldCount && didCount) matrix.countedBoth++;
    else if (!shouldCount && !didCount) matrix.heldBoth++;
    else if (shouldCount && !didCount) {
      matrix.undercounted++;
      undercounts.push({ fixture: pair.fixture, line: pair.lineText, reason: pair.reason });
    } else {
      matrix.overcounted++;
      overcounts.push({ fixture: pair.fixture, line: pair.lineText, units: pair.predicted?.units });
    }
  }

  const total = pairs.length;
  return {
    ...matrix,
    total,
    rate: total === 0 ? null : (matrix.countedBoth + matrix.heldBoth) / total,
    overcounts,
    undercounts,
  };
}

/**
 * Category classification as a confusion matrix, over lines a reader can count.
 * "held" is a column, not a category: a line dropped before classification is a
 * different failure from one filed under the wrong category.
 */
export function categoryConfusion(pairs, categories) {
  const columns = [...categories, "held"];
  const matrix = {};
  for (const truth of categories) {
    matrix[truth] = Object.fromEntries(columns.map((c) => [c, 0]));
  }

  let considered = 0;
  let correct = 0;
  for (const pair of pairs) {
    const expected = pair.truth.category;
    if (!expected || !matrix[expected]) continue;
    // Only lines a reader can count. An accessory food has a category and is
    // still uncountable, so scoring its category as a miss would penalise the
    // pipeline for applying the accessory rule correctly.
    if (pair.truth.counted !== true) continue;
    considered++;
    const actual = pair.counted ? (pair.predicted?.category ?? "held") : "held";
    if (!columns.includes(actual)) continue;
    matrix[expected][actual]++;
    if (actual === expected) correct++;
  }

  return { matrix, columns, considered, correct, rate: considered === 0 ? null : correct / considered };
}

/**
 * Mean absolute error on units per pack, over lines where the truth has a number
 * AND the pipeline produced one. Lines where it produced nothing are reported
 * separately as `noPrediction`, because averaging them in as zero error would
 * flatter a pipeline that holds everything back.
 */
export function unitsPerPackError(pairs) {
  let n = 0;
  let absoluteError = 0;
  let exact = 0;
  let noPrediction = 0;
  const worst = [];

  for (const pair of pairs) {
    const expected = pair.truth.unitsPerPack;
    if (expected === null || expected === undefined) continue;
    const actual = pair.predicted?.unitsPerPack ?? null;
    if (actual === null) {
      noPrediction++;
      continue;
    }
    n++;
    const error = Math.abs(actual - expected);
    absoluteError += error;
    if (error === 0) exact++;
    else worst.push({ fixture: pair.fixture, line: pair.lineText, expected, actual, error });
  }

  worst.sort((a, b) => b.error - a.error);
  return {
    compared: n,
    noPrediction,
    mae: n === 0 ? null : absoluteError / n,
    exact,
    exactRate: n === 0 ? null : exact / n,
    worst: worst.slice(0, 10),
  };
}

/**
 * End-to-end agreement between the scorecard and the verdict a person scoring
 * the same record reached.
 *
 * `verdict` is the pass/fail agreement. `perCategory` counts the category rows
 * where variety count, unit count and perishable flag all agree, which is a much
 * harder test than the verdict alone: two records can both read "fail" while
 * disagreeing about every number underneath.
 */
export function verdictAgreement(records) {
  let verdictAgreed = 0;
  const disagreements = [];

  let categoryRows = 0;
  let categoryRowsAgreed = 0;
  let varietyRows = 0;
  let varietyRowsAgreed = 0;

  for (const record of records) {
    const { expected, actual } = record;
    if (expected.overall === actual.overall) verdictAgreed++;
    else {
      disagreements.push({
        fixture: record.fixture,
        expected: expected.overall,
        actual: actual.overall,
        // Which way the disagreement goes decides how bad it is.
        direction: actual.overall === "pass" ? "false pass" : "false fail",
      });
    }

    for (const [category, expectedRow] of Object.entries(expected.categories)) {
      const actualRow = actual.categories[category];
      categoryRows++;
      varietyRows++;
      if (expectedRow.varieties === actualRow.varieties) varietyRowsAgreed++;
      if (
        expectedRow.varieties === actualRow.varieties &&
        expectedRow.units === actualRow.units &&
        expectedRow.perishable === actualRow.perishable
      ) {
        categoryRowsAgreed++;
      }
    }
  }

  const total = records.length;
  return {
    records: total,
    verdictAgreed,
    verdictRate: total === 0 ? null : verdictAgreed / total,
    falsePasses: disagreements.filter((d) => d.direction === "false pass").length,
    falseFails: disagreements.filter((d) => d.direction === "false fail").length,
    disagreements,
    categoryRows,
    categoryRowsAgreed,
    categoryRowRate: categoryRows === 0 ? null : categoryRowsAgreed / categoryRows,
    varietyRows,
    varietyRowsAgreed,
    varietyRowRate: varietyRows === 0 ? null : varietyRowsAgreed / varietyRows,
  };
}

/** The same line-level metrics, split by the failure mode each line is tagged with. */
export function byTag(pairs, tags) {
  const result = {};
  for (const tag of tags) {
    const tagged = pairs.filter((pair) => pair.tags.includes(tag));
    if (tagged.length === 0) continue;
    const counted = countedConfusion(tagged);
    result[tag] = {
      lines: tagged.length,
      countedCorrectly: counted.rate,
      overcounted: counted.overcounted,
      undercounted: counted.undercounted,
      unitsPerPack: unitsPerPackError(tagged),
    };
  }
  return result;
}

/** "84.2%" or "n/a" — one place, so no table formats a rate differently. */
export function percent(rate, digits = 1) {
  return rate === null || rate === undefined ? "n/a" : `${(rate * 100).toFixed(digits)}%`;
}

/** "1.42" or "n/a". */
export function number(value, digits = 2) {
  return value === null || value === undefined ? "n/a" : value.toFixed(digits);
}
