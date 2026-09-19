/**
 * The fixture records: one wholesale order record each, built from the line
 * library in ./lines.mjs.
 *
 * EVERY RECORD HERE IS SYNTHETIC. None is a photograph of a real order record,
 * none of the vendors or invoice numbers is real, and no store named here
 * exists. eval/README.md says what that costs the numbers.
 *
 * `expected` is the verdict a person scoring this record reaches. It was
 * produced by the independent implementation in eval/reference-scoring.mjs and
 * committed here as a literal, so the harness compares the app against a fixed
 * expectation rather than against a fresh run of either implementation. Four
 * records are worked through by hand in eval/README.md.
 *
 * `style` picks how eval/render.mjs draws the image. `tags` are the failure
 * modes a record is meant to exercise, and the harness reports per tag.
 */
import { lineById } from "./lines.mjs";

const record = (id, spec) => ({ id, synthetic: true, ...spec });

export const RECORDS = [
  // -------------------------------------------------------------------------
  record("01-full-restock-laser", {
    title: "Full restock, clean laser print",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-884210",
    date: "2026-09-08",
    storeName: "Rivera's Corner Market",
    style: "laser",
    notes: "A store that meets the standard. Seven varieties in every category.",
    lines: [
      "milk-whole-gal", "cheese-cheddar", "yogurt-plain", "cheese-queso-fresco",
      "milk-evaporated", "cottage-cheese", "milk-powder",
      "tortillas-flour", "rice-white", "pasta-spaghetti", "oats-rolled",
      "cereal-oat", "masa-flour", "bread-white",
      "tuna-canned", "beef-ground", "franks-beef", "chicken-canned",
      "bologna", "chicken-drums", "sardines",
      "bananas-ct", "potatoes-russet", "onions-cooking", "corn-canned",
      "mandarin-cups", "lettuce-head", "limes",
      "paper-towels", "soda-cola",
    ],
    expected: {
      categories: {
        dairy: { varieties: 7, units: 86, perishable: true },
        grains: { varieties: 7, units: 106, perishable: true },
        protein: { varieties: 7, units: 134, perishable: true },
        produce: { varieties: 7, units: 446, perishable: true },
      },
      totalUnits: 772,
      perishableCategories: 4,
      overall: "pass",
    },
  }),

  // -------------------------------------------------------------------------
  record("02-full-restock-dotmatrix", {
    title: "Full restock, dot-matrix printer",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0099471",
    date: "2026-09-09",
    storeName: "La Esquina Market",
    style: "dotmatrix",
    notes: "Same shape as 01 on a worn dot-matrix printer, with a different mix.",
    lines: [
      "milk-lowfat-half", "cheese-singles", "yogurt-strawberry", "sour-cream",
      "milk-evaporated", "milk-powder", "cheese-cheddar",
      "tortillas-corn", "pasta-elbow", "crackers-saltine", "oats-rolled",
      "masa-flour", "bolillo", "rice-white",
      "salmon-canned", "peanut-butter", "beans-pinto-dry", "eggs-large",
      "chorizo", "bologna", "tuna-canned",
      "greenbeans-canned", "pineapple-canned", "spinach-frozen", "mixed-veg-frozen",
      "carrots-bag", "celery", "peppers-green",
      "butter-sweet-cream", "jerky-beef", "cigarettes",
    ],
    expected: {
      categories: {
        dairy: { varieties: 7, units: 105, perishable: true },
        grains: { varieties: 7, units: 102, perishable: true },
        protein: { varieties: 7, units: 140, perishable: true },
        produce: { varieties: 7, units: 132, perishable: true },
      },
      totalUnits: 479,
      perishableCategories: 4,
      overall: "pass",
    },
  }),

  // -------------------------------------------------------------------------
  record("03-dairy-short-laser", {
    title: "Dairy four varieties short",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-884655",
    date: "2026-09-10",
    storeName: "Rivera's Corner Market",
    style: "laser",
    notes: "Three categories clear; dairy has three varieties of the seven.",
    lines: [
      "milk-whole-gal", "cheese-cheddar", "yogurt-plain",
      "tortillas-flour", "rice-white", "pasta-spaghetti", "oats-rolled",
      "cereal-oat", "masa-flour", "bread-white",
      "tuna-canned", "beef-ground", "franks-beef", "chicken-canned",
      "bologna", "chicken-drums", "sardines",
      "bananas-ct", "potatoes-russet", "onions-cooking", "corn-canned",
      "mandarin-cups", "lettuce-head", "limes",
    ],
    expected: {
      categories: {
        dairy: { varieties: 3, units: 32, perishable: true },
        grains: { varieties: 7, units: 106, perishable: true },
        protein: { varieties: 7, units: 134, perishable: true },
        produce: { varieties: 7, units: 446, perishable: true },
      },
      totalUnits: 718,
      perishableCategories: 4,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("04-grains-all-shelf-stable", {
    title: "Perishables in exactly three of four categories",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0099610",
    date: "2026-09-11",
    storeName: "Sunset Food Mart",
    style: "laser",
    notes:
      "Grains carries no perishable variety. Three of four categories do, which is what the rule asks for, so the record passes at the threshold.",
    lines: [
      "milk-whole-gal", "cheese-cheddar", "yogurt-plain", "cheese-queso-fresco",
      "milk-evaporated", "cottage-cheese", "sour-cream",
      "tortillas-flour", "tortillas-corn", "rice-white", "pasta-spaghetti",
      "oats-rolled", "cereal-oat", "crackers-saltine",
      "tuna-canned", "beef-ground", "franks-beef", "chicken-canned",
      "bologna", "eggs-large", "sardines",
      "bananas-ct", "potatoes-russet", "onions-cooking", "corn-canned",
      "greenbeans-canned", "lettuce-head", "limes",
    ],
    expected: {
      categories: {
        dairy: { varieties: 7, units: 86, perishable: true },
        grains: { varieties: 7, units: 104, perishable: false },
        protein: { varieties: 7, units: 148, perishable: true },
        produce: { varieties: 7, units: 458, perishable: true },
      },
      totalUnits: 796,
      perishableCategories: 3,
      overall: "pass",
    },
  }),

  // -------------------------------------------------------------------------
  record("05-weight-priced-produce", {
    title: "Produce priced by weight",
    vendor: "Seventh Street Produce Co.",
    invoiceNo: "SSP-31882",
    date: "2026-09-07",
    storeName: "Rivera's Corner Market",
    style: "laser",
    notes:
      "The failure mode this tool has to be honest about: most of the order is priced by weight or by container, so the record shows no unit count and the lines cannot be counted.",
    lines: [
      "tomatoes-roma", "onions-jumbo-sack", "yams", "bananas",
      "cucumber-bushel", "cabbage-box", "tomatoes-grade", "rice-bulk",
      "beef-ground-bulk", "onions-cooking", "lettuce-head", "celery",
    ],
    expected: {
      categories: {
        dairy: { varieties: 0, units: 0, perishable: false },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 3, units: 64, perishable: true },
      },
      totalUnits: 64,
      perishableCategories: 1,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("06-handwritten-small-order", {
    title: "Hand-written order sheet",
    vendor: "Written by hand",
    invoiceNo: "",
    date: "2026-09-12",
    storeName: "Tienda Lupita",
    style: "handwritten",
    notes:
      "A hand-written sheet with no item codes. See eval/README.md on how weak a proxy a simulated hand is.",
    lines: [
      "hw-milk-gal", "hw-cheese", "hw-eggs", "hw-tortillas", "hw-beans",
      "hw-tomatoes", "hw-rice", "hw-bananas",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 20, perishable: true },
        grains: { varieties: 1, units: 12, perishable: false },
        protein: { varieties: 2, units: 25, perishable: true },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 57,
      perishableCategories: 2,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("07-near-miss-order", {
    title: "Several varieties one unit short",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885002",
    date: "2026-09-12",
    storeName: "Corner Stop Market",
    style: "laser",
    notes:
      "Four varieties arrive at two units, one short of the minimum. None of them counts, and neither do their units.",
    lines: [
      "milk-whole-2ct", "queso-fresco-2ct", "bread-white-2ct", "eggs-2ct",
      "cheese-cheddar", "yogurt-plain", "tortillas-flour", "rice-white",
      "tuna-canned", "bananas-ct", "corn-canned", "lettuce-head",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 24, perishable: true },
        grains: { varieties: 2, units: 36, perishable: false },
        protein: { varieties: 1, units: 48, perishable: false },
        produce: { varieties: 3, units: 198, perishable: true },
      },
      totalUnits: 306,
      perishableCategories: 2,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("08-accessories-and-nonstaples", {
    title: "Accessory foods and non-staples",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0099840",
    date: "2026-09-13",
    storeName: "Quick Stop Liquor & Market",
    style: "laser",
    notes:
      "Butter and jerky are accessory foods and count for nothing. Soda, chips, candy, bleach and cigarettes are not staple foods. Peanut butter is a countable protein.",
    lines: [
      "butter-sweet-cream", "jerky-beef", "peanut-butter",
      "soda-cola", "energy-drink", "chips", "candy-bars", "cigarettes", "bleach",
      "paper-towels", "milk-whole-gal", "bread-white",
    ],
    expected: {
      categories: {
        dairy: { varieties: 1, units: 8, perishable: true },
        grains: { varieties: 1, units: 16, perishable: true },
        protein: { varieties: 1, units: 12, perishable: false },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 36,
      perishableCategories: 2,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("09-glare-illegible", {
    title: "Glare across two lines",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885140",
    date: "2026-09-14",
    storeName: "Rivera's Corner Market",
    style: "phone-photo",
    notes: "Two lines are unreadable on the image and must be held back, not guessed.",
    lines: [
      "illegible-glare", "illegible-cut",
      "yogurt-plain", "milk-evaporated", "tortillas-flour", "rice-white",
      "tuna-canned", "eggs-large", "bananas-ct", "corn-canned",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 36, perishable: true },
        grains: { varieties: 2, units: 36, perishable: false },
        protein: { varieties: 2, units: 78, perishable: true },
        produce: { varieties: 2, units: 174, perishable: true },
      },
      totalUnits: 324,
      perishableCategories: 3,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("10-photocopy-faint", {
    title: "Third-generation photocopy",
    vendor: "Seventh Street Produce Co.",
    invoiceNo: "SSP-32011",
    date: "2026-09-05",
    storeName: "Mercado Familiar",
    style: "photocopy",
    notes: "Faint, speckled and slightly skewed, the way a much-copied invoice reads.",
    lines: [
      "milk-whole-gal", "cheese-queso-fresco", "tortillas-corn", "masa-flour",
      "beans-pinto-dry", "chorizo", "limes", "tomatoes-grape",
      "peppers-green", "carrots-bag",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 20, perishable: true },
        grains: { varieties: 2, units: 22, perishable: false },
        protein: { varieties: 2, units: 22, perishable: true },
        produce: { varieties: 4, units: 260, perishable: true },
      },
      totalUnits: 324,
      perishableCategories: 3,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("11-phone-photo-skew", {
    title: "Phone photo at an angle",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0100022",
    date: "2026-09-15",
    storeName: "Vermont Ave Market",
    style: "phone-photo",
    notes: "Held at an angle with uneven lighting, as a store owner would photograph it.",
    lines: [
      "milk-lowfat-half", "cheese-singles", "sour-cream", "yogurt-strawberry",
      "pasta-elbow", "crackers-saltine", "bolillo",
      "salmon-canned", "franks-beef", "eggs-large",
      "pineapple-canned", "spinach-frozen", "potatoes-russet",
    ],
    expected: {
      categories: {
        dairy: { varieties: 4, units: 57, perishable: true },
        grains: { varieties: 3, units: 56, perishable: true },
        protein: { varieties: 3, units: 54, perishable: true },
        produce: { varieties: 3, units: 56, perishable: true },
      },
      totalUnits: 223,
      perishableCategories: 4,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("12-single-line", {
    title: "One product line",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885201",
    date: "2026-09-16",
    storeName: "Smoke Shop & Market",
    style: "laser",
    notes: "The smallest record that still has something to count.",
    lines: ["milk-whole-gal"],
    expected: {
      categories: {
        dairy: { varieties: 1, units: 8, perishable: true },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 8,
      perishableCategories: 1,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("13-no-product-lines", {
    title: "Header and totals only",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0100104",
    date: "2026-09-16",
    storeName: "Rivera's Corner Market",
    style: "laser",
    notes:
      "A delivery receipt with no product lines at all. The pipeline must return nothing rather than inventing a line.",
    lines: [],
    expected: {
      categories: {
        dairy: { varieties: 0, units: 0, perishable: false },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 0,
      perishableCategories: 0,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("14-non-staples-only", {
    title: "Nothing countable on the record",
    vendor: "Beverage & Sundry Supply",
    invoiceNo: "BSS-77120",
    date: "2026-09-16",
    storeName: "Quick Stop Liquor & Market",
    style: "laser",
    notes: "A full order of drinks, snacks and sundries. Zero staple-food units.",
    lines: [
      "soda-cola", "energy-drink", "chips", "candy-bars", "cigarettes",
      "bleach", "paper-towels", "deli-prepared",
    ],
    expected: {
      categories: {
        dairy: { varieties: 0, units: 0, perishable: false },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 0,
      perishableCategories: 0,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("15-abbreviation-heavy", {
    title: "Abbreviations throughout",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885390",
    date: "2026-09-17",
    storeName: "La Esquina Market",
    style: "dotmatrix",
    notes:
      "Every description is abbreviated: WHL MLK, CHKN BRST, GRND BEEF, FRZN, WHL KERNEL.",
    lines: [
      "milk-whole-gal", "milk-lowfat-half", "milk-powder",
      "tortillas-flour", "rice-white", "cereal-oat", "masa-flour",
      "chicken-canned", "beef-ground", "sardines", "chicken-drums",
      "corn-canned", "spinach-frozen", "mixed-veg-frozen",
    ],
    expected: {
      categories: {
        dairy: { varieties: 3, units: 29, perishable: true },
        grains: { varieties: 4, units: 58, perishable: false },
        protein: { varieties: 4, units: 58, perishable: true },
        produce: { varieties: 3, units: 60, perishable: true },
      },
      totalUnits: 205,
      perishableCategories: 3,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("16-multipack-heavy", {
    title: "Multi-pack SKUs",
    vendor: "Seventh Street Produce Co.",
    invoiceNo: "SSP-32140",
    date: "2026-09-17",
    storeName: "Mercado Familiar",
    style: "laser",
    notes:
      "Pack columns that have to be read as a count times a size: 4/1 GAL, 9/64 OZ, 16 / 3 #, 36 x 4 OZ. The last is butter, which counts for nothing anyway.",
    lines: [
      "milk-whole-gal", "milk-lowfat-half", "butter-sweet-cream",
      "onions-cooking", "potatoes-russet", "carrots-bag",
      "tomatoes-roma", "yams", "beef-ground-bulk",
      "tortillas-flour", "eggs-large",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 17, perishable: true },
        grains: { varieties: 1, units: 24, perishable: false },
        protein: { varieties: 1, units: 30, perishable: true },
        produce: { varieties: 3, units: 48, perishable: true },
      },
      totalUnits: 119,
      perishableCategories: 3,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("17-frozen-and-canned", {
    title: "Frozen and canned forms",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0100288",
    date: "2026-09-17",
    storeName: "Sunset Food Mart",
    style: "laser",
    notes:
      "Frozen produce is perishable; canned produce is not. The distinction decides the perishable rule.",
    lines: [
      "spinach-frozen", "mixed-veg-frozen", "corn-canned", "greenbeans-canned",
      "pineapple-canned", "mandarin-cups",
      "tuna-canned", "salmon-canned", "chicken-canned",
      "milk-evaporated", "milk-powder", "crackers-saltine", "rice-white",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 36, perishable: false },
        grains: { varieties: 2, units: 24, perishable: false },
        protein: { varieties: 3, units: 72, perishable: false },
        produce: { varieties: 6, units: 108, perishable: true },
      },
      totalUnits: 240,
      perishableCategories: 1,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("18-mixed-bodega-order", {
    title: "Mixed order, two categories short",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885502",
    date: "2026-09-18",
    storeName: "Corner Stop Market",
    style: "laser",
    notes: "A realistic weekly order: produce and grains clear, dairy and protein do not.",
    lines: [
      "milk-whole-gal", "cheese-cheddar", "yogurt-plain", "sour-cream",
      "tortillas-flour", "tortillas-corn", "rice-white", "pasta-spaghetti",
      "oats-rolled", "masa-flour", "bread-white",
      "tuna-canned", "eggs-large", "bologna", "peanut-butter",
      "bananas-ct", "potatoes-russet", "onions-cooking", "lettuce-head",
      "limes", "corn-canned", "carrots-bag",
      "soda-cola", "chips",
    ],
    expected: {
      categories: {
        dairy: { varieties: 4, units: 44, perishable: true },
        grains: { varieties: 7, units: 106, perishable: true },
        protein: { varieties: 4, units: 106, perishable: true },
        produce: { varieties: 7, units: 446, perishable: true },
      },
      totalUnits: 702,
      perishableCategories: 4,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("19-produce-distributor", {
    title: "Produce distributor sheet",
    vendor: "Seventh Street Produce Co.",
    invoiceNo: "SSP-32266",
    date: "2026-09-04",
    storeName: "Wholesale Produce Distributor",
    style: "dotmatrix",
    notes:
      "Produce only, mixing counted cases with weight and grade columns. Nothing outside produce, so three categories are empty.",
    lines: [
      "lettuce-head", "celery", "peppers-green", "tomatoes-grape",
      "limes", "carrots-bag", "bananas-ct",
      "tomatoes-roma", "tomatoes-grade", "cucumber-bushel", "cabbage-box",
      "onions-jumbo-sack", "yams",
    ],
    expected: {
      categories: {
        dairy: { varieties: 0, units: 0, perishable: false },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 7, units: 458, perishable: true },
      },
      totalUnits: 458,
      perishableCategories: 1,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("20-tiny-store-min-order", {
    title: "Smallest weekly order",
    vendor: "Central Market Distributors",
    invoiceNo: "CMD-0100390",
    date: "2026-09-18",
    storeName: "Tienda Lupita",
    style: "handwritten",
    notes: "A tiny hand-written order, well short in every category.",
    lines: ["hw-milk-gal", "hw-eggs", "hw-tortillas", "hw-rice", "hw-bananas"],
    expected: {
      categories: {
        dairy: { varieties: 1, units: 8, perishable: true },
        grains: { varieties: 1, units: 12, perishable: false },
        protein: { varieties: 1, units: 15, perishable: true },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 35,
      perishableCategories: 2,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("21-dairy-heavy", {
    title: "Dairy delivery only",
    vendor: "Golden State Dairy Route",
    invoiceNo: "GSD-4410",
    date: "2026-09-18",
    storeName: "Vermont Ave Market",
    style: "laser",
    notes:
      "One category can be fully stocked while the store still fails: a dairy route delivery says nothing about the other three.",
    lines: [
      "milk-whole-gal", "milk-lowfat-half", "cheese-cheddar", "cheese-queso-fresco",
      "cheese-singles", "yogurt-plain", "yogurt-strawberry", "sour-cream",
      "cottage-cheese", "butter-sweet-cream",
    ],
    expected: {
      categories: {
        dairy: { varieties: 9, units: 107, perishable: true },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 107,
      perishableCategories: 1,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("22-handwritten-mixed", {
    title: "Hand-written sheet with a printed attachment",
    vendor: "Written by hand",
    invoiceNo: "",
    date: "2026-09-18",
    storeName: "Mercado Familiar",
    style: "handwritten",
    notes: "A hand-written sheet where some lines carry a count and some do not.",
    lines: [
      "hw-milk-gal", "hw-cheese", "hw-tortillas", "hw-beans", "hw-eggs",
      "hw-tomatoes", "hw-bananas", "hw-rice",
      "milk-evaporated", "crackers-saltine",
    ],
    expected: {
      categories: {
        dairy: { varieties: 3, units: 44, perishable: true },
        grains: { varieties: 2, units: 24, perishable: false },
        protein: { varieties: 2, units: 25, perishable: true },
        produce: { varieties: 0, units: 0, perishable: false },
      },
      totalUnits: 93,
      perishableCategories: 2,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("23-duplicate-varieties", {
    title: "The same variety on several lines",
    vendor: "Vallarta Wholesale Foods",
    invoiceNo: "VWF-885640",
    date: "2026-09-18",
    storeName: "Corner Stop Market",
    style: "laser",
    notes:
      "Whole milk, queso fresco, white bread and eggs each arrive on two lines. Each pair totals as one variety, which is what lifts them over the minimum.",
    lines: [
      "milk-whole-gal", "milk-whole-2ct", "cheese-queso-fresco", "queso-fresco-2ct",
      "bread-white", "bread-white-2ct", "eggs-large", "eggs-2ct",
      "tortillas-flour", "tuna-canned", "bananas-ct", "corn-canned",
    ],
    expected: {
      categories: {
        dairy: { varieties: 2, units: 24, perishable: true },
        grains: { varieties: 2, units: 42, perishable: true },
        protein: { varieties: 2, units: 80, perishable: true },
        produce: { varieties: 2, units: 174, perishable: true },
      },
      totalUnits: 320,
      perishableCategories: 4,
      overall: "fail",
    },
  }),

  // -------------------------------------------------------------------------
  record("24-grades-and-containers", {
    title: "Size grades and container words",
    vendor: "Seventh Street Produce Co.",
    invoiceNo: "SSP-32401",
    date: "2026-09-18",
    storeName: "Wholesale Produce Distributor",
    style: "photocopy",
    notes:
      "4x4 is a size grade. Bushel, box and pint are containers. None of them is a unit count, and a pint of grape tomatoes is countable only because a 12 CT pack column is printed next to it.",
    lines: [
      "tomatoes-grade", "cucumber-bushel", "cabbage-box", "tomatoes-grape",
      "deli-prepared", "lettuce-head", "celery", "peppers-green",
    ],
    expected: {
      categories: {
        dairy: { varieties: 0, units: 0, perishable: false },
        grains: { varieties: 0, units: 0, perishable: false },
        protein: { varieties: 0, units: 0, perishable: false },
        produce: { varieties: 4, units: 96, perishable: true },
      },
      totalUnits: 96,
      perishableCategories: 1,
      overall: "fail",
    },
  }),
];

export const RECORDS_BY_ID = new Map(RECORDS.map((entry) => [entry.id, entry]));

/** A record with its line library entries resolved, in printed order. */
export function resolveRecord(record) {
  return { ...record, lines: record.lines.map((id) => lineById(id)) };
}

export function recordById(id) {
  const record = RECORDS_BY_ID.get(id);
  if (!record) throw new Error(`unknown fixture record: ${id}`);
  return resolveRecord(record);
}

/** Every tag used across the fixtures, for the per-failure-mode breakdown. */
export function allTags() {
  const tags = new Set();
  for (const record of RECORDS) {
    for (const line of resolveRecord(record).lines) {
      for (const tag of line.tags) tags.add(tag);
    }
  }
  return [...tags].sort();
}
