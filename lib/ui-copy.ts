/**
 * UI chrome strings for the dashboard, in the same two locales the API returns
 * its scorecard in. Scorecard content itself (labels, fixes) comes from the
 * API's `scorecard` / `scorecardEs`; this file only covers the surrounding UI.
 */
import type { ScanResult } from "./mock-data";
import type { Locale } from "./scorecard-copy";
import {
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
} from "./rule-engine";

export type { Locale };

export interface UiCopy {
  tagline: string;
  uploadTitle: string;
  uploadHint: string;
  dropHere: string;
  chooseFile: string;
  storeNameLabel: string;
  storeNamePlaceholder: string;
  scan: string;
  scanning: string;
  rescan: string;
  tryError: string;
  loadSample: string;
  clear: string;
  verdictPass: string;
  verdictFail: string;
  totalUnits: string;
  perishableMet: string;
  varieties: string;
  units: string;
  perishableYes: string;
  perishableNo: string;
  fixesTitle: string;
  fixesEmpty: string;
  whyItHelps: string;
  /** Clipped to the result, as docs/regulatory-basis.md requires. */
  disclosure: string;
  unitsToAdd: string;
  clearsLabel: string;
  planSummary(units: number, items: number): string;
  planShort: string;
  scannedOn: string;
  categoriesPassing: string;
  requiredNote: string;
  sampleBadge: string;
  perishableShort: string;
}

export const UI_COPY: Record<Locale, UiCopy> = {
  en: {
    tagline: "Photograph a wholesale order record. Know in seconds if a store is actually stocked.",
    uploadTitle: "Scan a wholesale order record",
    uploadHint: "JPG, PNG, or WebP up to 8 MB. A clear photo of the printed order record works best.",
    dropHere: "Drop the order record photo here",
    chooseFile: "Choose photo",
    storeNameLabel: "Store name",
    storeNamePlaceholder: "e.g. Rivera's Corner Market",
    scan: "Run scan",
    scanning: "Reading order record",
    rescan: "Scan another",
    tryError: "Something went wrong",
    loadSample: "View a sample scorecard",
    clear: "Clear",
    // The approved claim pattern, verbatim from docs/regulatory-basis.md. Not
    // "well stocked" or "understocked": Ledger has seen one order record, which
    // does not support a statement about the shelf.
    verdictPass: "Estimated to meet the stocking standard",
    verdictFail: "May not meet the stocking standard yet",
    totalUnits: "Total stocking units",
    perishableMet: "Categories with a perishable",
    varieties: "varieties",
    units: "units",
    perishableYes: "Perishable stocked",
    perishableNo: "No perishable",
    fixesTitle: "Smallest order that clears every requirement",
    disclosure:
      "Readiness estimate only. Ledger checks the items it can read on this record " +
      "against the Criterion A stocking thresholds. It is not an official USDA " +
      "eligibility determination.",
    unitsToAdd: "units to add",
    clearsLabel: "Clears",
    planSummary: (units, items) =>
      `${units} stocking ${units === 1 ? "unit" : "units"} across ${items} ${items === 1 ? "item" : "items"}, solved for the fewest units added.`,
    planShort:
      "These items do not close every gap on their own. The requirements still " +
      "unmet are listed above.",
    fixesEmpty: "Nothing to fix. Every category clears its minimums.",
    whyItHelps: "Why it helps",
    scannedOn: "Scanned",
    categoriesPassing: "categories clear",
    requiredNote: "Target: 7 varieties and 21 units per category.",
    sampleBadge: "Sample",
    perishableShort: "perishable",
  },
  es: {
    tagline: "Fotografíe un registro de pedido mayorista. Sepa en segundos si una tienda está bien surtida.",
    uploadTitle: "Escanear un registro de pedido mayorista",
    uploadHint: "JPG, PNG o WebP hasta 8 MB. Una foto clara del registro de pedido impreso funciona mejor.",
    dropHere: "Suelte aquí la foto del registro de pedido",
    chooseFile: "Elegir foto",
    storeNameLabel: "Nombre de la tienda",
    storeNamePlaceholder: "ej. Rivera's Corner Market",
    scan: "Escanear",
    scanning: "Leyendo el registro de pedido",
    rescan: "Escanear otro",
    tryError: "Algo salió mal",
    loadSample: "Ver un ejemplo",
    clear: "Borrar",
    verdictPass: "Se estima que cumple con la norma de surtido",
    verdictFail: "Es posible que aún no cumpla con la norma de surtido",
    totalUnits: "Unidades de surtido totales",
    perishableMet: "Categorías con un perecedero",
    varieties: "variedades",
    units: "unidades",
    perishableYes: "Perecedero surtido",
    perishableNo: "Sin perecedero",
    fixesTitle: "El pedido más pequeño que cumple con todos los requisitos",
    disclosure:
      "Solo es una estimación. Ledger revisa los artículos que puede leer en este " +
      "registro y los compara con los mínimos del Criterio A. No es una " +
      "determinación oficial de elegibilidad del USDA.",
    unitsToAdd: "unidades por agregar",
    clearsLabel: "Cumple",
    planSummary: (units, items) =>
      `${units} ${units === 1 ? "unidad" : "unidades"} de surtido en ${items} ${items === 1 ? "artículo" : "artículos"}, calculado para agregar lo menos posible.`,
    planShort:
      "Estos artículos no cierran todas las brechas por sí solos. Los requisitos " +
      "que siguen sin cumplirse aparecen arriba.",
    fixesEmpty: "No hay nada que corregir. Cada categoría cumple sus mínimos.",
    whyItHelps: "Por qué ayuda",
    scannedOn: "Escaneado",
    categoriesPassing: "categorías cumplen",
    requiredNote: "Meta: 7 variedades y 21 unidades por categoría.",
    sampleBadge: "Ejemplo",
    perishableShort: "perecedero",
  },
};

/**
 * Category-level pass targets, re-exported from the rule engine rather than
 * retyped. Mirroring these by hand is how the marketing page ended up
 * advertising a 3-variety rule while the scanner scored against 7.
 */
export const REQUIRED_VARIETIES = REQUIRED_VARIETIES_PER_CATEGORY;
export const REQUIRED_UNITS = REQUIRED_UNITS_PER_CATEGORY;

/**
 * `scanDate` is a calendar date ("2026-09-12"). `new Date()` reads that as
 * midnight UTC, which is still the previous day west of UTC, so a Los Angeles
 * browser showed yesterday. Formatting in UTC shows the date the API sent.
 */
export function formatScanDate(scanDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(scanDate));
}

/** Categories still under the variety or unit minimum. */
export function shortCategories(result: ScanResult): ScanResult["categories"] {
  return result.categories.filter(
    (c) => c.varietiesFound < REQUIRED_VARIETIES || c.unitsFound < REQUIRED_UNITS,
  );
}

/** One sentence a store owner can act on without reading the rest. */
export function scorecardReading(result: ScanResult, locale: Locale): string {
  const es = locale === "es";
  if (result.overallStatus === "pass") {
    return es
      ? "Las cuatro categorías cumplen el mínimo. No hay nada que corregir esta semana."
      : "All four categories clear the minimum. Nothing to fix this week.";
  }

  const short = shortCategories(result);
  if (short.length === 0) {
    // Every category clears, so the perishable rule is what failed.
    const met = result.perishableCategoriesMet;
    return es
      ? `Las cuatro categorías cumplen, pero solo ${met} de 4 tienen un perecedero.`
      : `All four categories clear, but only ${met} of 4 include a perishable item.`;
  }

  const sentences = short.map((c) => {
    const v = REQUIRED_VARIETIES - c.varietiesFound;
    const u = REQUIRED_UNITS - c.unitsFound;
    const parts = [
      v > 0 ? `${v} ${es ? "variedades" : `variet${v === 1 ? "y" : "ies"}`}` : null,
      u > 0 ? `${u} ${es ? "unidades" : "units"}` : null,
    ].filter(Boolean);
    return es
      ? `A ${c.label} le faltan ${parts.join(" y ")}.`
      : `${c.label} is ${parts.join(" and ")} short.`;
  });

  // Mention the rest only when some of them clear: "The other 0 categories
  // clear" read as a bug on the live demo.
  const clearing = result.categories.length - short.length;
  if (clearing === 1) {
    sentences.push(es ? "La otra categoría cumple." : "The other category clears.");
  } else if (clearing > 1) {
    sentences.push(
      es ? `Las otras ${clearing} categorías cumplen.` : `The other ${clearing} categories clear.`,
    );
  }
  return sentences.join(" ");
}

/** Spanish for the fixed reasons the scan route writes on a held-back line. */
const HELD_BACK_REASONS_ES: Record<string, string> = {
  "Could not determine the pack count.": "No se pudo determinar cuántas unidades trae cada empaque.",
  "Could not read the quantity.": "No se pudo leer la cantidad.",
  "Could not determine pack size or quantity.": "No se pudo determinar el empaque ni la cantidad.",
  "The transcribed line was not fully legible.": "La línea no se pudo leer por completo.",
};

/**
 * A held-back line's reason in the reader's language. Reasons the model wrote
 * itself are English free text, so Spanish mode falls back to "No se contó."
 */
export function heldBackReason(reason: string, locale: Locale): string {
  if (locale === "en") return reason;
  const lowConfidence = reason.match(/^Low confidence \((\d+(?:\.\d+)?)\)\.$/);
  if (lowConfidence) return `Lectura poco confiable (${lowConfidence[1]}).`;
  return HELD_BACK_REASONS_ES[reason] ?? "No se contó.";
}
