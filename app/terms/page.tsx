import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { NON_AFFILIATION } from "@/lib/site-content";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms of use for Ledger.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHeader eyebrow="Legal" title="Terms of use." />
        <Section ground="paper">
          <div className={styles.prose}>
            <p className={styles.updated}>Last updated 12 September 2026</p>

            <h2>What Ledger is</h2>
            <p>
              Ledger is a tracking tool. It tells you where your store stands against
              published programme requirements so you can act before something lapses.
              It is a private aid, not an official record.
            </p>

            <h2>No affiliation, no authorization</h2>
            <p>
              <strong>{NON_AFFILIATION}</strong> A passing scorecard does not grant,
              renew or guarantee any license, permit or authorization. Those decisions
              belong to the relevant authority alone.
            </p>

            <h2>Accuracy</h2>
            <p>
              Ledger is built to undercount: it reads only what it can read and holds
              back anything ambiguous. You remain responsible for confirming your own
              compliance and for the accuracy of the details you enter.
            </p>

            <h2>Contact</h2>
            <p>Questions about these terms: legal@ledger.co</p>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
