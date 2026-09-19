"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import styles from "./StatRing.module.css";

interface StatRingProps {
  percent: number;
  size?: number;
  label?: string;
  tone?: "blue" | "bad";
}

/** Framer's standard ease, matching the rest of the site's motion. */
const EASE = [0.22, 0.68, 0.28, 1] as const;
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

export function StatRing({ percent, size = 160, label, tone = "blue" }: StatRingProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = tone === "bad" ? "var(--bad)" : "var(--blue)";
  const shown = useTween(clamped, inView);

  return (
    <div ref={wrapRef} className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tint)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={reduce ? false : { strokeDashoffset: c }}
          // Held at full until the ring scrolls into view, then it tracks
          // `offset` for the life of the component, re-animating on every change.
          animate={inView ? { strokeDashoffset: offset, stroke: color } : undefined}
          style={reduce ? { strokeDashoffset: offset, stroke: color } : { stroke: color }}
          transition={{ duration: DURATION, ease: EASE }}
        />
      </svg>
      <div className={styles.center}>
        <span className={styles.value}>{Math.round(shown)}%</span>
        {label ? <span className={styles.label}>{label}</span> : null}
      </div>
    </div>
  );
}
