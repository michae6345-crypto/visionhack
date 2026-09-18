/**
 * Every string the rule engine writes into a scorecard, in English and Spanish:
 * category labels, the fix-list suggestions, and the templates `whyItHelps` is
 * built from.
 *
 * Kept apart from lib/rule-engine.ts so the Spanish can be reviewed and edited
 * without touching scoring logic. Numbers are passed in, never hard-coded, so
 * the copy can't drift from the rule.
 *
 * Not translated: item names and varieties. They come from the invoice and the
 * classifier, so they read the same in both scorecards.
 */
import type { Category } from "./rules/constants";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export interface ScorecardCopy {
  categoryLabels: Record<Category, string>;
  /** "brings dairy to 5 of 7 varieties" */
  varietyGain(category: Category, reached: number, required: number): string;
  /** "gets dairy to its 21-unit minimum" — for units added to a variety that already counts. */
  unitGain(category: Category, required: number): string;
  /** "gives dairy a perishable item, needed in 3 of 4 categories" */
  perishableGain(category: Category, required: number, categoryCount: number): string;
  /** "adds 3 units toward the 84-unit total" — when no other minimum is short. */
  towardTotalGain(units: number, required: number): string;
  /** Appended to a fix when the category gains the perishable it was missing. */
  addsMissingPerishable(category: Category): string;
  /** "Select Cucumber bushel (stock 1 more)" */
  topUpSuggestion(name: string, more: number): string;
  topUpReason(units: number, variety: string, more: number, minUnits: number, gain: string): string;
  newItemReason(pitch: string, minUnits: number, gain: string): string;
  extraUnitsReason(units: number, gain: string): string;
  /** Fallback naming when a planned variety has no catalogue entry. */
  stockSuggestion(variety: string, units: number): string;
  /** " This clears the dairy variety minimum (7) and the 84-unit total." */
  clearsSuffix(phrases: string[]): string;
  /** Names one requirement, for the sentence above. */
  constraintPhrases: {
    categoryVarieties(category: Category, required: number): string;
    categoryUnits(category: Category, required: number): string;
    totalUnits(required: number): string;
    perishableCategories(required: number, categoryCount: number): string;
  };
}

/** "a", "a and b", "a, b and c" — and the Spanish equivalent. */
function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** Spanish category names as they read mid-sentence, article included. */
const ES_CATEGORY_IN_SENTENCE: Record<Category, string> = {
  dairy: "los lácteos",
  grains: "los granos",
  protein: "las proteínas",
  produce: "las frutas y verduras",
};

/** The same names after a preposition, where the article is dropped. */
const ES_CATEGORY_SHORT: Record<Category, string> = {
  dairy: "lácteos",
  grains: "granos",
  protein: "proteínas",
  produce: "frutas y verduras",
};

export const SCORECARD_COPY: Record<Locale, ScorecardCopy> = {
  en: {
    categoryLabels: {
      dairy: "Dairy",
      grains: "Grains",
      protein: "Protein",
      produce: "Fruits and Vegetables",
    },
    varietyGain: (category, reached, required) =>
      `brings ${category} to ${reached} of ${required} varieties`,
    unitGain: (category, required) => `gets ${category} to its ${required}-unit minimum`,
    perishableGain: (category, required, categoryCount) =>
      `gives ${category} a perishable item, needed in ${required} of ${categoryCount} categories`,
    towardTotalGain: (units, required) =>
      `adds ${units} ${units === 1 ? "unit" : "units"} toward the ${required}-unit total`,
    addsMissingPerishable: (category) => ` and adds the perishable item ${category} is missing`,
    topUpSuggestion: (name, more) => `${name} (stock ${more} more)`,
    topUpReason: (units, variety, more, minUnits, gain) =>
      `You already stock ${units} ${units === 1 ? "unit" : "units"} of ${variety}; ${more} more meets the ${minUnits}-unit minimum and ${gain}.`,
    newItemReason: (pitch, minUnits, gain) => `${pitch} Stocking ${minUnits} ${gain}.`,
    extraUnitsReason: (units, gain) =>
      `${units} more ${units === 1 ? "unit" : "units"} of a variety that already counts ${gain}.`,
    stockSuggestion: (variety, units) => `${variety} (stock ${units})`,
    clearsSuffix: (phrases) => ` Clears ${joinList(phrases, "and")}.`,
    constraintPhrases: {
      categoryVarieties: (category, required) =>
        `the ${category} minimum of ${required} varieties`,
      categoryUnits: (category, required) => `the ${category} minimum of ${required} units`,
      totalUnits: (required) => `the ${required}-unit total`,
      perishableCategories: (required, categoryCount) =>
        `the perishable rule, ${required} of ${categoryCount} categories`,
    },
  },
  es: {
    categoryLabels: {
      dairy: "Lácteos",
      grains: "Granos",
      protein: "Proteínas",
      produce: "Frutas y verduras",
    },
    varietyGain: (category, reached, required) =>
      `lleva ${ES_CATEGORY_IN_SENTENCE[category]} a ${reached} de ${required} variedades`,
    unitGain: (category, required) =>
      `lleva ${ES_CATEGORY_IN_SENTENCE[category]} a su mínimo de ${required} unidades`,
    perishableGain: (category, required, categoryCount) =>
      `le da a ${ES_CATEGORY_IN_SENTENCE[category]} un producto perecedero, necesario en ${required} de ${categoryCount} categorías`,
    towardTotalGain: (units, required) =>
      `agrega ${units} ${units === 1 ? "unidad" : "unidades"} al total de ${required} unidades`,
    addsMissingPerishable: (category) =>
      ` y agrega el producto perecedero que les falta a ${ES_CATEGORY_IN_SENTENCE[category]}`,
    topUpSuggestion: (name, more) => `${name} (surta ${more} más)`,
    topUpReason: (units, variety, more, minUnits, gain) =>
      `Ya tiene ${units} ${units === 1 ? "unidad" : "unidades"} de ${variety}; con ${more} más cumple el mínimo de ${minUnits} unidades y ${gain}.`,
    newItemReason: (pitch, minUnits, gain) => `${pitch} Surtir ${minUnits} ${gain}.`,
    extraUnitsReason: (units, gain) =>
      `${units} ${units === 1 ? "unidad" : "unidades"} más de una variedad que ya cuenta ${gain}.`,
    stockSuggestion: (variety, units) => `${variety} (surta ${units})`,
    clearsSuffix: (phrases) => ` Cumple ${joinList(phrases, "y")}.`,
    constraintPhrases: {
      categoryVarieties: (category, required) =>
        `el mínimo de ${required} variedades de ${ES_CATEGORY_SHORT[category]}`,
      categoryUnits: (category, required) =>
        `el mínimo de ${required} unidades de ${ES_CATEGORY_SHORT[category]}`,
      totalUnits: (required) => `el total de ${required} unidades`,
      perishableCategories: (required, categoryCount) =>
        `la regla de perecederos, ${required} de ${categoryCount} categorías`,
    },
  },
};

type SuggestionText = { itemSuggestion: string; pitch: string };

export type Suggestion = {
  /** Compared loosely with what the store carries, so nothing is suggested twice. */
  variety: string;
  perishable: boolean;
} & Record<Locale, SuggestionText>;

/**
 * Common, low-cost staples a corner store can add.
 *
 * Order is a preference, not a ranking: lib/rules/optimizer.ts chooses on added
 * stocking units and uses this order only to break ties, so shelf-stable options
 * are listed first and a store is not told to buy fridge space it does not need.
 *
 * SEVEN PER CATEGORY IS A FLOOR, not a round number. A category with nothing in
 * it needs seven varieties, and every variety the store already carries is
 * filtered out of its own category, so a shorter list would leave gaps the
 * optimiser cannot close. It reports `sufficient: false` when that happens
 * rather than pretending a partial plan passes.
 */
export const SUGGESTIONS: Record<Category, Suggestion[]> = {
  dairy: [
    {
      variety: "evaporated milk", perishable: false,
      en: { itemSuggestion: "Carnation Evaporated Milk, 12 oz can (stock 3)", pitch: "Shelf-stable, no fridge space needed." },
      es: { itemSuggestion: "Leche evaporada Carnation, lata de 12 oz (surta 3)", pitch: "Se conserva sin refrigeración y no ocupa espacio en el refrigerador." },
    },
    {
      variety: "powdered milk", perishable: false,
      en: { itemSuggestion: "Nido Fortificada Dry Milk, 12.6 oz (stock 3)", pitch: "Shelf-stable and a steady seller with families." },
      es: { itemSuggestion: "Leche en polvo Nido Fortificada, 12.6 oz (surta 3)", pitch: "Se conserva sin refrigeración y las familias la compran seguido." },
    },
    {
      variety: "cottage cheese", perishable: true,
      en: { itemSuggestion: "Daisy Cottage Cheese, 16 oz (stock 3)", pitch: "A low-cost refrigerated staple." },
      es: { itemSuggestion: "Queso cottage Daisy, 16 oz (surta 3)", pitch: "Un básico refrigerado de bajo costo." },
    },
    {
      variety: "american cheese", perishable: true,
      en: { itemSuggestion: "Kraft Singles American Cheese, 12 ct (stock 3)", pitch: "Sliced cheese sells alongside bread and lunch meat." },
      es: { itemSuggestion: "Queso americano Kraft Singles, 12 rebanadas (surta 3)", pitch: "El queso en rebanadas se vende junto con el pan y las carnes frías." },
    },
    {
      variety: "mozzarella cheese", perishable: true,
      en: { itemSuggestion: "Galbani Mozzarella String Cheese, 12 ct (stock 3)", pitch: "A grab-and-go refrigerated snack." },
      es: { itemSuggestion: "Queso mozzarella en tiras Galbani, 12 piezas (surta 3)", pitch: "Una botana refrigerada para llevar." },
    },
    {
      variety: "sour cream", perishable: true,
      en: { itemSuggestion: "Daisy Sour Cream, 16 oz (stock 3)", pitch: "A refrigerated staple that moves with tortillas and beans." },
      es: { itemSuggestion: "Crema Daisy, 16 oz (surta 3)", pitch: "Un básico refrigerado que se vende con las tortillas y los frijoles." },
    },
    {
      variety: "cream cheese", perishable: true,
      en: { itemSuggestion: "Philadelphia Cream Cheese, 8 oz (stock 3)", pitch: "Keeps for weeks refrigerated and sells with bread." },
      es: { itemSuggestion: "Queso crema Philadelphia, 8 oz (surta 3)", pitch: "Dura semanas refrigerado y se vende con el pan." },
    },
  ],
  grains: [
    {
      variety: "corn tortillas", perishable: false,
      en: { itemSuggestion: "Mission Corn Tortillas, 30 ct (stock 3)", pitch: "A daily staple that sells fast." },
      es: { itemSuggestion: "Tortillas de maíz Mission, 30 piezas (surta 3)", pitch: "Un básico de todos los días que se vende rápido." },
    },
    {
      variety: "corn masa flour", perishable: false,
      en: { itemSuggestion: "Maseca Instant Corn Masa Flour, 4.4 lb (stock 3)", pitch: "Shelf-stable and a staple for home cooks." },
      es: { itemSuggestion: "Harina de maíz instantánea Maseca, 4.4 lb (surta 3)", pitch: "Se conserva sin refrigeración y es básica para cocinar en casa." },
    },
    {
      variety: "saltine crackers", perishable: false,
      en: { itemSuggestion: "Premium Original Saltine Crackers, 16 oz (stock 3)", pitch: "Shelf-stable and cheap." },
      es: { itemSuggestion: "Galletas saladas Premium Original, 16 oz (surta 3)", pitch: "Se conservan sin refrigeración y son baratas." },
    },
    {
      variety: "white bread", perishable: true,
      en: { itemSuggestion: "Bimbo Soft White Bread, 20 oz (stock 3)", pitch: "Fresh bread is perishable and sells every day." },
      es: { itemSuggestion: "Pan blanco Bimbo, 20 oz (surta 3)", pitch: "El pan fresco es perecedero y se vende todos los días." },
    },
    {
      variety: "bolillo rolls", perishable: true,
      en: { itemSuggestion: "Fresh Bolillo Rolls, 6 ct (stock 3)", pitch: "Fresh bakery rolls are perishable and sell daily." },
      es: { itemSuggestion: "Bolillos frescos, 6 piezas (surta 3)", pitch: "El pan fresco de panadería es perecedero y se vende a diario." },
    },
    {
      variety: "white rice", perishable: false,
      en: { itemSuggestion: "Mahatma Long Grain White Rice, 2 lb (stock 3)", pitch: "Shelf-stable and one of the steadiest sellers in the store." },
      es: { itemSuggestion: "Arroz blanco de grano largo Mahatma, 2 lb (surta 3)", pitch: "Se conserva sin refrigeración y es de lo que más se vende." },
    },
    {
      variety: "elbow macaroni", perishable: false,
      en: { itemSuggestion: "Barilla Elbow Macaroni, 16 oz (stock 3)", pitch: "Shelf-stable, cheap, and a different grain variety from rice." },
      es: { itemSuggestion: "Coditos Barilla, 16 oz (surta 3)", pitch: "Se conservan sin refrigeración, son baratos y cuentan como una variedad distinta al arroz." },
    },
  ],
  protein: [
    {
      variety: "canned salmon", perishable: false,
      en: { itemSuggestion: "Bumble Bee Pink Salmon, 14.75 oz can (stock 3)", pitch: "Shelf-stable, no fridge space needed." },
      es: { itemSuggestion: "Salmón rosado Bumble Bee, lata de 14.75 oz (surta 3)", pitch: "Se conserva sin refrigeración y no ocupa espacio en el refrigerador." },
    },
    {
      variety: "vienna sausage", perishable: false,
      en: { itemSuggestion: "Libby's Vienna Sausage, 4.6 oz can (stock 3)", pitch: "Cheap, shelf-stable and a quick seller." },
      es: { itemSuggestion: "Salchichas Vienna Libby's, lata de 4.6 oz (surta 3)", pitch: "Baratas, se conservan sin refrigeración y se venden rápido." },
    },
    {
      variety: "chicken", perishable: true,
      en: { itemSuggestion: "Fresh Chicken Drumsticks, family pack (stock 3)", pitch: "A low-cost fresh meat families buy often." },
      es: { itemSuggestion: "Piernas de pollo frescas, paquete familiar (surta 3)", pitch: "Carne fresca de bajo costo que las familias compran seguido." },
    },
    {
      variety: "chorizo", perishable: true,
      en: { itemSuggestion: "Cacique Pork Chorizo, 9 oz (stock 3)", pitch: "A refrigerated staple for breakfast and tacos." },
      es: { itemSuggestion: "Chorizo de puerco Cacique, 9 oz (surta 3)", pitch: "Un básico refrigerado para el desayuno y los tacos." },
    },
    {
      variety: "ground turkey", perishable: true,
      en: { itemSuggestion: "Jennie-O Ground Turkey, 1 lb (stock 3)", pitch: "Refrigerated and priced close to ground beef." },
      es: { itemSuggestion: "Pavo molido Jennie-O, 1 lb (surta 3)", pitch: "Refrigerado y con un precio parecido al de la carne molida de res." },
    },
    {
      variety: "dried pinto beans", perishable: false,
      en: { itemSuggestion: "Dried Pinto Beans, 2 lb bag (stock 3)", pitch: "Shelf-stable and counted as protein, not produce." },
      es: { itemSuggestion: "Frijol pinto seco, bolsa de 2 lb (surta 3)", pitch: "Se conserva sin refrigeración y cuenta como proteína, no como verdura." },
    },
    {
      variety: "eggs", perishable: true,
      en: { itemSuggestion: "Grade A Large Eggs, 12 ct (stock 3)", pitch: "Refrigerated, counted as protein, and bought weekly." },
      es: { itemSuggestion: "Huevo grande Grado A, 12 piezas (surta 3)", pitch: "Refrigerado, cuenta como proteína y se compra cada semana." },
    },
  ],
  produce: [
    {
      variety: "green beans", perishable: false,
      en: { itemSuggestion: "Del Monte Cut Green Beans, 14.5 oz can (stock 3)", pitch: "Canned vegetables count and keep for months." },
      es: { itemSuggestion: "Ejotes cortados Del Monte, lata de 14.5 oz (surta 3)", pitch: "Las verduras enlatadas cuentan y duran meses." },
    },
    {
      variety: "pineapple", perishable: false,
      en: { itemSuggestion: "Dole Pineapple Chunks, 20 oz can (stock 3)", pitch: "Canned fruit counts and keeps for months." },
      es: { itemSuggestion: "Piña en trozos Dole, lata de 20 oz (surta 3)", pitch: "La fruta enlatada cuenta y dura meses." },
    },
    {
      variety: "bananas", perishable: true,
      en: { itemSuggestion: "Bananas, per lb (stock 3)", pitch: "The cheapest fresh fruit and a daily seller." },
      es: { itemSuggestion: "Plátanos, por libra (surta 3)", pitch: "La fruta fresca más barata y se vende todos los días." },
    },
    {
      variety: "limes", perishable: true,
      en: { itemSuggestion: "Fresh Limes, per lb (stock 3)", pitch: "Cheap, fresh and they sell with almost everything." },
      es: { itemSuggestion: "Limones frescos, por libra (surta 3)", pitch: "Baratos, frescos y se venden con casi todo." },
    },
    {
      variety: "carrots", perishable: true,
      en: { itemSuggestion: "Carrots, 2 lb bag (stock 3)", pitch: "Fresh, cheap and they keep for weeks in the cooler." },
      es: { itemSuggestion: "Zanahorias, bolsa de 2 lb (surta 3)", pitch: "Frescas, baratas y duran semanas en el refrigerador." },
    },
    {
      variety: "canned corn", perishable: false,
      en: { itemSuggestion: "Del Monte Whole Kernel Corn, 15.25 oz (stock 3)", pitch: "Shelf-stable and no fridge space needed." },
      es: { itemSuggestion: "Elote en grano Del Monte, 15.25 oz (surta 3)", pitch: "Se conserva sin refrigeración y no ocupa espacio en el refrigerador." },
    },
    {
      variety: "potatoes", perishable: true,
      en: { itemSuggestion: "Russet Potatoes, 5 lb bag (stock 3)", pitch: "Fresh, keeps well in a dry corner, and sells year round." },
      es: { itemSuggestion: "Papa russet, bolsa de 5 lb (surta 3)", pitch: "Fresca, se conserva bien en un lugar seco y se vende todo el año." },
    },
  ],
};
