"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import styles from "./StatRing.module.css";

interface StatRingProps {
  percent: number;
  size?: number;
  label?: string;
  tone?: "blue" | "bad";
}

/** Framer's standard ease, matching the rest of the site's motion. */
const DURATION = 0.7;

/**
 * Tweens towards `target` every time it changes, but stays put until `active`.
 *
 * The ring is both a scroll reveal on the marketing page and a live readout on
 * the dashboard. Animating only on first view covered the first case and broke
 * the second: a scan that moved readiness from 63 to 50 snapped without the
 * drop ever being visible, which is the one number an owner is watching.
 *
 * It starts AT the target rather than at zero, so the server-rendered ring reads
 * the true percentage. A ring that says 0% next to "3 of 4 categories meet the
 * threshold" is not an unfinished animation to whoever is reading it: it is a
 * store being told it is failing.
 */
function useTween(target: number, active: boolean): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const reduce = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reduce) return;
    // Client only, before the first paint: rewind so there is something to play.
    from.current = 0;
    setValue(0);
    // Mount only.
  }, []);

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (DURATION * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (target - origin) * eased;
      setValue(next);
      from.current = next;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduce]);

  return value;
}

const CELLS = 20;

/**
 * The headline readiness number, set like the total at the foot of a ledger
 * page: a big tabular figure over a 20-cell rule, one cell per 5%.
 */
export function StatRing({ percent, size = 160, label, tone = "blue" }: StatRingProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.6 });
  const clamped = Math.max(0, Math.min(100, percent));
  const shown = useTween(clamped, inView);
  const lit = Math.round((shown / 100) * CELLS);

  return (
    <div ref={wrapRef} className={styles.wrap} data-tone={tone} style={{ width: size }}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <span className={styles.value}>
        {Math.round(shown)}
        <small>%</small>
      </span>
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: CELLS }).map((_, i) => (
          <i key={i} data-on={i < lit} />
        ))}
      </span>
    </div>
  );
}
