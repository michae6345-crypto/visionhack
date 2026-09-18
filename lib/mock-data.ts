// Mock fixture for building the UI before the real /api/scan route exists.
// The types below are the agreed contract — do not change their shape without
// telling A (UI) and B (scan route) first.

export type Category = 'dairy' | 'grains' | 'protein' | 'produce'

export type CategoryStatus = {
  category: Category
  label: string
  varietiesFound: number // required: 7
  unitsFound: number // required: 21
  hasPerishable: boolean
  items: { name: string; variety: string; units: number; perishable: boolean }[]
}

export type ScanResult = {
  storeName: string
  scanDate: string
  overallStatus: 'pass' | 'fail'
  totalUnits: number // required: 84
  perishableCategoriesMet: number // required: 3 of 4
  categories: CategoryStatus[]
  fixes: {
    category: Category
    itemSuggestion: string
    whyItHelps: string
    /** Stocking units to add. Solved by lib/rules/optimizer.ts. */
    addedUnits?: number
    /** Requirements this one purchase clears outright, in plain words. */
    clears?: string[]
  }[]
  /**
   * Summary of the solved fix plan. `sufficient` is false when the suggestion
   * catalogue cannot close every gap, which the UI must not hide.
   */
  fixPlan?: {
    totalAddedUnits: number
    totalCost: number | null
    objective: 'units' | 'cost'
    sufficient: boolean
  }
}

// Demo scenario: Dairy is short (4 of 7 varieties), everything else passes.
// Items arrays are a representative sample of what was counted, not the full list.
export const MOCK_RESULT: ScanResult = {
  storeName: "Rivera's Corner Market",
  scanDate: '2026-09-12',
  overallStatus: 'fail',
  totalUnits: 84,
  perishableCategoriesMet: 3,
  categories: [
    {
      category: 'dairy',
      label: 'Dairy',
      varietiesFound: 4,
      unitsFound: 14,
      hasPerishable: true,
      items: [
        { name: 'Lucerne Whole Milk, 1 gal', variety: 'Whole milk', units: 4, perishable: true },
        { name: 'Tillamook Medium Cheddar Block, 8 oz', variety: 'Cheddar cheese', units: 3, perishable: true },
        { name: 'Dannon Plain Lowfat Yogurt, 32 oz', variety: 'Plain yogurt', units: 4, perishable: true },
        { name: 'Cacique Queso Fresco, 10 oz', variety: 'Queso fresco', units: 3, perishable: true },
      ],
    },
    {
      category: 'grains',
      label: 'Grains',
      varietiesFound: 7,
      unitsFound: 21,
      hasPerishable: false,
      items: [
        { name: 'Mission Flour Tortillas Soft Taco, 10 ct', variety: 'Flour tortillas', units: 3, perishable: false },
        { name: 'Mahatma Extra Long Grain White Rice, 2 lb', variety: 'White rice', units: 3, perishable: false },
        { name: 'Barilla Spaghetti, 16 oz', variety: 'Spaghetti', units: 3, perishable: false },
        { name: 'Quaker Old Fashioned Oats, 18 oz', variety: 'Rolled oats', units: 3, perishable: false },
        { name: 'General Mills Cheerios, 8.9 oz', variety: 'Oat cereal', units: 3, perishable: false },
      ],
    },
    {
      category: 'protein',
      label: 'Protein',
      varietiesFound: 7,
      unitsFound: 24,
      hasPerishable: true,
      items: [
        { name: 'StarKist Chunk Light Tuna in Water, 5 oz', variety: 'Canned tuna', units: 6, perishable: false },
        { name: 'Oscar Mayer Classic Beef Franks, 15 oz', variety: 'Beef hot dogs', units: 3, perishable: true },
        { name: 'Fresh Ground Beef 80/20, 1 lb', variety: 'Ground beef', units: 3, perishable: true },
        { name: 'Swanson Premium White Chicken Breast, 9.75 oz', variety: 'Canned chicken', units: 3, perishable: false },
        { name: 'Bar-S Classic Bologna, 12 oz', variety: 'Bologna', units: 3, perishable: true },
      ],
    },
    {
      category: 'produce',
      label: 'Fruits and Vegetables',
      varietiesFound: 7,
      unitsFound: 25,
      hasPerishable: true,
      items: [
        { name: 'Bananas, per lb', variety: 'Bananas', units: 6, perishable: true },
        { name: 'Russet Potatoes, 5 lb bag', variety: 'Potatoes', units: 3, perishable: true },
        { name: 'Yellow Onions, 3 lb bag', variety: 'Onions', units: 3, perishable: true },
        { name: 'Del Monte Whole Kernel Corn, 15.25 oz', variety: 'Canned corn', units: 4, perishable: false },
        { name: 'Dole Mandarin Oranges Fruit Cups, 4 ct', variety: 'Mandarin oranges', units: 3, perishable: false },
      ],
    },
  ],
  // Three varieties short of seven, so the plan is three varieties at the 3-unit
  // minimum. Only the last one crosses a threshold, which is why only it clears
  // anything — the same attribution lib/rules/optimizer.ts produces.
  fixes: [
    {
      category: 'dairy',
      itemSuggestion: 'Carnation Evaporated Milk, 12 oz can (stock 3)',
      whyItHelps: 'Shelf-stable and under $2 a can. Adds a 5th dairy variety with no fridge space.',
      addedUnits: 3,
      clears: [],
    },
    {
      category: 'dairy',
      itemSuggestion: 'Kraft Singles American Cheese, 12 ct (stock 3)',
      whyItHelps: 'A different cheese variety from cheddar, so it counts as a 6th dairy variety.',
      addedUnits: 3,
      clears: [],
    },
    {
      category: 'dairy',
      itemSuggestion: 'Daisy Cottage Cheese, 16 oz (stock 3)',
      whyItHelps: 'Gets Dairy to 7 varieties and 23 units, clearing both dairy minimums.',
      addedUnits: 3,
      clears: ['the dairy minimum of 7 varieties', 'the dairy minimum of 21 units'],
    },
  ],
  fixPlan: {
    totalAddedUnits: 9,
    totalCost: null, // no price list in this repository
    objective: 'units',
    sufficient: true,
  },
}
