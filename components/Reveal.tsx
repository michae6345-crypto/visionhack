"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Seconds. Stagger siblings with i * 0.05. */
  delay?: number;
  /** Travel distance in px. Spec: 16–24. */
  y?: number;
  as?: "div" | "li" | "span";
  className?: string;
}

/**
 * Reveals its children when they scroll into view.
 *
 * The hidden state lives in CSS behind the `data-js` gate that app/layout.tsx
 * sets, rather than in an inline style rendered on the server. That matters:
 * an entrance animation implemented in JavaScript ships its hidden state in the
 * HTML, so the page is blank until React hydrates and stays blank for anything
 * that never runs JS. Here, no script means no gate, which means the content is
 * simply visible.
 *
 * The observer is the only thing JavaScript is used for.
 */
export function Reveal({ children, delay = 0, y = 20, as = "div", className }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (or a very old browser): show it and move on.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);

    // Already on screen at mount, below the observer's threshold (a short
    // element at the bottom of the viewport), so check once directly.
    const box = node.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) setVisible(true);

    return () => observer.disconnect();
  }, []);

  const Tag = as;
  const style = {
    "--reveal-delay": `${delay}s`,
    "--reveal-y": `${y}px`,
  } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={className ? `reveal ${className}` : "reveal"}
      data-visible={visible ? "true" : undefined}
      style={style}
    >
      {children}
    </Tag>
  );
}
