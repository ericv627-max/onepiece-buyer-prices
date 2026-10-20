"use client";
import { useEffect, useRef } from "react";

// A dialog built on the browser's own <dialog>: it traps focus, closes on Esc,
// and the page behind can't be reached until it's closed.
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control (the close button); move to the one meant to be first.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " wide" : ""}`}
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="modal-body">
          <div className="modal-head">
            <h2 id="modal-title">{title}</h2>
            <button type="button" className="close" aria-label="Close" onClick={onClose}>×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
