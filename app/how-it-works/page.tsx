import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Section } from "@/components/Section";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Reveal } from "@/components/Reveal";
import { CtaBand } from "@/components/sections/CtaBand";
import { COVERAGE, NON_AFFILIATION } from "@/lib/site-content";
import styles from "./how.module.css";

export const metadata: Metadata = {
  title: "How compliance works with Ledger",
  description:
    "What Ledger covers, how often each thing is checked, what happens after a scan report, and the parts that stay with the store owner.",
};

const CADENCE: {
  when: string;
  what: string;
  cost: string;
  who: "ledger" | "you";
}[] = [
  {
    when: "Day one",
    what: "Enter the licenses you hold: programme, reference number, issue date, renewal date. Photograph each certificate so the details are on file rather than in a drawer.",
    cost: "About 10 minutes",
    who: "you",
  },
  {
    when: "Day one, after that",
    what: "Ledger works out which rules apply to your kind of store, builds the renewal calendar and sets the reminder dates.",
    cost: "Immediate",
    who: "ledger",
  },
  {
    when: "Every delivery",
    what: "Photograph the invoice at the back door. The scan counts sellable units by category and re-checks the stocking position against the SNAP minimums.",
    cost: "About 30 seconds",
    who: "you",
  },
  {
    when: "Every Monday",
    what: "A digest of what is due in the next 30 days, what moved since last week, and anything the last scan left short.",
    cost: "Arrives 6am",
    who: "ledger",
  },
  {
    when: "90, 30 and 7 days out",
    what: "Renewal reminders for each license, with the filing office, the fee and what the form asks for. The 7-day one repeats daily until you mark it filed.",
    cost: "Automatic",
    who: "ledger",
  },
  {
    when: "At each renewal",
    what: "You file with the agency and pay the fee. Mark it filed in Ledger and upload the new certificate; the calendar rolls forward to the next date.",
    cost: "Varies by agency",
    who: "you",
  },
  {
    when: "Quarterly",
    what: "Ledger re-reads the published requirements for every programme you hold and flags any threshold, fee or form that changed.",
    cost: "Automatic",
    who: "ledger",
  },
  {
    when: "Before an inspection",
    what: "Pull the current position for any programme: dates, certificates, the last scans and what was counted.",
    cost: "One click",
    who: "ledger",
  },
];

const AFTER = [
  {
    title: "You get a ranked fix list",
    body: "The item that can close the store comes first, then the rest in the order they bite. Each line names a specific product, a pack size and how many to stock.",
  },
  {
    title: "You buy the items on your next order",
    body: "The suggestions are chosen to be cheap, shelf-stable where possible and available from the distributors a corner store already uses. A fix that needs new fridge space is a fix that does not happen.",
  },
  {
    title: "You re-scan and it confirms",
    body: "Photograph the next invoice. If the new items landed, the category flips to clearing and the fix drops off the list. If they did not, it stays there.",
  },
  {
    title: "The record stays on file",
    body: "Every scan is kept with its date, what was counted and what was held back. When an inspector asks what your stocking looked like in March, the answer is a screen rather than a shoebox.",
  },
];

const YOURS = [
  "Filing the renewal with the agency and paying the fee.",
  "Keeping the shelves stocked to the minimums we report.",
  "Posting the notices and licenses the programmes require.",
  "Keeping invoices and receipts for the period each programme asks for.",
  "Answering the inspector. We give you the position; you give the answer.",
];

const NOT_OURS = [
  "We do not file anything with any agency on your behalf.",
  "We do not decide whether you are authorized. Only the agency does that.",
  "We are not a law firm and this is not legal advice.",
  "We do not sell your scan data or share it with any agency.",
];

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHeader
          eyebrow="How it works"
          title="What we do, what you do, and when."
          intro="Compliance is a calendar. Renewal dates, a stocking position that moves with every delivery, and conditions that keep applying after the license is granted. Here is how the work splits between us."
        />

        <Section ground="tint">
          <div className={styles.lead}>
            <Reveal>
              <h2 className="display">The scope</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="body-l" style={{ color: "var(--mute)" }}>
                Eighteen programmes across three levels of government. You tell
                Ledger which ones you hold; it tracks those and leaves the rest
                alone.
              </p>
            </Reveal>
          </div>

          <div className={styles.scopeGrid}>
            {COVERAGE.map((col) => (
              <Reveal as="div" key={col.level} delay={0.05}>
                <div className={styles.scopeCard}>
                  <div className={styles.scopeLevel}>{col.level}</div>
                  <div className={`${styles.scopeCount} tnum`}>
                    {col.programs.length}
                  </div>
                  <div className={styles.scopeBadges}>
                    {col.programs.map((p) => (
                      <Badge key={p.abbr} abbr={p.abbr} size={38} />
                    ))}
                  </div>
                  <p className={styles.scopeBody}>
                    {col.programs.map((p) => p.abbr).join(", ")}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section ground="paper">
          <div className={styles.lead}>
            <Reveal>
              <h2 className="display">How often each thing happens</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="body-l" style={{ color: "var(--mute)" }}>
                Three of these are yours. The rest is ours and runs whether or
                not you open the app.
              </p>
            </Reveal>
          </div>

          <div className={styles.cadenceWrap}>
            <table className={styles.cadence}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>What happens</th>
                  <th>Time</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {CADENCE.map((row) => (
                  <tr key={row.when + row.what.slice(0, 12)}>
                    <td className={styles.when}>{row.when}</td>
                    <td>{row.what}</td>
                    <td className={styles.minutes}>{row.cost}</td>
                    <td className={styles.who}>
                      <span className={styles.whoTag} data-who={row.who}>
                        {row.who === "ledger" ? "Ledger" : "You"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section ground="tint">
          <div className={styles.lead}>
            <Reveal>
              <h2 className="display">After the report</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="body-l" style={{ color: "var(--mute)" }}>
                A scorecard that tells you that you failed is worth nothing on
                its own. The report starts a four-step loop that ends with the
                category clearing.
              </p>
            </Reveal>
          </div>

          <div className={styles.afterList}>
            {AFTER.map((step, i) => (
              <Reveal as="div" key={step.title} delay={i * 0.05}>
                <div className={styles.afterCard}>
                  <span className={styles.afterNum}>{i + 1}</span>
                  <h3 className={styles.afterTitle}>{step.title}</h3>
                  <p className={styles.afterBody}>{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section ground="paper">
          <div className={styles.lead}>
            <Reveal>
              <h2 className="display">Where the line is</h2>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="body-l" style={{ color: "var(--mute)" }}>
                Ledger tells you where you stand and what is due. Some of the work
                can only be done by the person who owns the store.
              </p>
            </Reveal>
          </div>

          <div className={styles.splitCols}>
            <Reveal as="div">
              <div>
                <h3 className={styles.colTitle}>Yours to do</h3>
                <p className={styles.colNote}>
                  Five things. Ledger flags the dates; the doing is yours.
                </p>
                <ul className={styles.plainList}>
                  {YOURS.map((item) => (
                    <li key={item}>
                      <svg className={styles.tick} viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" fill="#1c7a4b" opacity="0.12" />
                        <path
                          d="m6 10.2 2.6 2.6L14 7.4"
                          fill="none"
                          stroke="#1c7a4b"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal as="div" delay={0.05}>
              <div>
                <h3 className={styles.colTitle}>Not ours to do</h3>
                <p className={styles.colNote}>
                  Anyone who tells you otherwise is selling you something.
                </p>
                <ul className={styles.plainList}>
                  {NOT_OURS.map((item) => (
                    <li key={item}>
                      <svg className={styles.cross} viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="9" fill="#d13a2c" opacity="0.12" />
                        <path
                          d="M7 7l6 6M13 7l-6 6"
                          fill="none"
                          stroke="#d13a2c"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <p
            className="small mute"
            style={{ maxWidth: 720, margin: "48px auto 0", textAlign: "center" }}
          >
            {NON_AFFILIATION}
          </p>
        </Section>

        <CtaBand title="Start with the licenses you already hold." />
      </main>
      <Footer />
    </>
  );
}
