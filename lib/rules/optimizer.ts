/**
 * Solves for the cheapest set of additions that clears every unmet requirement
 * at once, instead of ranking suggestions one category at a time.
 *
 * WHY THIS IS NOT A HEURISTIC. The requirements interact. Topping up a variety
 * the store already buys two units of costs one added unit but adds three
 * counted units, because units in a short variety count for nothing until the
 * variety qualifies. A brand-new variety costs three added units for three
 * counted units. One category can be the cheapest place to put the perishable
 * the store is missing while another is the cheapest place to find varieties.
 * Picking greedily per category gets these wrong, so the search is exhaustive
 * over a bounded space and the result is minimal within the candidate set.
 *
 * THE SEARCH. Every candidate adds exactly one qualifying variety, so a
 * category's decision reduces to how many candidates to take, which ones, and
 * whether the category must end up carrying a perishable. Each category gets a
 * short list of options (at most a handful), the options are combined across
 * the four categories, infeasible combinations are dropped, and the cheapest
 * survivor wins. scripts/optimizer.test.mjs checks the answer against a
 * brute-force search over raw candidate subsets, so "minimal" is tested rather
 * than asserted.
 *
 * Pure and synchronous: no model call, no clock, no copy. Fix wording lives in
 * lib/scorecard-copy.ts and is applied by lib/rule-engine.ts.
 */
import { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY, type Category } from "./constants";
import {
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
  evaluateStandard,
  varietyKey,
  type CategoryEvaluation,
  type CountableLine,
  type StandardEvaluation,
  type UnmetConstraint,
} from "./standard";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
/** A variety the store could start carrying. */
export interface CatalogItem {
  category: Category;
  variety: string;
  perishable: boolean;
}

/** Cost lookup key. Absent from the map means the cost is unknown. */
export function costKey(category: Category, variety: string): string {
  return `${category}:${varietyKey(variety)}`;
}

export interface OptimizeOptions {
  /**
   * What to minimise. "units" (the default) minimises added stocking units,
   * which is what a store with no price list cares about. "cost" minimises
   * money and needs a cost for every candidate it considers; when one is
   * missing the plan falls back to "units" and says so in `objective`.
   */
  objective?: "units" | "cost";
  /** Cost per stocking unit, keyed by costKey(). Empty when no price list exists. */
  unitCosts?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
export interface FixAction {
  /**
   * "top-up" raises a variety the store already buys to the minimum.
   * "new-variety" starts a variety it does not carry.
   * "extra-units" adds units to a variety that already qualifies, which is only
   * ever needed to close a unit total.
   */
  kind: "top-up" | "new-variety" | "extra-units";
  category: Category;
  variety: string;
  /** Normalised variety, so callers can match this back to their own rows. */
  key: string;
  /** Stocking units the store has to add. This is what the objective counts. */
  addedUnits: number;
  /** Units the variety carries once the action is done. */
  resultingVarietyUnits: number;
  /** Units the category's counted total gains. Larger than addedUnits for a top-up. */
  categoryUnitsGained: number;
  perishable: boolean;
  unitCost: number | null;
  cost: number | null;
  /** Requirements that go from unmet to met at this step, in plan order. */
  clears: UnmetConstraint[];
}

export interface FixPlan {
  actions: FixAction[];
  totalAddedUnits: number;
  /** Null when any chosen action has no cost data. */
  totalCost: number | null;
  /** What the search actually minimised. */
  objective: "units" | "cost";
  /** True when carrying out every action makes the standard met. */
  sufficient: boolean;
  /** Requirements the candidate set cannot clear. Empty when `sufficient`. */
  unresolved: UnmetConstraint[];
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------
interface Candidate {
  kind: "top-up" | "new-variety";
  category: Category;
  /**
   * Position in the candidate list, used to break ties between candidates that
   * cost the same. The catalogue is curated (shelf-stable staples first, so a
   * store is not told to buy fridge space it does not need), and this keeps that
   * order meaningful instead of falling back to alphabetical.
   */
  order: number;
  variety: string;
  key: string;
  addedUnits: number;
  resultingVarietyUnits: number;
  categoryUnitsGained: number;
  perishable: boolean;
  unitCost: number | null;
  cost: number | null;
}

/**
 * Looser than varietyKey, and used only to avoid suggesting something the store
 * already carries under a slightly different name: "canned salmon" vs "salmon",
 * "tomatoes" vs "tomato".
 */
export function looseVarietyKey(variety: string): string {
  return varietyKey(variety)
    .replace(/^(canned|fresh|frozen|dried)\s+/, "")
    .replace(/(?<=o)es$|s$/, "");
}

function unitCostOf(
  category: Category,
  variety: string,
  unitCosts: Readonly<Record<string, number>>,
): number | null {
  const cost = unitCosts[costKey(category, variety)];
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null;
}

function candidatesFor(
  evaluation: CategoryEvaluation,
  catalog: readonly CatalogItem[],
  unitCosts: Readonly<Record<string, number>>,
): Candidate[] {
  const { category } = evaluation;

  // Anything the store already has a line for, however few units.
  const carried = new Set(
    [...evaluation.qualifying, ...evaluation.nearMisses].map((v) => looseVarietyKey(v.variety)),
  );

  const topUps = evaluation.nearMisses.map((nearMiss): Candidate => {
    const unitCost = unitCostOf(category, nearMiss.variety, unitCosts);
    return {
      kind: "top-up",
      order: 0,
      category,
      variety: nearMiss.variety,
      key: nearMiss.key,
      addedUnits: nearMiss.unitsShort,
      resultingVarietyUnits: MIN_STOCKING_UNITS_PER_VARIETY,
      // The variety's whole total starts counting, not just the units added.
      categoryUnitsGained: MIN_STOCKING_UNITS_PER_VARIETY,
      perishable: nearMiss.perishable,
      unitCost,
      cost: unitCost === null ? null : unitCost * nearMiss.unitsShort,
    };
  });

  const newVarieties = catalog
    .filter((item) => item.category === category && !carried.has(looseVarietyKey(item.variety)))
    .map((item): Candidate => {
      const unitCost = unitCostOf(category, item.variety, unitCosts);
      return {
        kind: "new-variety",
        order: 0,
        category,
        variety: item.variety,
        key: varietyKey(item.variety),
        addedUnits: MIN_STOCKING_UNITS_PER_VARIETY,
        resultingVarietyUnits: MIN_STOCKING_UNITS_PER_VARIETY,
        categoryUnitsGained: MIN_STOCKING_UNITS_PER_VARIETY,
        perishable: item.perishable,
        unitCost,
        cost: unitCost === null ? null : unitCost * MIN_STOCKING_UNITS_PER_VARIETY,
      };
    });

  // Deduplicate: a catalog entry naming a variety the store is already short of
  // would otherwise be counted twice.
  const seen = new Set(topUps.map((c) => c.key));
  const distinct: Candidate[] = [...topUps];
  for (const candidate of newVarieties) {
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    distinct.push(candidate);
  }
  return distinct.map((candidate, order) => ({ ...candidate, order }));
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------
/**
 * What the search is solving for. Normally the published thresholds. When the
 * suggestion catalogue is too small to reach them — an empty category needs
 * seven varieties and the catalogue may not offer seven — the search runs again
 * against what is actually reachable, so the store gets the best available plan
 * plus an honest list of what it does not close. A plan built against relaxed
 * targets always comes back with `sufficient: false`.
 */
interface Targets {
  varietiesPerCategory: Record<Category, number>;
  unitsPerCategory: number;
  totalUnits: number;
  perishableCategories: number;
  /**
   * Whether extra units may be added to a variety that already qualifies. Only
   * ever needed to close a unit total, so it is off when the totals are out of
   * reach: advising volume for a total the store cannot hit is not advice.
   */
  allowFiller: boolean;
}

function strictTargets(): Targets {
  return {
    varietiesPerCategory: Object.fromEntries(
      CATEGORIES.map((c) => [c, REQUIRED_VARIETIES_PER_CATEGORY]),
    ) as Record<Category, number>,
    unitsPerCategory: REQUIRED_UNITS_PER_CATEGORY,
    totalUnits: REQUIRED_TOTAL_UNITS,
    perishableCategories: REQUIRED_PERISHABLE_CATEGORIES,
    allowFiller: true,
  };
}

function relaxedTargets(
  evaluation: StandardEvaluation,
  candidatesByCategory: Candidate[][],
): Targets {
  const varietiesPerCategory = {} as Record<Category, number>;
  let reachablePerishables = 0;

  evaluation.categories.forEach((category, index) => {
    const candidates = candidatesByCategory[index];
    varietiesPerCategory[category.category] = Math.min(
      REQUIRED_VARIETIES_PER_CATEGORY,
      category.varietiesCounted + candidates.length,
    );
    if (category.hasPerishable || candidates.some((c) => c.perishable)) reachablePerishables++;
  });

  return {
    varietiesPerCategory,
    unitsPerCategory: 0,
    totalUnits: 0,
    perishableCategories: Math.min(REQUIRED_PERISHABLE_CATEGORIES, reachablePerishables),
    allowFiller: false,
  };
}

// ---------------------------------------------------------------------------
// Per-category options
// ---------------------------------------------------------------------------
interface CategoryOption {
  category: Category;
  chosen: Candidate[];
  /** Units added to an already-qualifying variety to close this category's total. */
  fillerUnits: number;
  addedUnits: number;
  cost: number | null;
  unitsGained: number;
  endsWithPerishable: boolean;
  feasible: boolean;
}

function weight(candidate: Candidate, objective: "units" | "cost"): number {
  if (objective === "cost" && candidate.cost !== null) return candidate.cost;
  return candidate.addedUnits;
}

/**
 * Cheapest `count` candidates, forced to include a perishable when the category
 * has to supply one. Taking the cheapest `count` and then swapping the dearest
 * chosen for the cheapest perishable is optimal: any valid selection contains a
 * perishable, and no other exchange can beat the cheapest of each.
 */
function chooseCandidates(
  candidates: Candidate[],
  count: number,
  needsPerishable: boolean,
  objective: "units" | "cost",
): Candidate[] | null {
  if (count > candidates.length) return null;
  const sorted = [...candidates].sort(
    (a, b) => weight(a, objective) - weight(b, objective) || a.order - b.order,
  );
  const chosen = sorted.slice(0, count);
  if (!needsPerishable || chosen.some((c) => c.perishable)) return chosen;

  const perishable = sorted.find((c) => c.perishable && !chosen.includes(c));
  if (!perishable) return null;
  // Drop the dearest chosen non-perishable for the cheapest perishable available.
  const dearest = [...chosen].reverse().find((c) => !c.perishable);
  if (!dearest) return null;
  return [...chosen.filter((c) => c !== dearest), perishable];
}

function buildOption(
  evaluation: CategoryEvaluation,
  chosen: Candidate[],
  needsPerishable: boolean,
  targets: Targets,
): CategoryOption {
  const { category } = evaluation;
  const varieties = evaluation.varietiesCounted + chosen.length;
  const unitsFromChoices = chosen.reduce((sum, c) => sum + c.categoryUnitsGained, 0);

  // Close the category's own unit floor with units on a variety that already
  // qualifies. Only reachable when the category will have a qualifying variety.
  const unitsBefore = evaluation.unitsCounted + unitsFromChoices;
  const fillerUnits = targets.allowFiller
    ? Math.max(0, targets.unitsPerCategory - unitsBefore)
    : 0;
  const canTakeFiller = evaluation.qualifying.length + chosen.length > 0;

  const chosenCost = chosen.reduce<number | null>(
    (sum, c) => (sum === null || c.cost === null ? null : sum + c.cost),
    0,
  );

  return {
    category,
    chosen,
    fillerUnits,
    addedUnits: chosen.reduce((sum, c) => sum + c.addedUnits, 0) + fillerUnits,
    // Filler has no price attached, so a priced plan cannot include it.
    cost: fillerUnits > 0 ? null : chosenCost,
    unitsGained: unitsFromChoices + fillerUnits,
    endsWithPerishable: evaluation.hasPerishable || chosen.some((c) => c.perishable),
    feasible:
      varieties >= targets.varietiesPerCategory[category] &&
      (fillerUnits === 0 || canTakeFiller) &&
      (!needsPerishable || evaluation.hasPerishable || chosen.some((c) => c.perishable)),
  };
}

/**
 * Every option worth considering for one category: enough candidates to meet
 * the variety floor, optionally a few more (a top-up is the most unit-efficient
 * way there is to add counted units, so extra ones can be the cheapest way to
 * close the 84-unit total), with and without a forced perishable.
 */
function optionsFor(
  evaluation: CategoryEvaluation,
  candidates: Candidate[],
  totalUnitsShort: number,
  objective: "units" | "cost",
  targets: Targets,
): CategoryOption[] {
  const minPicks = Math.max(
    0,
    targets.varietiesPerCategory[evaluation.category] - evaluation.varietiesCounted,
  );
  // An extra pick adds at least the per-variety minimum, so more than this many
  // can never help close the total. A category with no perishable needs room for
  // one more pick even when the totals are already met, because supplying the
  // missing perishable is itself a reason to add a variety.
  const usefulExtras = Math.max(
    Math.ceil(Math.max(0, totalUnitsShort) / MIN_STOCKING_UNITS_PER_VARIETY),
    evaluation.hasPerishable ? 0 : 1,
  );
  const maxPicks = Math.min(candidates.length, minPicks + usefulExtras);

  const options: CategoryOption[] = [];
  for (let count = minPicks; count <= maxPicks; count++) {
    for (const needsPerishable of [false, true]) {
      const chosen = chooseCandidates(candidates, count, needsPerishable, objective);
      if (!chosen) continue;
      const option = buildOption(evaluation, chosen, needsPerishable, targets);
      if (option.feasible) options.push(option);
    }
  }
  // Nothing to do here at all: already meets its own floors and adds no units.
  if (options.length === 0) {
    const empty = buildOption(evaluation, [], false, targets);
    if (empty.feasible) options.push(empty);
  }
  return dedupeOptions(options);
}

function dedupeOptions(options: CategoryOption[]): CategoryOption[] {
  const best = new Map<string, CategoryOption>();
  for (const option of options) {
    // Two options that add the same units and gain the same units in the same
    // perishable state are interchangeable.
    const signature = `${option.addedUnits}|${option.unitsGained}|${option.endsWithPerishable}`;
    const existing = best.get(signature);
    if (!existing || (option.cost ?? Infinity) < (existing.cost ?? Infinity)) {
      best.set(signature, option);
    }
  }
  return [...best.values()];
}

// ---------------------------------------------------------------------------
// Combination
// ---------------------------------------------------------------------------
interface Combination {
  options: CategoryOption[];
  /** Units added anywhere to close the 84-unit total after per-category floors. */
  globalFiller: { category: Category; units: number } | null;
  addedUnits: number;
  cost: number | null;
}

function combine(
  evaluation: StandardEvaluation,
  optionsByCategory: CategoryOption[][],
  objective: "units" | "cost",
  targets: Targets,
): Combination | null {
  let best: Combination | null = null;

  const walk = (index: number, picked: CategoryOption[]) => {
    if (index === optionsByCategory.length) {
      const candidate = closeTotals(evaluation, picked, targets);
      if (!candidate) return;
      if (best === null || isBetter(candidate, best, objective)) best = candidate;
      return;
    }
    for (const option of optionsByCategory[index]) walk(index + 1, [...picked, option]);
  };
  walk(0, []);

  return best;
}

/**
 * Add the perishable and total-unit closers a combination still needs, or
 * reject it. A unit added to a qualifying variety buys exactly one counted
 * unit, so the cheapest place for it is wherever a qualifying variety exists.
 */
function closeTotals(
  evaluation: StandardEvaluation,
  picked: CategoryOption[],
  targets: Targets,
): Combination | null {
  const perishableCategories = picked.filter((o) => o.endsWithPerishable).length;
  if (perishableCategories < targets.perishableCategories) return null;

  const unitsGained = picked.reduce((sum, o) => sum + o.unitsGained, 0);
  const shortfall = targets.allowFiller
    ? Math.max(0, targets.totalUnits - (evaluation.totalUnits + unitsGained))
    : 0;

  let globalFiller: Combination["globalFiller"] = null;
  if (shortfall > 0) {
    const host = evaluation.categories.find(
      (c, i) => c.qualifying.length + picked[i].chosen.length > 0,
    );
    if (!host) return null;
    globalFiller = { category: host.category, units: shortfall };
  }

  const optionCost = picked.reduce<number | null>(
    (sum, o) => (sum === null || o.cost === null ? null : sum + o.cost),
    0,
  );

  return {
    options: picked,
    globalFiller,
    addedUnits: picked.reduce((sum, o) => sum + o.addedUnits, 0) + shortfall,
    cost: globalFiller ? null : optionCost,
  };
}

function isBetter(a: Combination, b: Combination, objective: "units" | "cost"): boolean {
  if (objective === "cost" && a.cost !== null && b.cost !== null) {
    if (a.cost !== b.cost) return a.cost < b.cost;
    return a.addedUnits < b.addedUnits;
  }
  if (a.addedUnits !== b.addedUnits) return a.addedUnits < b.addedUnits;
  // Same units: prefer the cheaper plan, then the one with fewer separate items.
  const aCost = a.cost ?? Infinity;
  const bCost = b.cost ?? Infinity;
  if (aCost !== bCost) return aCost < bCost;
  return itemCount(a) < itemCount(b);
}

function itemCount(combination: Combination): number {
  return (
    combination.options.reduce((n, o) => n + o.chosen.length + (o.fillerUnits > 0 ? 1 : 0), 0) +
    (combination.globalFiller ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------
/**
 * Replay the plan one action at a time and record which requirements flip from
 * unmet to met at each step. Attribution is then a fact about the plan rather
 * than a sentence written next to it.
 */
function attribute(lines: readonly CountableLine[], actions: FixAction[]): void {
  let current = [...lines];
  let unmet = keysOf(evaluateStandard(current).unmet);

  for (const action of actions) {
    current = [
      ...current,
      {
        category: action.category,
        variety: action.variety,
        // A top-up is expressed as the units the store adds; the units it
        // already holds are in `lines` under the same variety key.
        units: action.addedUnits,
        perishable: action.perishable,
      },
    ];
    const next = evaluateStandard(current);
    const nextKeys = keysOf(next.unmet);
    action.clears = [...unmet.entries()]
      .filter(([key]) => !nextKeys.has(key))
      .map(([, constraint]) => constraint);
    unmet = nextKeys;
  }
}

function keysOf(unmet: readonly UnmetConstraint[]): Map<string, UnmetConstraint> {
  return new Map(
    unmet.map((c) => [
      c.kind === "category-varieties" || c.kind === "category-units"
        ? `${c.kind}:${c.category}`
        : c.kind,
      c,
    ]),
  );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
/**
 * Minimum set of additions that clears every unmet requirement at once.
 *
 * `lines` is the same countable input evaluateStandard() takes, so the plan can
 * be verified by re-scoring: `sufficient` is the result of doing exactly that,
 * not a claim.
 */
export function planFixes(
  lines: readonly CountableLine[],
  catalog: readonly CatalogItem[],
  options: OptimizeOptions = {},
): FixPlan {
  const unitCosts = options.unitCosts ?? {};
  const requested = options.objective ?? "units";
  const evaluation = evaluateStandard(lines);

  if (evaluation.meets) {
    return {
      actions: [],
      totalAddedUnits: 0,
      totalCost: 0,
      objective: requested,
      sufficient: true,
      unresolved: [],
    };
  }

  const candidatesByCategory = evaluation.categories.map((c) =>
    candidatesFor(c, catalog, unitCosts),
  );
  // Costing only means anything when every candidate carries a price.
  const priced = candidatesByCategory.every((list) => list.every((c) => c.cost !== null));
  const objective = requested === "cost" && priced ? "cost" : "units";

  const search = (targets: Targets) =>
    combine(
      evaluation,
      evaluation.categories.map((c, i) =>
        optionsFor(c, candidatesByCategory[i], evaluation.totalUnitsShort, objective, targets),
      ),
      objective,
      targets,
    );

  // Solve the real standard first. Only if the catalogue cannot reach it does the
  // search fall back to the best plan available, which reports itself as short.
  const best =
    search(strictTargets()) ?? search(relaxedTargets(evaluation, candidatesByCategory));

  if (!best) {
    return {
      actions: [],
      totalAddedUnits: 0,
      totalCost: null,
      objective,
      sufficient: false,
      unresolved: [...evaluation.unmet],
    };
  }

  const actions = toActions(best, evaluation, unitCosts);
  attribute(lines, actions);

  const projected = evaluateStandard(projectLines(lines, actions));
  const totalCost = actions.reduce<number | null>(
    (sum, a) => (sum === null || a.cost === null ? null : sum + a.cost),
    0,
  );

  return {
    actions,
    totalAddedUnits: actions.reduce((sum, a) => sum + a.addedUnits, 0),
    totalCost,
    objective,
    sufficient: projected.meets,
    unresolved: [...projected.unmet],
  };
}

/** The countable lines the store would have after carrying out a plan. */
export function projectLines(
  lines: readonly CountableLine[],
  actions: readonly FixAction[],
): CountableLine[] {
  return [
    ...lines,
    ...actions.map((action) => ({
      category: action.category,
      variety: action.variety,
      units: action.addedUnits,
      perishable: action.perishable,
    })),
  ];
}

function toActions(
  best: Combination,
  evaluation: StandardEvaluation,
  unitCosts: Readonly<Record<string, number>>,
): FixAction[] {
  const actions: FixAction[] = [];

  // Category order keeps output stable; within a category, the cheapest first.
  for (const category of CATEGORIES) {
    const option = best.options.find((o) => o.category === category);
    if (!option) continue;
    for (const candidate of [...option.chosen].sort(
      (a, b) => a.addedUnits - b.addedUnits || a.order - b.order,
    )) {
      actions.push({ ...candidate, clears: [] });
    }
    if (option.fillerUnits > 0) {
      actions.push(fillerAction(evaluation, option.category, option.fillerUnits, unitCosts, option));
    }
  }

  if (best.globalFiller) {
    const option = best.options.find((o) => o.category === best.globalFiller?.category);
    actions.push(
      fillerAction(
        evaluation,
        best.globalFiller.category,
        best.globalFiller.units,
        unitCosts,
        option,
      ),
    );
  }
  return actions;
}

/**
 * Units added to a variety that already qualifies (or is about to), used only
 * to close a unit total. The host is the category's first qualifying variety so
 * the advice names something real.
 */
function fillerAction(
  evaluation: StandardEvaluation,
  category: Category,
  units: number,
  unitCosts: Readonly<Record<string, number>>,
  option?: CategoryOption,
): FixAction {
  const categoryEval = evaluation.categories.find((c) => c.category === category);
  const host = categoryEval?.qualifying[0];
  const variety = host?.variety ?? option?.chosen[0]?.variety ?? "";
  const unitCost = unitCostOf(category, variety, unitCosts);

  return {
    kind: "extra-units",
    category,
    variety,
    key: varietyKey(variety),
    addedUnits: units,
    resultingVarietyUnits: (host?.units ?? MIN_STOCKING_UNITS_PER_VARIETY) + units,
    categoryUnitsGained: units,
    perishable: host?.perishable ?? option?.chosen[0]?.perishable ?? false,
    unitCost,
    cost: unitCost === null ? null : unitCost * units,
    clears: [],
  };
}

/** Re-exported so callers reading a plan do not have to import two modules. */
export {
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
};
