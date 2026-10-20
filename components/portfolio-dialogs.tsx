"use client";
import { useEffect, useMemo, useState } from "react";
import { lotsAt, type Lot } from "@/lib/portfolio";
import { addLot, editLot, removeLot, usePortfolio } from "@/lib/portfolio-store";
import { matches, words } from "@/lib/search";
import { shortDate } from "@/lib/format";
import type { Product } from "@/lib/types";
import { LotForm } from "./lot-form";
import { Modal } from "./modal";
import { Money, useCurrency } from "./money";
import { ProductImage } from "./product-image";

// ---------- Add a product from the portfolio page ----------
export function AddProductDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const w = words(q);
  const found = useMemo(
    () => (w.length ? products.filter(p => matches(p, w)).sort((a, b) => (b.market ?? -1) - (a.market ?? -1)).slice(0, 8) : []),
    [products, q], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function close() { setQ(""); setPicked(null); setJustAdded(null); onClose(); }

  return (
    <Modal open={open} onClose={close} title={picked ? "How many do you own?" : "Add to your portfolio"}>
      {justAdded && <p className="notice" role="status">Added {justAdded}. You can add another below.</p>}
      {picked ? (
        <>
          <p className="modal-product"><b>{picked.name}</b><br /><span className="help">{picked.set} · {picked.language} · {picked.type} · market price <Money usd={picked.market} /></span></p>
          <LotForm
            submitLabel="Add to portfolio"
            onSubmit={v => { addLot({ productId: picked.id, ...v }); setJustAdded(`${v.qty} × ${picked.name}`); setPicked(null); setQ(""); }}
            onCancel={() => setPicked(null)}
          />
        </>
      ) : (
        <>
          <label className="field">Find a card or sealed product
            <input type="search" autoFocus data-autofocus autoComplete="off" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, card number (OP01-001), or set" />
          </label>
          {!w.length ? <p className="help">Type at least 2 letters.</p> : found.length === 0 ? <p className="help">Nothing matches that. Check the spelling.</p> : (
            <ul className="pick-list">
              {found.map(p => (
                <li key={p.id}>
                  <button type="button" onClick={() => setPicked(p)}>
                    <span className="thumb"><ProductImage src={p.image} /></span>
                    <span className="pick-text"><b>{p.name}</b><small>{p.set} · {p.language} · {p.type}</small></span>
                    <span className="pick-price"><Money usd={p.market} /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="actions"><button type="button" className="btn" onClick={close}>Done</button></div>
        </>
      )}
    </Modal>
  );
}

// ---------- Change or remove the copies you own of one product ----------
export function ManageHoldingDialog({ productId, product, onClose }: { productId: string | null; product: Product | null; onClose: () => void }) {
  const portfolio = usePortfolio();
  const [adding, setAdding] = useState(false);
  const lots = productId ? lotsAt(portfolio.events).filter(l => l.productId === productId) : [];

  // When the last copy is removed there's nothing left to manage.
  useEffect(() => {
    if (productId && lots.length === 0) onClose();
  }, [productId, lots.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open={productId !== null} onClose={() => { setAdding(false); onClose(); }} title={product ? product.name : "Manage holding"} wide>
      {product && <p className="help">{product.set} · {product.language} · {product.type} · market price <Money usd={product.market} /></p>}
      <ul className="lot-list">
        {lots.map(lot => <LotRow key={lot.id} lot={lot} />)}
      </ul>
      {adding ? (
        <div className="lot-add">
          <h3>Add another purchase</h3>
          <LotForm submitLabel="Add" onSubmit={v => { if (productId) addLot({ productId, ...v }); setAdding(false); }} onCancel={() => setAdding(false)} />
        </div>
      ) : (
        <div className="actions"><button type="button" className="btn" onClick={() => setAdding(true)}>Add another purchase</button></div>
      )}
    </Modal>
  );
}

function LotRow({ lot }: { lot: Lot }) {
  const { format } = useCurrency();
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");

  if (mode === "edit") {
    return (
      <li className="lot editing">
        <LotForm
          initial={{ qty: lot.qty, unitCost: lot.unitCost, acquired: lot.acquired }}
          submitLabel="Save changes"
          onSubmit={v => { editLot({ ...lot, ...v }); setMode("view"); }}
          onCancel={() => setMode("view")}
        />
      </li>
    );
  }
  return (
    <li className="lot">
      <div>
        <b>×{lot.qty}</b>
        <span className="help"> · {lot.unitCost === null ? "price paid not entered" : `paid ${format(lot.unitCost)} each`} · got {shortDate(lot.acquired)}</span>
      </div>
      {mode === "confirm" ? (
        <div className="confirm" role="group" aria-label="Confirm removal">
          <span>Remove these {lot.qty} {lot.qty === 1 ? "copy" : "copies"}?</span>
          <button type="button" className="btn danger" onClick={() => removeLot(lot.id)}>Yes, remove</button>
          <button type="button" className="btn" onClick={() => setMode("view")}>Keep</button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn small" onClick={() => setMode("edit")}>Edit</button>
          <button type="button" className="btn small" onClick={() => setMode("confirm")}>Remove</button>
        </div>
      )}
    </li>
  );
}
