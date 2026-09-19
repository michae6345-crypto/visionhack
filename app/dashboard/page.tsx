import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Section } from "@/components/Section";
import { PageHeader } from "@/components/PageHeader";
import { StoreDashboard } from "@/components/dashboard/StoreDashboard";
import { CtaBand } from "@/components/sections/CtaBand";
import { NON_AFFILIATION } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "The dashboard",
  description:
    "Every license a store holds on one screen: renewal dates, what is due this week, " +
    "and a wholesale order-record scan that feeds the SNAP stocking standard into the same score.",
};

export default function DashboardPage() {
  return (
    <>
      <Nav />
      <main>
        <PageHeader
          eyebrow="The dashboard"
          title="Eight licenses on one screen."
          intro="What a store owner sees after signing in: what is due, how long they have, and where the last order-record scan left them. Everything here is live, so edit a date or run a scan and the score moves."
        />
        <Section ground="tint">
          <StoreDashboard />
          <p
            className="small mute"
            style={{ maxWidth: 720, margin: "34px auto 0", textAlign: "center" }}
          >
            Your entries stay in this browser. {NON_AFFILIATION}
          </p>
        </Section>
        <CtaBand title="Put your licenses on this screen." />
      </main>
      <Footer />
    </>
  );
}
