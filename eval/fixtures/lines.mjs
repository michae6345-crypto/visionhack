/**
 * The line library the fixture records are built from.
 *
 * Each entry has two halves that must never be confused:
 *
 *   printed — exactly what appears on the rendered image, abbreviations and
 *             quirks intact. eval/render.mjs draws from this.
 *   truth   — what a careful person reading THAT LINE ON THAT IMAGE records:
 *             category, variety, how it is stored, units per pack, packs, and
 *             whether the line can be counted at all.
 *
 * WHAT "TRUTH" MEANS HERE. It is the reading available from the record in front
 * of you, not the reality on the shelf. A 25 lb case of loose tomatoes has no
 * printed unit count, so a person scoring the record cannot count its units
 * either: truth says counted: false with a reason. Labelling it with a guessed
 * unit count would measure the pipeline against something no reader could
 * produce, and would reward guessing.
 *
 * Every line here is invented. Product names are real brands a corner store
 * carries, but no line is transcribed from a real invoice, and none of the
 * vendors, invoice numbers or prices correspond to a real transaction.
 */

/** Categories match lib/rules/constants.ts. Dry beans, nuts and eggs are protein. */
const line = (id, printed, truth, tags = []) => ({ id, printed, truth, tags });

/** A countable line. `units` is always unitsPerPack x packs. */
const counted = (category, variety, storage, unitsPerPack, packs) => ({
  counted: true,
  category,
  variety,
  storage,
  unitsPerPack,
  packs,
  units: unitsPerPack * packs,
});

/** A line a reader can see but cannot count, with the reason it is held back. */
const held = (reason, partial = {}) => ({
  counted: false,
  reason,
  category: null,
  variety: null,
  storage: null,
  unitsPerPack: null,
  packs: null,
  units: null,
  ...partial,
});

export const LINES = [
  // -------------------------------------------------------------------------
  // Dairy
  // -------------------------------------------------------------------------
  line(
    "milk-whole-gal",
    { code: "418820", description: "WHL MLK GALLON", pack: "4/1 GAL", qty: "2", price: "14.88" },
    counted("dairy", "whole milk", "refrigerated", 4, 2),
    ["abbreviation", "multi-pack"],
  ),
  line(
    "milk-lowfat-half",
    { code: "418824", description: "2% MLK HALF GAL", pack: "9/64 OZ", qty: "1", price: "21.40" },
    counted("dairy", "2% milk", "refrigerated", 9, 1),
    ["abbreviation", "multi-pack"],
  ),
  line(
    "milk-evaporated",
    { code: "221104", description: "CARNATION EVAP MILK 12 OZ", pack: "24 CT", qty: "1", price: "28.56" },
    counted("dairy", "evaporated milk", "shelf_stable", 24, 1),
    ["abbreviation"],
  ),
  line(
    "cheese-cheddar",
    { code: "512207", description: "TILLAMOOK MED CHEDDAR BLOCK 8 OZ", pack: "12 CT", qty: "1", price: "42.00" },
    counted("dairy", "cheddar cheese", "refrigerated", 12, 1),
    [],
  ),
  line(
    "cheese-queso-fresco",
    { code: "512980", description: "CACIQUE QUESO FRESCO 10 OZ", pack: "12 CT", qty: "1", price: "35.88" },
    counted("dairy", "queso fresco", "refrigerated", 12, 1),
    [],
  ),
  line(
    "cheese-singles",
    { code: "513110", description: "KRAFT SINGLES AMER 12 CT", pack: "12 CT", qty: "1", price: "33.48" },
    counted("dairy", "american cheese", "refrigerated", 12, 1),
    ["count-in-description"],
  ),
  line(
    "yogurt-plain",
    { code: "515002", description: "DANNON PLAIN LOWFAT YOGURT 32 OZ", pack: "6 CT", qty: "2", price: "17.94" },
    counted("dairy", "plain yogurt", "refrigerated", 6, 2),
    [],
  ),
  line(
    "yogurt-strawberry",
    { code: "515040", description: "YOPLAIT STRAWBERRY 6 OZ", pack: "24 CT", qty: "1", price: "19.20" },
    counted("dairy", "strawberry yogurt", "refrigerated", 24, 1),
    [],
  ),
  line(
    "sour-cream",
    { code: "516300", description: "DAISY SOUR CREAM 16 OZ", pack: "12 CT", qty: "1", price: "26.40" },
    counted("dairy", "sour cream", "refrigerated", 12, 1),
    [],
  ),
  line(
    "cottage-cheese",
    { code: "516800", description: "DAISY COTTAGE CHEESE 16 OZ", pack: "6 CT", qty: "1", price: "15.54" },
    counted("dairy", "cottage cheese", "refrigerated", 6, 1),
    [],
  ),
  line(
    "milk-powder",
    { code: "221880", description: "NIDO FORTIFICADA DRY MILK 12.6 OZ", pack: "12 CT", qty: "1", price: "71.88" },
    counted("dairy", "powdered milk", "shelf_stable", 12, 1),
    [],
  ),
  line(
    "butter-sweet-cream",
    { code: "517400", description: "SWEET CREAM BUTTER SOLIDS", pack: "36 x 4 OZ", qty: "1", price: "58.32" },
    held("Butter other than peanut butter is an accessory food and counts for nothing.", {
      category: "dairy",
      accessory: true,
    }),
    ["accessory"],
  ),

  // -------------------------------------------------------------------------
  // Grains
  // -------------------------------------------------------------------------
  line(
    "tortillas-flour",
    { code: "610220", description: "MISSION FLR TORT SOFT TACO 10 CT", pack: "12 CT", qty: "2", price: "24.96" },
    counted("grains", "flour tortillas", "shelf_stable", 12, 2),
    ["abbreviation", "count-in-description"],
  ),
  line(
    "tortillas-corn",
    { code: "610240", description: "MISSION CORN TORT 30 CT", pack: "12 CT", qty: "1", price: "21.48" },
    counted("grains", "corn tortillas", "shelf_stable", 12, 1),
    ["count-in-description"],
  ),
  line(
    "rice-white",
    { code: "620100", description: "MAHATMA X-LONG GRAIN WHITE RICE 2 LB", pack: "12 CT", qty: "1", price: "23.88" },
    counted("grains", "white rice", "shelf_stable", 12, 1),
    ["abbreviation"],
  ),
  line(
    "rice-bulk",
    { code: "620180", description: "LONG GRAIN RICE BULK", pack: "50 LB SACK", qty: "2", price: "64.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "pasta-spaghetti",
    { code: "622010", description: "BARILLA SPAGHETTI 16 OZ", pack: "20 CT", qty: "1", price: "25.80" },
    counted("grains", "spaghetti", "shelf_stable", 20, 1),
    [],
  ),
  line(
    "pasta-elbow",
    { code: "622060", description: "BARILLA ELBOW MAC 16 OZ", pack: "20 CT", qty: "1", price: "25.80" },
    counted("grains", "elbow macaroni", "shelf_stable", 20, 1),
    ["abbreviation"],
  ),
  line(
    "oats-rolled",
    { code: "624400", description: "QUAKER OLD FASHION OATS 18 OZ", pack: "12 CT", qty: "1", price: "38.28" },
    counted("grains", "rolled oats", "shelf_stable", 12, 1),
    [],
  ),
  line(
    "cereal-oat",
    { code: "624800", description: "GEN MILLS CHEERIOS 8.9 OZ", pack: "12 CT", qty: "1", price: "44.28" },
    counted("grains", "oat cereal", "shelf_stable", 12, 1),
    ["abbreviation"],
  ),
  line(
    "masa-flour",
    { code: "626100", description: "MASECA INST CORN MASA 4.4 LB", pack: "10 CT", qty: "1", price: "39.90" },
    counted("grains", "corn masa flour", "shelf_stable", 10, 1),
    ["abbreviation"],
  ),
  line(
    "bread-white",
    { code: "630010", description: "BIMBO SOFT WHITE BREAD 20 OZ", pack: "8 CT", qty: "2", price: "27.84" },
    counted("grains", "white bread", "fresh", 8, 2),
    [],
  ),
  line(
    "bolillo",
    { code: "630090", description: "BOLILLO ROLLS FRESH BAKED", pack: "6 CT", qty: "4", price: "12.00" },
    counted("grains", "bolillo rolls", "fresh", 6, 4),
    [],
  ),
  line(
    "crackers-saltine",
    { code: "628200", description: "PREMIUM SALTINE CRACKERS 16 OZ", pack: "12 CT", qty: "1", price: "29.88" },
    counted("grains", "saltine crackers", "shelf_stable", 12, 1),
    [],
  ),

  // -------------------------------------------------------------------------
  // Protein
  // -------------------------------------------------------------------------
  line(
    "tuna-canned",
    { code: "710500", description: "STARKIST CHUNK LT TUNA WTR 5 OZ", pack: "48 CT", qty: "1", price: "52.80" },
    counted("protein", "canned tuna", "shelf_stable", 48, 1),
    ["abbreviation"],
  ),
  line(
    "salmon-canned",
    { code: "710560", description: "BUMBLE BEE PINK SALMON 14.75 OZ", pack: "12 CT", qty: "1", price: "47.88" },
    counted("protein", "canned salmon", "shelf_stable", 12, 1),
    [],
  ),
  line(
    "sardines",
    { code: "710610", description: "BUMBLE BEE SARDINES IN WTR 3.75 OZ", pack: "18 CT", qty: "1", price: "23.22" },
    counted("protein", "sardines", "shelf_stable", 18, 1),
    ["abbreviation"],
  ),
  line(
    "chicken-canned",
    { code: "712200", description: "SWANSON WHITE CHKN BRST 9.75 OZ", pack: "12 CT", qty: "1", price: "41.88" },
    counted("protein", "canned chicken", "shelf_stable", 12, 1),
    ["abbreviation"],
  ),
  line(
    "beef-ground",
    { code: "720100", description: "GRND BEEF 80/20 1 LB CHUB", pack: "12 CT", qty: "1", price: "58.68" },
    counted("protein", "ground beef", "refrigerated", 12, 1),
    ["abbreviation"],
  ),
  line(
    "beef-ground-bulk",
    { code: "720140", description: "GROUND BEEF 80/20 BULK", pack: "40 #", qty: "1", price: "156.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "franks-beef",
    { code: "722100", description: "OSCAR MAYER BEEF FRANKS 15 OZ", pack: "12 CT", qty: "1", price: "53.88" },
    counted("protein", "beef hot dogs", "refrigerated", 12, 1),
    [],
  ),
  line(
    "bologna",
    { code: "722400", description: "BAR-S CLASSIC BOLOGNA 12 OZ", pack: "16 CT", qty: "1", price: "27.84" },
    counted("protein", "bologna", "refrigerated", 16, 1),
    [],
  ),
  line(
    "chorizo",
    { code: "722800", description: "CACIQUE POR CHORIZO 10 OZ", pack: "12 CT", qty: "1", price: "31.08" },
    counted("protein", "chorizo", "refrigerated", 12, 1),
    ["abbreviation"],
  ),
  line(
    "chicken-drums",
    { code: "724100", description: "FRSH CHKN DRUMSTICKS FAM PK", pack: "8 CT", qty: "2", price: "39.84" },
    counted("protein", "chicken drumsticks", "refrigerated", 8, 2),
    ["abbreviation"],
  ),
  line(
    "eggs-large",
    { code: "730100", description: "GRADE A LARGE EGGS 12 CT", pack: "15 CT", qty: "2", price: "71.70" },
    counted("protein", "eggs", "refrigerated", 15, 2),
    ["count-in-description"],
  ),
  line(
    "peanut-butter",
    { code: "740200", description: "SKIPPY CREAMY PEANUT BUTTER 16.3 OZ", pack: "12 CT", qty: "1", price: "35.88" },
    // Peanut butter is a countable protein, not an accessory. The pipeline has a
    // deliberate rule for this; the fixture exists to hold it to that.
    counted("protein", "peanut butter", "shelf_stable", 12, 1),
    ["accessory-exception"],
  ),
  line(
    "beans-pinto-dry",
    { code: "742100", description: "DRIED PINTO BEANS 2 LB", pack: "10 CT", qty: "1", price: "21.90" },
    counted("protein", "dried pinto beans", "shelf_stable", 10, 1),
    [],
  ),
  line(
    "jerky-beef",
    { code: "744900", description: "JACK LINKS ORIGINAL BEEF JERKY 3.25 OZ", pack: "8 CT", qty: "2", price: "95.84" },
    held("All jerky is an accessory food and counts for nothing.", {
      category: "protein",
      accessory: true,
    }),
    ["accessory"],
  ),

  // -------------------------------------------------------------------------
  // Produce
  // -------------------------------------------------------------------------
  line(
    "bananas",
    { code: "810100", description: "BANANAS PREMIUM", pack: "40 #", qty: "2", price: "58.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "bananas-ct",
    { code: "810104", description: "BANANAS PETITE", pack: "150 CT", qty: "1", price: "34.00" },
    counted("produce", "bananas", "fresh", 150, 1),
    [],
  ),
  line(
    "onions-cooking",
    { code: "820200", description: "COOKING ONION", pack: "16 / 3 #", qty: "1", price: "28.80" },
    // An explicit 16-pack of 3-pound units, not a weight.
    counted("produce", "onions", "fresh", 16, 1),
    ["multi-pack", "weight-per-unit"],
  ),
  line(
    "onions-jumbo-sack",
    { code: "820240", description: "YELLOW ONIONS JUMBO", pack: "50 LB SACK", qty: "1", price: "24.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "tomatoes-roma",
    { code: "830100", description: "ROMA TOMATOES", pack: "25 LB CS", qty: "2", price: "44.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "tomatoes-grade",
    { code: "830140", description: "TOMATO 4x4", pack: "4x4", qty: "3", price: "63.00" },
    // "4x4" is a produce size grade, not a pack count.
    held("The printed 4x4 is a size grade, not a unit count."),
    ["size-grade"],
  ),
  line(
    "tomatoes-grape",
    { code: "830180", description: "TOMATO GRAPE PINT", pack: "12 CT", qty: "2", price: "39.60" },
    counted("produce", "grape tomatoes", "fresh", 12, 2),
    ["container-word"],
  ),
  line(
    "lettuce-head",
    { code: "840100", description: "LETTUCE HEAD 24 CT CELLO WRAP", pack: "24 CT", qty: "1", price: "32.00" },
    counted("produce", "lettuce", "fresh", 24, 1),
    ["count-in-description"],
  ),
  line(
    "celery",
    { code: "840200", description: "CELERY 24 CT NO SLEEVE", pack: "24 CT", qty: "1", price: "38.00" },
    counted("produce", "celery", "fresh", 24, 1),
    ["count-in-description"],
  ),
  line(
    "cucumber-bushel",
    { code: "840400", description: "SELECT CUCUMBER", pack: "BUSHEL", qty: "2", price: "36.00" },
    held("A bushel with no printed count gives no sellable unit count."),
    ["container-word"],
  ),
  line(
    "cabbage-box",
    { code: "840600", description: "GREEN CABBAGE", pack: "BOX", qty: "2", price: "27.00" },
    held("A box with no printed count gives no sellable unit count."),
    ["container-word"],
  ),
  line(
    "peppers-green",
    { code: "842100", description: "GREEN PEPPER EX-LARGE", pack: "24 CT", qty: "1", price: "26.00" },
    counted("produce", "green peppers", "fresh", 24, 1),
    [],
  ),
  line(
    "potatoes-russet",
    { code: "844100", description: "RUSSET POTATO 5 LB BAG", pack: "10 CT", qty: "2", price: "39.80" },
    counted("produce", "potatoes", "fresh", 10, 2),
    ["weight-per-unit"],
  ),
  line(
    "yams",
    { code: "844400", description: "YAM LOUISIANA / MISSISSIPPI", pack: "40 #", qty: "1", price: "32.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["weight-only"],
  ),
  line(
    "limes",
    { code: "846100", description: "LIMES PERSIAN", pack: "200 CT", qty: "1", price: "42.00" },
    counted("produce", "limes", "fresh", 200, 1),
    [],
  ),
  line(
    "carrots-bag",
    { code: "846400", description: "CARROTS 2 LB BAG", pack: "12 CT", qty: "1", price: "18.60" },
    counted("produce", "carrots", "fresh", 12, 1),
    ["weight-per-unit"],
  ),
  line(
    "corn-canned",
    { code: "850100", description: "DEL MONTE WHL KERNEL CORN 15.25 OZ", pack: "24 CT", qty: "1", price: "26.16" },
    counted("produce", "canned corn", "shelf_stable", 24, 1),
    ["abbreviation"],
  ),
  line(
    "greenbeans-canned",
    { code: "850140", description: "DEL MONTE CUT GREEN BEANS 14.5 OZ", pack: "24 CT", qty: "1", price: "25.20" },
    counted("produce", "canned green beans", "shelf_stable", 24, 1),
    [],
  ),
  line(
    "pineapple-canned",
    { code: "852100", description: "DOLE PINEAPPLE CHUNKS 20 OZ", pack: "12 CT", qty: "1", price: "24.48" },
    counted("produce", "canned pineapple", "shelf_stable", 12, 1),
    [],
  ),
  line(
    "mandarin-cups",
    { code: "852140", description: "DOLE MANDARIN ORANGE CUPS 4 CT", pack: "12 CT", qty: "1", price: "28.68" },
    counted("produce", "mandarin oranges", "shelf_stable", 12, 1),
    ["count-in-description"],
  ),
  line(
    "spinach-frozen",
    { code: "860100", description: "FRZN CHOPPED SPINACH 10 OZ", pack: "24 CT", qty: "1", price: "22.80" },
    counted("produce", "frozen spinach", "frozen", 24, 1),
    ["abbreviation"],
  ),
  line(
    "mixed-veg-frozen",
    { code: "860140", description: "FRZN MIXED VEGETABLES 16 OZ", pack: "12 CT", qty: "1", price: "17.88" },
    counted("produce", "frozen mixed vegetables", "frozen", 12, 1),
    ["abbreviation"],
  ),

  // -------------------------------------------------------------------------
  // Lines that must never be counted
  // -------------------------------------------------------------------------
  line(
    "paper-towels",
    { code: "910100", description: "PAPER TOWELS 2 PLY", pack: "30 ROLL", qty: "1", price: "42.00" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "bleach",
    { code: "910400", description: "CLOROX BLEACH 81 OZ", pack: "6 CT", qty: "1", price: "23.94" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "soda-cola",
    { code: "920100", description: "COCA COLA 12 OZ CAN", pack: "24 CT", qty: "4", price: "39.96" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "energy-drink",
    { code: "920400", description: "RED BULL 8.4 OZ", pack: "24 CT", qty: "2", price: "77.76" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "chips",
    { code: "930100", description: "LAYS CLASSIC CHIPS 1 OZ", pack: "104 CT", qty: "1", price: "39.52" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "candy-bars",
    { code: "930400", description: "SNICKERS BAR 1.86 OZ", pack: "48 CT", qty: "1", price: "43.20" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "cigarettes",
    { code: "940100", description: "MARLBORO RED CARTON", pack: "10 PK", qty: "6", price: "612.00" },
    held("Not a staple food category."),
    ["non-staple"],
  ),
  line(
    "deli-prepared",
    { code: "950100", description: "PREPARED CHICKEN SALAD DELI", pack: "5 #", qty: "2", price: "44.00" },
    held("Prepared deli food, and sold by weight."),
    ["non-staple", "weight-only"],
  ),

  // -------------------------------------------------------------------------
  // Small orders, where a variety lands below the 3-unit minimum
  // -------------------------------------------------------------------------
  line(
    "milk-whole-2ct",
    { code: "418820", description: "WHL MLK GALLON", pack: "2 CT", qty: "1", price: "7.44" },
    counted("dairy", "whole milk", "refrigerated", 2, 1),
    ["near-miss", "abbreviation"],
  ),
  line(
    "bread-white-2ct",
    { code: "630010", description: "BIMBO SOFT WHITE BREAD 20 OZ", pack: "2 CT", qty: "1", price: "6.96" },
    counted("grains", "white bread", "fresh", 2, 1),
    ["near-miss"],
  ),
  line(
    "eggs-2ct",
    { code: "730100", description: "GRADE A LARGE EGGS 12 CT", pack: "2 CT", qty: "1", price: "9.56" },
    counted("protein", "eggs", "refrigerated", 2, 1),
    ["near-miss", "count-in-description"],
  ),
  line(
    "queso-fresco-2ct",
    { code: "512980", description: "CACIQUE QUESO FRESCO 10 OZ", pack: "2 CT", qty: "1", price: "5.98" },
    counted("dairy", "queso fresco", "refrigerated", 2, 1),
    ["near-miss"],
  ),

  // -------------------------------------------------------------------------
  // Hand-written order sheets: no item codes, informal descriptions
  // -------------------------------------------------------------------------
  line(
    "hw-milk-gal",
    { description: "Milk - whole, gal", pack: "4 ct", qty: "2", price: "14.88" },
    counted("dairy", "whole milk", "refrigerated", 4, 2),
    ["handwritten"],
  ),
  line(
    "hw-cheese",
    { description: "Cheddar blocks", pack: "12 ct", qty: "1", price: "42.00" },
    counted("dairy", "cheddar cheese", "refrigerated", 12, 1),
    ["handwritten"],
  ),
  line(
    "hw-eggs",
    { description: "Eggs lg", pack: "15 ct", qty: "1", price: "35.85" },
    counted("protein", "eggs", "refrigerated", 15, 1),
    ["handwritten"],
  ),
  line(
    "hw-tortillas",
    { description: "Tortillas - flour", pack: "12 ct", qty: "1", price: "12.48" },
    counted("grains", "flour tortillas", "shelf_stable", 12, 1),
    ["handwritten"],
  ),
  line(
    "hw-beans",
    { description: "Pinto beans 2lb bags", pack: "10 ct", qty: "1", price: "21.90" },
    counted("protein", "dried pinto beans", "shelf_stable", 10, 1),
    ["handwritten"],
  ),
  line(
    "hw-tomatoes",
    { description: "Tomatoes (box)", pack: "", qty: "2", price: "44.00" },
    held("A box with no printed count gives no sellable unit count."),
    ["handwritten", "container-word"],
  ),
  line(
    "hw-rice",
    { description: "Rice 20 lb", pack: "", qty: "1", price: "18.00" },
    held("Sold by weight, so the record shows no sellable unit count."),
    ["handwritten", "weight-only"],
  ),
  line(
    "hw-bananas",
    { description: "Bananas - 2 cases", pack: "", qty: "2", price: "58.00" },
    held("No sellable unit count is written on the line."),
    ["handwritten"],
  ),

  // -------------------------------------------------------------------------
  // Lines the image itself makes unreadable
  // -------------------------------------------------------------------------
  line(
    "illegible-glare",
    { code: "8••••0", description: "L•••ERNE WH••• M••K", pack: "•/1 GAL", qty: "•", price: "14.88" },
    held("The line is obscured on the image and cannot be read in full."),
    ["illegible"],
  ),
  line(
    "illegible-cut",
    { code: "512", description: "TILLAMOOK MED CHED", pack: "", qty: "", price: "" },
    held("The line runs off the edge of the image."),
    ["illegible", "cut-off"],
  ),
];

export const LINES_BY_ID = new Map(LINES.map((entry) => [entry.id, entry]));

export function lineById(id) {
  const entry = LINES_BY_ID.get(id);
  if (!entry) throw new Error(`unknown fixture line: ${id}`);
  return entry;
}

/** Perishable follows from storage, exactly as lib/rules/constants.ts has it. */
export function isPerishableStorage(storage) {
  return storage === "refrigerated" || storage === "fresh" || storage === "frozen";
}
