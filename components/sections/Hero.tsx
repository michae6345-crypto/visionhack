import Link from "next/link";
import { AppWindow } from "@/components/AppWindow";
import { Button } from "@/components/Button";
import { DashboardMock } from "./DashboardMock";
import styles from "./sections.module.css";

const FACTS = [
  ["Programmes tracked", "18"],
  ["Set-up", "10 min"],
  ["Languages", "EN / ES"],
];

/**
 * The entrance animation is CSS (see app/globals.css), so the hero paints with
 * the browser's first frame instead of waiting for React. This used to be a
 * JavaScript animation, which meant the server sent `opacity: 0` on the
 * headline and the landing page was blank until hydration finished.
 *
 * With no motion hook left, this is a server component: no client bundle at all.
 */
export function Hero() {
  /** Staggers the entrance; the animation itself is the .rise class. */
  const delay = (seconds: number) => ({ style: { animationDelay: `${seconds}s` } });

  return (
    <section className={styles.hero} data-ground="paper">
      <div className={styles.heroInner}>
        <p {...delay(0)} className={`rise eyebrow ${styles.heroKicker}`}>
          Ledger &mdash; license tracking for corner stores
        </p>

        <h1 {...delay(0.05)} className={`rise display-xl ${styles.heroTitle}`}>
          Keep every license
          <br />
          your store runs on.
        </h1>

        <p {...delay(0.1)} className={`rise body-l ${styles.heroBody}`}>
          Enter your licenses once. Ledger tracks every renewal date and checks your shelves
          against the SNAP stocking rule.
        </p>

        <div {...delay(0.15)} className={`rise ${styles.heroButtons}`}>
          <Button href="/demo" size="lg">
            Open the demo
          </Button>
          <Button href="/how-it-works" variant="secondary" size="lg">
            See the rule
          </Button>
        </div>

        <dl {...delay(0.2)} className={`rise ${styles.heroFacts}`}>
          {FACTS.map(([k, v]) => (
            <div key={k} className={styles.heroFact}>
              <dt>{k}</dt>
              <dd className="tnum">{v}</dd>
            </div>
          ))}
        </dl>

        <div className={`slide-in ${styles.heroWindow}`} style={{ animationDelay: "0.28s" }}>
          {/* The hero scorecard is the most-clicked thing on the page. It
              opens the real dashboard rather than sitting there as a picture. */}
          <Link href="/dashboard" className={styles.heroWindowLink} aria-label="Open the dashboard">
            <AppWindow>
              <DashboardMock />
            </AppWindow>
          </Link>
        </div>
      </div>
    </section>
  );
}
