"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/Pill";
import {
  SHELF_CATALOGUE,
  SHELF_MAX_UNITS,
  presetUnits,
  shelfLines,
  varietiesIn,
  type PresetId,
  type ShelfUnits,
} from "@/lib/shelf";
import {
  evaluateStandard,
  REQUIRED_PERISHABLE_CATEGORIES,
  REQUIRED_TOTAL_UNITS,
  REQUIRED_UNITS_PER_CATEGORY,
  REQUIRED_VARIETIES_PER_CATEGORY,
} from "@/lib/rules/standard";
import { CATEGORIES, MIN_STOCKING_UNITS_PER_VARIETY, type Category } from "@/lib/rules/constants";
import type { Locale } from "@/lib/ui-copy";
import styles from "./ShelfSimulator.module.css";

/**
 * An interactive shelf, scored live by the real rule engine.
 *
 * Every number on this panel comes from lib/rules/standard.ts — the same
 * function that scores a photographed order record. Nothing here re-implements
 * the arithmetic, so the shelf cannot drift from the scan, and the one thing
 * store owners find most surprising about the rule is visible by doing it: take
 * a variety from three units to two and the category loses the variety AND all
 * three of its units at once.
 *
 * There is no model here and no network call. It is arithmetic in the browser.
 */

const LABELS: Record<Category, { en: string; es: string }> = {
  dairy: { en: "Dairy", es: "Lácteos" },
  grains: { en: "Grains", es: "Granos" },
  protein: { en: "Protein", es: "Proteína" },
  produce: { en: "Fruits & vegetables", es: "Frutas y verduras" },
};

const PRESET_ORDER: PresetId[] = ["typical", "oneShort", "meets", "empty"];

const PRESET_LABELS: Record<PresetId, { en: string; es: string }> = {
  typical: { en: "Typical corner store", es: "Tienda típica" },
  oneShort: { en: "One unit short", es: "Una unidad menos" },
  meets: { en: "Exactly at the line", es: "Justo en el límite" },
  empty: { en: "Empty shelf", es: "Estante vacío" },
};

const COPY = {
  en: {
    presetsLabel: "Starting point",
    pass: "Every requirement met",
    fail: "Not every requirement met",
    readingPass: "On these numbers the four categories clear Criterion A. It is still arithmetic, not a determination.",
    readingFail: (n: number) => `${n} ${n === 1 ? "requirement is" : "requirements are"} still short.`,
    reqVarieties: "varieties in every category",
    reqUnits: "units in every category",
    reqTotal: "units across all four",
    reqPerishable: "categories carrying a perishable, 3 needed",
    shortIn: "Short in",
    varieties: "varieties",
    units: "units",
    perishable: "Perishable",
    noPerishable: "No perishable",
    clears: "Clears",
    short: "Short",
    countsForNothing: "below 3 — counts for nothing",
    add: (name: string) => `Add a unit of ${name}`,
    remove: (name: string) => `Remove a unit of ${name}`,
    unitsOf: (name: string) => `Units of ${name}`,
    perishableDot: "perishable",
    shelfStableDot: "shelf-stable",
    total: "Counted units",
    nearLabel: "One unit from counting",
    nearNote: "These are the cheapest gaps on the shelf. A variety below three units contributes nothing, so the unit that gets it to three is worth three.",
    topUp: (name: string, n: number) => `Add ${n} to ${name}`,
    legendPerishable: "perishable",
    legendShelf: "shelf-stable",
    hint: "Drop a variety to two units and watch what it costs.",
  },
  es: {
    presetsLabel: "Punto de partida",
    pass: "Cumple todos los requisitos",
    fail: "Aún no cumple todos los requisitos",
    readingPass: "Con estas cifras las cuatro categorías cumplen el Criterio A. Sigue siendo aritmética, no una determinación.",
    readingFail: (n: number) => `Faltan ${n} ${n === 1 ? "requisito" : "requisitos"}.`,
    reqVarieties: "variedades en cada categoría",
    reqUnits: "unidades en cada categoría",
    reqTotal: "unidades entre las cuatro",
    reqPerishable: "categorías con un perecedero, se necesitan 3",
    shortIn: "Falta en",
    varieties: "variedades",
    units: "unidades",
    perishable: "Perecedero",
    noPerishable: "Sin perecedero",
    clears: "Cumple",
    short: "Por debajo",
    countsForNothing: "menos de 3 — no cuenta",
    add: (name: string) => `Agregar una unidad de ${name}`,
    remove: (name: string) => `Quitar una unidad de ${name}`,
    unitsOf: (name: string) => `Unidades de ${name}`,
    perishableDot: "perecedero",
    shelfStableDot: "no perecedero",
    total: "Unidades contadas",
    nearLabel: "A una unidad de contar",
    nearNote: "Son los huecos más baratos del estante. Una variedad con menos de tres unidades no aporta nada, así que la unidad que la lleva a tres vale por tres.",
    topUp: (name: string, n: number) => `Agregar ${n} a ${name}`,
    legendPerishable: "perecedero",
    legendShelf: "no perecedero",
    hint: "Baja una variedad a dos unidades y mira lo que cuesta.",
  },
} as const;

interface ShelfSimulatorProps {
  locale?: Locale;
  /** Which preset the panel opens on. */
  initialPreset?: PresetId;
}

export function ShelfSimulator({ locale = "en", initialPreset = "typical" }: ShelfSimulatorProps) {
  const [units, setUnits] = useState<ShelfUnits>(() => presetUnits(initialPreset));
  const [preset, setPreset] = useState<PresetId | null>(initialPreset);
  const t = COPY[locale];

  // The whole verdict, recomputed from the shelf on every change. This is the
  // production rule engine, not a copy of it.
  const result = useMemo(() => evaluateStandard(shelfLines(units)), [units]);

  const setUnitsFor = (id: string, next: number) => {
    setPreset(null);
    setUnits((prev) => ({ ...prev, [id]: Math.max(0, Math.min(SHELF_MAX_UNITS, next)) }));
  };

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    setUnits(presetUnits(id));
  };

  const shortVarieties = result.categories.filter(
    (c) => c.varietiesCounted < REQUIRED_VARIETIES_PER_CATEGORY,
  );
  const shortUnits = result.categories.filter(
    (c) => c.unitsCounted < REQUIRED_UNITS_PER_CATEGORY,
  );

  /** One row of the requirement checklist. */
  const requirements = [
    {
      key: "varieties",
      met: shortVarieties.length === 0,
      value: `${result.categories.length - shortVarieties.length}/${result.categories.length}`,
      text: `${REQUIRED_VARIETIES_PER_CATEGORY} ${t.reqVarieties}`,
      blame: shortVarieties.map((c) => LABELS[c.category][locale]),
    },
    {
      key: "units",
      met: shortUnits.length === 0,
      value: `${result.categories.length - shortUnits.length}/${result.categories.length}`,
      text: `${REQUIRED_UNITS_PER_CATEGORY} ${t.reqUnits}`,
      blame: shortUnits.map((c) => LABELS[c.category][locale]),
    },
    {
      key: "total",
      met: result.totalUnits >= REQUIRED_TOTAL_UNITS,
      value: `${result.totalUnits}/${REQUIRED_TOTAL_UNITS}`,
      text: `${REQUIRED_TOTAL_UNITS} ${t.reqTotal}`,
      blame: [],
    },
    {
      key: "perishable",
      met: result.perishableCategories >= REQUIRED_PERISHABLE_CATEGORIES,
      value: `${result.perishableCategories}/${result.categories.length}`,
      text: t.reqPerishable,
      blame: [],
    },
  ];

  /*
   * Varieties the store already carries but has too few units of. These are the
   * cheapest gaps on the shelf — one unit turns three uncounted units into
   * three counted ones — so they get a one-click top-up.
   */
  const nearMisses = SHELF_CATALOGUE.filter((v) => {
    const n = units[v.id] ?? 0;
    return n > 0 && n < MIN_STOCKING_UNITS_PER_VARIETY;
  });

  const unmetCount = requirements.filter((r) => !r.met).length;
  const totalPct = Math.min(100, Math.round((result.totalUnits / REQUIRED_TOTAL_UNITS) * 100));

  return (
    <div className={styles.wrap}>
      <div className={styles.presets} role="group" aria-label={t.presetsLabel}>
        <span className={styles.presetsLabel}>{t.presetsLabel}</span>
        {PRESET_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.preset}
            data-active={preset === id}
            aria-pressed={preset === id}
            onClick={() => applyPreset(id)}
          >
            {PRESET_LABELS[id][locale]}
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        {/* ---- Verdict ---- */}
        <div className={styles.verdictCol}>
          <div className={styles.verdict} data-pass={result.meets} aria-live="polite">
            <span className={styles.verdictMark} aria-hidden="true">
              {result.meets ? (
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path
                    d="m4.5 12.6 4.7 4.7L19.5 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path
                    d="M12 4.6v10.2M12 18.2v1.2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            <span className={styles.verdictText}>{result.meets ? t.pass : t.fail}</span>
          </div>

          <p className={styles.reading}>
            {result.meets ? t.readingPass : t.readingFail(unmetCount)}
          </p>

          <div className={styles.meter}>
            <div className={styles.meterHead}>
              <span className={styles.meterLabel}>{t.total}</span>
              <span className={`${styles.meterValue} tnum`}>
                {result.totalUnits}
                <span className={styles.meterOf}>/{REQUIRED_TOTAL_UNITS}</span>
              </span>
            </div>
            <div
              className={styles.meterTrack}
              role="progressbar"
              aria-valuenow={result.totalUnits}
              aria-valuemin={0}
              aria-valuemax={REQUIRED_TOTAL_UNITS}
              aria-label={t.total}
            >
              <span
                className={styles.meterFill}
                data-full={result.totalUnits >= REQUIRED_TOTAL_UNITS}
                style={{ width: `${totalPct}%` }}
              />
            </div>
          </div>

          <ul className={styles.reqList}>
            {requirements.map((r) => (
              <li key={r.key} className={styles.reqRow} data-met={r.met}>
                <span className={styles.reqIcon} aria-hidden="true">
                  {r.met ? "✓" : "—"}
                </span>
                <span className={`${styles.reqValue} tnum`}>{r.value}</span>
                <span className={styles.reqText}>
                  {r.text}
                  {r.blame.length > 0 ? (
                    <span className={styles.reqBlame}>
                      {t.shortIn} {r.blame.join(", ")}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          {nearMisses.length > 0 ? (
            <div className={styles.near}>
              <span className={styles.nearLabel}>{t.nearLabel}</span>
              <ul className={styles.nearList}>
                {nearMisses.map((variety) => {
                  const short = MIN_STOCKING_UNITS_PER_VARIETY - (units[variety.id] ?? 0);
                  return (
                    <li key={variety.id}>
                      <button
                        type="button"
                        className={styles.nearFix}
                        onClick={() =>
                          setUnitsFor(variety.id, MIN_STOCKING_UNITS_PER_VARIETY)
                        }
                        aria-label={t.topUp(variety[locale], short)}
                      >
                        <span className={styles.nearName}>{variety[locale]}</span>
                        <span className={styles.nearAdd}>+{short}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className={styles.nearNote}>{t.nearNote}</p>
            </div>
          ) : null}

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={styles.dot} data-perishable="true" />
              {t.legendPerishable}
            </span>
            <span className={styles.legendItem}>
              <span className={styles.dot} data-perishable="false" />
              {t.legendShelf}
            </span>
          </div>

          <p className={styles.hint}>{t.hint}</p>
        </div>

        {/* ---- The shelf ---- */}
        <div className={styles.shelfCol}>
          {CATEGORIES.map((category) => {
            const evaluation = result.categories.find((c) => c.category === category);
            if (!evaluation) return null;
            const clears = evaluation.meets;
            return (
              <section key={category} className={styles.catCard} data-clears={clears}>
                <header className={styles.catHead}>
                  <h3 className={styles.catName}>{LABELS[category][locale]}</h3>
                  <Pill tone={clears ? "ok" : "bad"}>{clears ? t.clears : t.short}</Pill>
                </header>

                <div className={styles.catNums}>
                  <span
                    className={styles.catNum}
                    data-met={evaluation.varietiesCounted >= REQUIRED_VARIETIES_PER_CATEGORY}
                  >
                    <strong className="tnum">{evaluation.varietiesCounted}</strong>/
                    {REQUIRED_VARIETIES_PER_CATEGORY} {t.varieties}
                  </span>
                  <span
                    className={styles.catNum}
                    data-met={evaluation.unitsCounted >= REQUIRED_UNITS_PER_CATEGORY}
                  >
                    <strong className="tnum">{evaluation.unitsCounted}</strong>/
                    {REQUIRED_UNITS_PER_CATEGORY} {t.units}
                  </span>
                  <span className={styles.catNum} data-met={evaluation.hasPerishable}>
                    {evaluation.hasPerishable ? t.perishable : t.noPerishable}
                  </span>
                </div>

                <ul className={styles.varietyList}>
                  {varietiesIn(category).map((variety) => {
                    const count = units[variety.id] ?? 0;
                    const counts = count >= MIN_STOCKING_UNITS_PER_VARIETY;
                    const nearMiss = count > 0 && !counts;
                    const name = variety[locale];
                    return (
                      <li
                        key={variety.id}
                        className={styles.varietyRow}
                        data-counts={counts}
                        data-near={nearMiss}
                        data-empty={count === 0}
                      >
                        <span
                          className={styles.dot}
                          data-perishable={variety.perishable}
                          title={variety.perishable ? t.perishableDot : t.shelfStableDot}
                        />
                        <span className={styles.varietyName}>
                          {name}
                          {nearMiss ? (
                            <span className={styles.nearNote}>{t.countsForNothing}</span>
                          ) : null}
                        </span>
                        <span className={styles.stepper}>
                          <button
                            type="button"
                            className={styles.step}
                            onClick={() => setUnitsFor(variety.id, count - 1)}
                            disabled={count === 0}
                            aria-label={t.remove(name)}
                          >
                            &minus;
                          </button>
                          <output
                            className={`${styles.count} tnum`}
                            aria-label={t.unitsOf(name)}
                          >
                            {count}
                          </output>
                          <button
                            type="button"
                            className={styles.step}
                            onClick={() => setUnitsFor(variety.id, count + 1)}
                            disabled={count >= SHELF_MAX_UNITS}
                            aria-label={t.add(name)}
                          >
                            +
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
