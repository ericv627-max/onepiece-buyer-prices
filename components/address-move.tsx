"use client";
import { useEffect } from "react";
import { applyMove, collect, moveUrl, OLD_HOST, readMove } from "@/lib/address-move";

// On the old address: forward to the same page on the new one, carrying saved data along.
// On the new address: unpack data that arrived that way, then reload once so every store sees it.
export function AddressMove() {
  useEffect(() => {
    try {
      if (location.hostname === OLD_HOST) {
        location.replace(moveUrl(location.pathname + location.search, collect(localStorage)));
        return;
      }
      const moved = readMove(location.hash);
      if (!moved) return;
      const written = applyMove(localStorage, moved);
      history.replaceState(null, "", location.pathname + location.search);
      if (written > 0) location.reload();
    } catch { /* storage blocked: nothing to move */ }
  }, []);
  return null;
}
