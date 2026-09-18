"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { AppWindow } from "@/components/AppWindow";
import { Button } from "@/components/Button";
import { Pill } from "@/components/Pill";
import { CategoryBar } from "@/components/CategoryBar";
import { downscaleImage } from "@/lib/downscale";
import { SAMPLE_HELD_BACK, sampleScorecard } from "@/lib/sample-data";
import {
  UI_COPY,
  REQUIRED_VARIETIES,
  REQUIRED_UNITS,
  formatScanDate,
  heldBackReason,
  scorecardReading,
  shortCategories,
  type Locale,
} from "@/lib/ui-copy";
import type { ScanResult } from "@/lib/mock-data";
import type { ScanResponse } from "@/lib/types";
import styles from "./DemoScanner.module.css";

type Status = "idle" | "scanning" | "done" | "error";

/** A line the scan read but did not count, with its reason in both languages. */
interface HeldBackRow {
  line: string;
  reason: string;
  reasonEs: string;
}

interface Scan {
  en: ScanResult;
  es: ScanResult;
  heldBack: HeldBackRow[];
}

function sampleScan(): Scan {
  return {
    en: sampleScorecard("en"),
    es: sampleScorecard("es"),
    heldBack: SAMPLE_HELD_BACK.map((row) => ({
      line: `${row.line} ${row.pack}`,
      reason: row.reason,
      reasonEs: row.reasonEs,
    })),
  };
}

interface DemoScannerProps {
  /**
   * Called with the English scorecard whenever one is produced, including the
   * sample. The dashboard uses it to fold stocking into the readiness score;
   * the marketing demo leaves it unset and stays self-contained.
   */
  onResult?: (result: ScanResult) => void;
  /** Open on the upload pane rather than a pre-filled sample scorecard. */
  startEmpty?: boolean;
}

export function DemoScanner({ onResult, startEmpty = false }: DemoScannerProps = {}) {
  const [locale, setLocale] = useState<Locale>("en");
  // The marketing demo opens on a filled scorecard so the page is never empty.
  // Embedded in the dashboard it opens empty, because the reader just asked to
  // scan something and a pre-filled result would read as their own.
  const [status, setStatus] = useState<Status>(startEmpty ? "idle" : "done");
  // Both languages come back on a single scan, so keep both and pick at render
  // time. Storing only the active one is why switching language used to do
  // nothing after a real scan.
  const [scan, setScan] = useState<Scan | null>(() => (startEmpty ? null : sampleScan()));
  const [isSample, setIsSample] = useState(!startEmpty);
  const [errorMsg, setErrorMsg] = useState("");
  const [storeName, setStoreName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const t = UI_COPY[locale];

  const runScan = useCallback(
    async (file: File) => {
      setStatus("scanning");
      setErrorMsg("");
      setIsSample(false);
      try {
        const prepared = await downscaleImage(file);
        const body = new FormData();
        body.append("image", prepared, "order-record.jpg");
        if (storeName.trim()) body.append("storeName", storeName.trim());

        const res = await fetch("/api/scan", { method: "POST", body });
        const data: ScanResponse = await res.json();
        if (!data.ok) {
          setErrorMsg(data.error.message);
          setStatus("error");
          return;
        }
        setScan({
          en: data.scorecard,
          es: data.scorecardEs,
          // Held-back lines stay visible so a reader can see why a line on the
          // order record is missing from the counts.
          heldBack: data.excluded.map((item) => ({
            line: item.description,
            reason: item.reason,
            reasonEs: heldBackReason(item.reason, "es"),
          })),
        });
        setStatus("done");
        onResult?.(data.scorecard);
      } catch {
        setErrorMsg(t.tryError);
        setStatus("error");
      }
    },
    [storeName, t.tryError, onResult],
  );

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void runScan(file);
  };

  const loadSample = () => {
    const sample = sampleScan();
    setScan(sample);
    onResult?.(sample.en);
    setIsSample(true);
    setStatus("done");
  };

  const reset = () => {
    setStatus("idle");
    setScan(null);
    setIsSample(false);
    setErrorMsg("");
  };

  // Purely a display switch: no refetch, and nothing to re-derive.
  const switchLocale = (next: Locale) => setLocale(next);

  const result = scan ? (locale === "es" ? scan.es : scan.en) : null;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.langToggle} role="group" aria-label="Language">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              type="button"
              data-active={locale === l}
              onClick={() => switchLocale(l)}
            >
              {l === "en" ? "English" : "Español"}
            </button>
          ))}
        </div>
        {status === "done" ? (
          <Button variant="ghost" onClick={reset}>
            {t.rescan}
          </Button>
        ) : null}
      </div>

      <AppWindow url="app.ledger.co/demo">
        <div className={styles.body}>
          <AnimatePresence mode="wait">
            {status !== "done" ? (
              <motion.div
                key="upload"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={styles.uploadPane}
              >
                <div className={styles.uploadHead}>
                  <h2 className="heading">{t.uploadTitle}</h2>
                  <p className="small mute">{t.uploadHint}</p>
                </div>

                <label className={styles.storeField}>
                  <span className={styles.fieldLabel}>{t.storeNameLabel}</span>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t.storeNamePlaceholder}
                    className={styles.input}
                  />
                </label>

                <div
                  className={styles.dropzone}
                  data-drag={dragOver}
                  data-busy={status === "scanning"}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (status !== "scanning") onFile(e.dataTransfer.files);
                  }}
                >
                  {status === "scanning" ? (
                    <div className={styles.scanning}>
                      <span className={styles.spinner} aria-hidden="true" />
                      <span className="body">{t.scanning}&hellip;</span>
                    </div>
                  ) : (
                    <>
                      <p className={styles.dropText}>{t.dropHere}</p>
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className={styles.hiddenInput}
                        onChange={(e) => onFile(e.target.files)}
                      />
                      <Button onClick={() => inputRef.current?.click()}>
                        {t.chooseFile}
                      </Button>
                    </>
                  )}
                </div>

                {errorMsg ? (
                  <p className={styles.error} role="alert">
                    {errorMsg}
                  </p>
                ) : null}

                <button type="button" className={styles.sampleLink} onClick={loadSample}>
                  {t.loadSample} &rarr;
                </button>
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 0.68, 0.28, 1] }}
              >
                <Scorecard
                  result={result}
                  heldBack={scan?.heldBack ?? []}
                  locale={locale}
                  isSample={isSample}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </AppWindow>
    </div>
  );
}

function Scorecard({
  result,
  heldBack,
  locale,
  isSample,
}: {
  result: ScanResult;
  heldBack: HeldBackRow[];
  locale: Locale;
  isSample: boolean;
}) {
  const t = UI_COPY[locale];
  const es = locale === "es";
  const pass = result.overallStatus === "pass";
  const passing = result.categories.length - shortCategories(result).length;
  const dateFmt = formatScanDate(result.scanDate, locale);
  const reading = scorecardReading(result, locale);

  const stats = [
    {
      value: `${passing}/${result.categories.length}`,
      label: es ? "categorías que cumplen" : "categories clearing",
    },
    { value: String(result.totalUnits), label: es ? "unidades contadas" : "units counted" },
    {
      value: `${result.perishableCategoriesMet}/4`,
      label: es ? "con un perecedero" : "with a perishable",
    },
  ];
  // What the fix optimizer solved for, when there is anything to solve.
  if (result.fixPlan && result.fixPlan.totalAddedUnits > 0) {
    stats.push({ value: String(result.fixPlan.totalAddedUnits), label: t.unitsToAdd });
  }

  return (
    <div className={styles.scorecard}>
      <header className={styles.scHeader}>
        <div className={styles.scMetaTop}>
          <span className="eyebrow mute">{result.storeName}</span>
          {isSample ? <span className={styles.sampleBadge}>{t.sampleBadge}</span> : null}
        </div>
        <h2 className={styles.verdict} data-pass={pass}>
          {pass ? t.verdictPass : t.verdictFail}
        </h2>
        <p className={styles.reading}>{reading}</p>
        <p className={`small mute ${styles.scDate}`}>
          {t.scannedOn} {dateFmt}
        </p>
        {/* docs/regulatory-basis.md: this line travels with the result. */}
        <p className={styles.disclosure}>{t.disclosure}</p>
      </header>

      <div className={styles.statRow}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCell}>
            <span className={`${styles.statValue} tnum`}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.ruleNote}>
        <span className={styles.ruleNoteLabel}>{es ? "La regla" : "The rule"}</span>
        <span>
          {es
            ? "Cada categoría necesita 7 variedades y 21 unidades. Tres de las cuatro deben incluir un perecedero."
            : "Every category needs 7 varieties and 21 units. Three of the four must include a perishable item."}
        </span>
      </div>

      <div className={styles.catGrid}>
        {result.categories.map((cat, i) => {
          const clears =
            cat.varietiesFound >= REQUIRED_VARIETIES &&
            cat.unitsFound >= REQUIRED_UNITS;
          return (
            <div key={cat.category} className={styles.catCard} data-clears={clears}>
              <div className={styles.catTop}>
                <span className={styles.catLabel}>{cat.label}</span>
                <Pill tone={clears ? "ok" : "bad"}>
                  {clears
                    ? es
                      ? "Cumple"
                      : "Clears"
                    : es
                      ? "Por debajo"
                      : "Short"}
                </Pill>
              </div>
              <CategoryBar
                name={`${cat.varietiesFound} ${t.varieties}`}
                count={cat.varietiesFound}
                target={REQUIRED_VARIETIES}
                index={i}
              />
              <div className={styles.catNums}>
                <span>
                  <strong className="tnum">{cat.varietiesFound}</strong>/
                  {REQUIRED_VARIETIES} {t.varieties}
                </span>
                <span>
                  <strong className="tnum">{cat.unitsFound}</strong>/{REQUIRED_UNITS}{" "}
                  {t.units}
                </span>
                <span>{cat.hasPerishable ? t.perishableYes : t.perishableNo}</span>
              </div>
              <ul className={styles.itemList}>
                {cat.items.map((item) => (
                  <li key={item.name} className={styles.itemRow}>
                    <span className={styles.itemName}>{item.variety}</span>
                    <span className={`${styles.itemUnits} tnum`}>{item.units}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {heldBack.length > 0 ? (
        <div className={styles.heldBack}>
          <h3 className={styles.blockTitle}>
            {es ? "Líneas que no contamos" : "Lines we did not count"}
          </h3>
          <p className={styles.blockIntro}>
            {es
              ? "Cada línea que el escaneo no pudo contar con certeza aparece aquí con el motivo. Ninguna se adivina."
              : "Every line the scan could not count with certainty is listed here with the reason. None of them are guessed at."}
          </p>
          <table className={styles.hbTable}>
            <thead>
              <tr>
                <th>{es ? "Línea" : "Line"}</th>
                <th>{es ? "Motivo" : "Reason"}</th>
              </tr>
            </thead>
            <tbody>
              {heldBack.map((row, i) => (
                <tr key={`${i}-${row.line}`}>
                  <td className={styles.hbLine}>{row.line}</td>
                  <td className={styles.hbReason}>{es ? row.reasonEs : row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={styles.fixes}>
        <h3 className={styles.blockTitle}>{t.fixesTitle}</h3>
        {result.fixes.length === 0 ? (
          <p className="body mute">{t.fixesEmpty}</p>
        ) : (
          <>
            {result.fixPlan ? (
              <p className={`small mute ${styles.planSummary}`}>
                {t.planSummary(result.fixPlan.totalAddedUnits, result.fixes.length)}
                {result.fixPlan.sufficient ? null : (
                  <>
                    {" "}
                    <strong className={styles.planShort}>{t.planShort}</strong>
                  </>
                )}
              </p>
            ) : null}
            <ol className={styles.fixList}>
              {result.fixes.map((fix, i) => (
                <li key={i} className={styles.fixItem}>
                  <span className={styles.fixIndex}>{i + 1}</span>
                  <div>
                    <p className={styles.fixSuggestion}>{fix.itemSuggestion}</p>
                    <p className="small mute">
                      <span className={styles.whyLabel}>{t.whyItHelps}:</span>{" "}
                      {fix.whyItHelps}
                    </p>
                    {/* Which requirement this one purchase actually clears. The
                        optimizer works it out by replaying the plan, so it is a
                        fact about the plan rather than a sentence beside it. */}
                    {fix.clears && fix.clears.length > 0 ? (
                      <p className={styles.clears}>
                        <span className={styles.clearsLabel}>{t.clearsLabel}</span>
                        {fix.clears.map((phrase) => (
                          <span key={phrase} className={styles.clearsChip}>
                            {phrase}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
