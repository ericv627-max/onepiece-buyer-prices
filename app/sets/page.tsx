import type { Metadata } from "next";
import { getSets } from "@/lib/data";
import { SetsList } from "@/components/sets-list";

export const metadata: Metadata = { title: "Sets" };

export default function SetsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Sets</h1>
        <p>Every One Piece Card Game release TCGplayer lists, with release dates.</p>
      </header>
      <SetsList sets={getSets()} />
    </>
  );
}
