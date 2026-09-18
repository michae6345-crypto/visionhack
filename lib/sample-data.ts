/**
 * A bilingual sample scorecard so the dashboard is demonstrable without a live
 * scan. The English side reuses the agreed MOCK_RESULT fixture; the Spanish
 * side mirrors it with translated labels and fixes (item names and varieties
 * are intentionally left untranslated, matching the API contract).
 */
import { MOCK_RESULT, type ScanResult } from "./mock-data";
import type { Locale } from "./scorecard-copy";

const SAMPLE_ES: ScanResult = {
  ...MOCK_RESULT,
  categories: MOCK_RESULT.categories.map((c) => ({
    ...c,
    label: {
      dairy: "Lácteos",
      grains: "Granos",
      protein: "Proteínas",
      produce: "Frutas y verduras",
    }[c.category],
  })),
  fixes: [
    {
      category: "dairy",
      itemSuggestion: "Leche evaporada Carnation, lata de 12 oz (surta 3)",
      whyItHelps:
        "Se conserva sin refrigeración y cuesta menos de $2 la lata. Agrega una 5.ª variedad de lácteos sin ocupar espacio en el refrigerador.",
      addedUnits: 3,
      clears: [],
    },
    {
      category: "dairy",
      itemSuggestion: "Queso americano Kraft Singles, 12 rebanadas (surta 3)",
      whyItHelps: "Una variedad de queso distinta al cheddar, así cuenta como 6.ª variedad de lácteos.",
      addedUnits: 3,
      clears: [],
    },
    {
      category: "dairy",
      itemSuggestion: "Queso cottage Daisy, 16 oz (surta 3)",
      whyItHelps: "Lleva los lácteos a 7 variedades y 23 unidades, cumpliendo ambos mínimos.",
      addedUnits: 3,
      clears: ["el mínimo de 7 variedades de lácteos", "el mínimo de 21 unidades de lácteos"],
    },
  ],
};

export function sampleScorecard(locale: Locale): ScanResult {
  return locale === "es" ? SAMPLE_ES : MOCK_RESULT;
}

/**
 * Lines the scan read but deliberately did not count, with the reason. Demo
 * only: the live route reports held-back lines through its own response, and
 * this list stands in for that in the example report.
 */
export interface HeldBackLine {
  line: string;
  pack: string;
  reason: string;
  reasonEs: string;
}

export const SAMPLE_HELD_BACK: HeldBackLine[] = [
  {
    line: "ROMA TOMATOES",
    pack: "25 LB CS",
    reason: "Priced by weight, so there is no unit count to read",
    reasonEs: "Se vende por peso, así que no hay unidades que contar",
  },
  {
    line: "YELLOW ONIONS JUMBO",
    pack: "50 LB SACK",
    reason: "Priced by weight, so there is no unit count to read",
    reasonEs: "Se vende por peso, así que no hay unidades que contar",
  },
  {
    line: "SWEET CREAM BUTTER",
    pack: "36 x 4 OZ",
    reason: "Accessory food under the rule, counts for nothing",
    reasonEs: "Alimento accesorio según la regla, no cuenta",
  },
  {
    line: "PAPER TOWELS 2PLY",
    pack: "30 ROLL",
    reason: "Not a staple category",
    reasonEs: "No pertenece a una categoría básica",
  },
];
