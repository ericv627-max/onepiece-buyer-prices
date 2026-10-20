"use client";
import { useState } from "react";
import { validateLot } from "@/lib/portfolio";
import { localToday } from "@/lib/portfolio-store";

export type LotValues = { qty: number; unitCost: number | null; acquired: string };

// Quantity, price paid and date for one purchase (one lot).
export function LotForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial?: LotValues;
  submitLabel: string;
  onSubmit: (values: LotValues) => void;
  onCancel?: () => void;
}) {
  const [qty, setQty] = useState(String(initial?.qty ?? 1));
  const [cost, setCost] = useState(initial?.unitCost == null ? "" : String(initial.unitCost));
  const [acquired, setAcquired] = useState(initial?.acquired ?? localToday());
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="lot-form"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        const result = validateLot({ qty, unitCost: cost, acquired }, localToday());
        if (!result.ok) return setError(result.error);
        setError(null);
        onSubmit({ qty: result.qty, unitCost: result.unitCost, acquired: result.acquired });
      }}
    >
      <label className="field">Quantity
        <input type="number" min={1} step={1} inputMode="numeric" value={qty} autoFocus data-autofocus onFocus={e => e.currentTarget.select()} onChange={e => setQty(e.target.value)} />
      </label>
      <label className="field">Price paid per copy (US dollars, optional)
        <input type="number" min={0} step="0.01" inputMode="decimal" value={cost} placeholder="Leave empty if unknown" onChange={e => setCost(e.target.value)} />
      </label>
      <label className="field">Date you got it
        <input type="date" max={localToday()} value={acquired} onChange={e => setAcquired(e.target.value)} />
      </label>
      <p className="help">Gain or loss is only worked out for copies where you’ve entered what you paid.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="btn primary">{submitLabel}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
