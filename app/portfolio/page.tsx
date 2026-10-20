import type { Metadata } from "next";
import { Suspense } from "react";
import { PortfolioView } from "@/components/portfolio-view";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <Suspense fallback={<div className="state" aria-busy="true">Loading your portfolio…</div>}>
      <PortfolioView />
    </Suspense>
  );
}
