import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { Coverage } from "@/components/sections/Coverage";
import { Industries } from "@/components/sections/Industries";
import { CtaBand } from "@/components/sections/CtaBand";

export const metadata: Metadata = {
  title: "Coverage: eighteen programmes on one calendar",
  description:
    "The federal, state and local programmes Ledger tracks for a small retailer, and which trades carry which of them.",
};

export default function CoveragePage() {
  return (
    <>
      <Nav />
      <main>
        <PageHeader
          eyebrow="Coverage"
          title="Every programme we track."
          intro="Federal, state and local. Each one renews on its own schedule and answers to its own inspector."
        />
        <Coverage
          ground="paper"
          intro="Which of these apply depends on what you sell. Ledger holds the ones that do, with their renewal dates and the conditions that keep applying after the license is granted."
        />
        <Industries />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}
