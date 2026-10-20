"use client";
import Link from "next/link";
import { useState } from "react";
import { lotsAt } from "@/lib/portfolio";
import { addLot, usePortfolio } from "@/lib/portfolio-store";
import type { Product } from "@/lib/types";
import { LotForm } from "./lot-form";
import { Modal } from "./modal";
import { Money } from "./money";

// The "Add to portfolio" button on a product page.
export function AddToPortfolio({ product }: { product: Product }) {
  const portfolio = usePortfolio();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const owned = lotsAt(portfolio.events).filter(l => l.productId === product.id).reduce((sum, l) => sum + l.qty, 0);

  return (
    <>
      <button type="button" className="btn" onClick={() => { setAdded(false); setOpen(true); }}>
        {owned ? `In portfolio ×${owned} · add more` : "Add to portfolio"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={added ? "Added to your portfolio" : "Add to your portfolio"}>
        <p className="modal-product"><b>{product.name}</b><br /><span className="help">{product.set} · {product.language} · market price <Money usd={product.market} /></span></p>
        {added ? (
          <div className="actions">
            <Link href="/portfolio" className="btn primary" onClick={() => setOpen(false)}>View portfolio</Link>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Done</button>
          </div>
        ) : (
          <LotForm submitLabel="Add to portfolio" onSubmit={v => { addLot({ productId: product.id, ...v }); setAdded(true); }} onCancel={() => setOpen(false)} />
        )}
      </Modal>
    </>
  );
}
