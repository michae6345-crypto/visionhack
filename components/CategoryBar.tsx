"use client";

import { REQUIRED_VARIETIES } from "@/lib/ui-copy";
import styles from "./CategoryBar.module.css";

interface CategoryBarProps {
  name: string;
  count: number;
  /** Varieties needed to clear the category. Defaults to the real rule. */
  target?: number;
  /** Kept for callers; the boxes no longer animate. */
  index?: number;
}

export function CategoryBar({ name, count, target = REQUIRED_VARIETIES }: CategoryBarProps) {
  const short = count < target;
  const segments = Math.max(target, count);

  return (
    <div
      className={styles.row}
      role="meter"
      aria-valuenow={count}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-label={`${name}: ${count} of ${target}`}
    >
      <span className={styles.name}>{name}</span>
      {/* One box per variety the rule asks for, like a tally column in a
          ledger: filled when it is on the shelf, struck through when not. */}
      <span className={styles.cells} aria-hidden="true">
        {Array.from({ length: segments }).map((_, i) => (
          <i key={i} data-on={i < count} data-short={short} />
        ))}
      </span>
      <span className={styles.count} data-short={short}>
        {count}/{target}
      </span>
    </div>
  );
}
