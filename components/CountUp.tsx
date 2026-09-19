"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

interface CountUpProps {
  to: number;
  duration?: number;
  className?: string;
}

/**
 * Counts up to `to` when it scrolls into view.
 *
 * The rendered value starts AT the target, not at zero, so the server HTML
 * carries the real figure. The client drops it to zero in a layout effect,
 * before the first paint, and animates back up from there.
 */
export function CountUp({ to, duration = 0.6, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);

  useIsomorphicLayoutEffect(() => {
    // Only the client animates, and only when motion is welcome.
    if (!reduce) setValue(0);
    // Mount only: a later change to `to` is handled by the effect below.
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * to));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-US")}
    </span>
  );
}
