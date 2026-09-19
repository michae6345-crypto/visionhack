/**
 * The catalogue and presets behind the interactive shelf (components/ShelfSimulator).
 *
 * This file holds stock, not rules. It names varieties a corner store actually
 * buys, says which of them are perishable, and builds unit maps for the presets.
 * The verdict comes from lib/rules/standard.ts and nowhere else, so the shelf a
 * visitor builds is scored by the same arithmetic as a scanned order record.
 *
 * The presets are DERIVED rather than typed out by hand. A preset labelled
 * "meets the standard" that quietly does not meet it would teach the rule
 * wrong, so `meetsPreset()` assigns units from the thresholds themselves and
 * scripts/shelf.test.mjs asserts each preset lands on the verdict it claims.
 */
import { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY, type Category } from "./rules/constants";
import { REQUIRED_VARIETIES_PER_CATEGORY, type CountableLine } from "./rules/standard";

export interface ShelfVariety {
  id: string;
  category: Category;
  /** Display name, English. */
  en: string;
  /** Display name, Spanish. */
  es: string;
  /**
   * Whether stocking this variety gives its category a perishable. Fresh,
   * refrigerated and frozen items qualify; a can or a box does not.
   */
  perishable: boolean;
  /** Units in the "typical corner store" preset. */
  typical: number;
}

/**
 * Nine varieties per category: two more than the seven the rule asks for, so a
 * visitor can overshoot as well as fall short.
 *
 * Perishable varieties come first in each category. `meetsPreset()` fills from
 * the front, which is what makes the perishable requirement land for free
 * there — the preset that meets the standard has to meet all of it.
 */
export const SHELF_CATALOGUE: readonly ShelfVariety[] = [
  // --- Dairy -------------------------------------------------------------
  { id: "whole-milk", category: "dairy", en: "Whole milk", es: "Leche entera", perishable: true, typical: 6 },
  { id: "two-percent", category: "dairy", en: "2% milk", es: "Leche 2%", perishable: true, typical: 4 },
  { id: "yogurt", category: "dairy", en: "Yogurt cups", es: "Vasos de yogur", perishable: true, typical: 12 },
  { id: "cheddar", category: "dairy", en: "Cheddar block", es: "Queso cheddar", perishable: true, typical: 3 },
  { id: "slices", category: "dairy", en: "American slices", es: "Queso americano", perishable: true, typical: 4 },
  { id: "cottage", category: "dairy", en: "Cottage cheese", es: "Queso cottage", perishable: true, typical: 0 },
  { id: "sour-cream", category: "dairy", en: "Sour cream", es: "Crema agria", perishable: true, typical: 3 },
  { id: "evaporated", category: "dairy", en: "Evaporated milk", es: "Leche evaporada", perishable: false, typical: 6 },
  { id: "shelf-milk", category: "dairy", en: "Shelf-stable milk", es: "Leche de larga vida", perishable: false, typical: 0 },

  // --- Grains ------------------------------------------------------------
  { id: "white-bread", category: "grains", en: "White bread", es: "Pan blanco", perishable: true, typical: 8 },
  { id: "corn-tortillas", category: "grains", en: "Corn tortillas", es: "Tortillas de maíz", perishable: true, typical: 10 },
  { id: "flour-tortillas", category: "grains", en: "Flour tortillas", es: "Tortillas de harina", perishable: true, typical: 6 },
  { id: "buns", category: "grains", en: "Hamburger buns", es: "Panes de hamburguesa", perishable: true, typical: 2 },
  { id: "rice", category: "grains", en: "Long-grain rice", es: "Arroz de grano largo", perishable: false, typical: 9 },
  { id: "pasta", category: "grains", en: "Dry pasta", es: "Pasta seca", perishable: false, typical: 7 },
  { id: "oatmeal", category: "grains", en: "Oatmeal", es: "Avena", perishable: false, typical: 3 },
  { id: "cereal", category: "grains", en: "Corn flakes", es: "Hojuelas de maíz", perishable: false, typical: 4 },
  { id: "masa", category: "grains", en: "Masa flour", es: "Harina de masa", perishable: false, typical: 0 },

  // --- Protein -----------------------------------------------------------
  { id: "ground-beef", category: "protein", en: "Ground beef", es: "Carne molida", perishable: true, typical: 5 },
  { id: "chicken", category: "protein", en: "Chicken thighs", es: "Muslos de pollo", perishable: true, typical: 4 },
  { id: "pork-chops", category: "protein", en: "Pork chops", es: "Chuletas de cerdo", perishable: true, typical: 0 },
  { id: "eggs", category: "protein", en: "Eggs", es: "Huevos", perishable: true, typical: 12 },
  { id: "hot-dogs", category: "protein", en: "Hot dogs", es: "Salchichas", perishable: true, typical: 2 },
  { id: "tuna", category: "protein", en: "Canned tuna", es: "Atún en lata", perishable: false, typical: 8 },
  { id: "canned-beans", category: "protein", en: "Canned beans", es: "Frijoles en lata", perishable: false, typical: 9 },
  { id: "dry-beans", category: "protein", en: "Dry pinto beans", es: "Frijoles pintos secos", perishable: false, typical: 0 },
  { id: "peanut-butter", category: "protein", en: "Peanut butter", es: "Crema de cacahuate", perishable: false, typical: 4 },

  // --- Fruits and vegetables --------------------------------------------
  { id: "bananas", category: "produce", en: "Bananas", es: "Plátanos", perishable: true, typical: 14 },
  { id: "apples", category: "produce", en: "Apples", es: "Manzanas", perishable: true, typical: 9 },
  { id: "tomatoes", category: "produce", en: "Roma tomatoes", es: "Tomates roma", perishable: true, typical: 6 },
  { id: "onions", category: "produce", en: "Yellow onions", es: "Cebollas amarillas", perishable: true, typical: 5 },
  { id: "potatoes", category: "produce", en: "Russet potatoes", es: "Papas russet", perishable: true, typical: 4 },
  { id: "lettuce", category: "produce", en: "Iceberg lettuce", es: "Lechuga iceberg", perishable: true, typical: 2 },
  { id: "oranges", category: "produce", en: "Oranges", es: "Naranjas", perishable: true, typical: 0 },
  { id: "canned-corn", category: "produce", en: "Canned corn", es: "Maíz en lata", perishable: false, typical: 6 },
  { id: "canned-peaches", category: "produce", en: "Canned peaches", es: "Duraznos en lata", perishable: false, typical: 0 },
];

/** Units on the shelf, keyed by variety id. A missing id means zero. */
export type ShelfUnits = Record<string, number>;

export const SHELF_MAX_UNITS = 24;

export function varietiesIn(category: Category): ShelfVariety[] {
  return SHELF_CATALOGUE.filter((v) => v.category === category);
}

export function varietyById(id: string): ShelfVariety | undefined {
  return SHELF_CATALOGUE.find((v) => v.id === id);
}

/**
 * Turn a shelf into the countable lines the standard scores.
 *
 * Zero-unit varieties are dropped rather than passed through at 0: a variety
 * the store does not carry is absent, not present-and-empty, and the standard
 * treats a near miss (1-2 units) differently from nothing at all.
 */
export function shelfLines(units: ShelfUnits): CountableLine[] {
  const lines: CountableLine[] = [];
  for (const variety of SHELF_CATALOGUE) {
    const count = units[variety.id] ?? 0;
    if (count <= 0) continue;
    lines.push({
      category: variety.category,
      variety: variety.en,
      units: count,
      perishable: variety.perishable,
    });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
export type PresetId = "typical" | "oneShort" | "meets" | "empty";

/** Nothing on the shelf. */
export function emptyPreset(): ShelfUnits {
  return {};
}

/** What a real corner store's order record tends to look like: short in places. */
export function typicalPreset(): ShelfUnits {
  const units: ShelfUnits = {};
  for (const variety of SHELF_CATALOGUE) {
    if (variety.typical > 0) units[variety.id] = variety.typical;
  }
  return units;
}

/**
 * Exactly at the threshold, derived from it: the first
 * REQUIRED_VARIETIES_PER_CATEGORY varieties of each category at the per-variety
 * minimum. That is 7 x 3 = 21 units a category and 84 across the four, with
 * perishables in every category because the catalogue lists them first.
 */
export function meetsPreset(): ShelfUnits {
  const units: ShelfUnits = {};
  for (const category of CATEGORIES) {
    for (const variety of varietiesIn(category).slice(0, REQUIRED_VARIETIES_PER_CATEGORY)) {
      units[variety.id] = MIN_STOCKING_UNITS_PER_VARIETY;
    }
  }
  return units;
}

/**
 * The cliff. One unit below `meetsPreset`, which costs the category a whole
 * variety and all three of that variety's units, because units in a variety
 * below the minimum count for nothing.
 */
export const ONE_SHORT_ID = "yogurt";

export function oneShortPreset(): ShelfUnits {
  const units = meetsPreset();
  units[ONE_SHORT_ID] = MIN_STOCKING_UNITS_PER_VARIETY - 1;
  return units;
}

export const SHELF_PRESETS: Record<PresetId, () => ShelfUnits> = {
  typical: typicalPreset,
  oneShort: oneShortPreset,
  meets: meetsPreset,
  empty: emptyPreset,
};

export function presetUnits(id: PresetId): ShelfUnits {
  return SHELF_PRESETS[id]();
}
