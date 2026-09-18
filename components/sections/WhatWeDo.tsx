import { Section } from "@/components/Section";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import styles from "./sections.module.css";

const STEPS = [
  {
    n: "1",
    title: "Tell us which licenses you hold",
    body: "SNAP, the county health permit, tobacco, ABC, scales, business tax. You type them in once, with the numbers and the dates off the certificates.",
  },
  {
    n: "2",
    title: "We watch every renewal date",
    body: "Ledger tells you what is expiring, how long you have, and which one shuts the store if you miss it. No letter to lose, no date to remember.",
  },
  {
    n: "3",
    title: "Photograph a delivery invoice",
    body: "Ledger reads the lines, counts the sellable units and checks your shelves against the SNAP stocking rule. You get a pass or fail before an inspector gives you one.",
  },
];

/** The plain-English explainer. If a visitor reads one section, it is this one. */
export function WhatWeDo() {
  return (
    <Section ground="paper">
      <div className={styles.wwdHead}>
        <Reveal>
          <p className={`eyebrow ${styles.wwdEyebrow}`}>
            <Logo variant="mark" height={22} />
            What Ledger does
          </p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="display">
            A small store runs on a stack of licenses. Ledger keeps them from
            lapsing.
          </h2>
        </Reveal>
      </div>

      <div className={styles.wwdGrid}>
        {STEPS.map((s, i) => (
          <Reveal as="div" key={s.n} delay={0.05 + i * 0.05}>
            <div className={styles.wwdCard}>
              <span className={styles.wwdNum}>{s.n}</span>
              <h3 className={styles.wwdTitle}>{s.title}</h3>
              <p className={styles.wwdBody}>{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
