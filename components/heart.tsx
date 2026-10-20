"use client";
import { toggleWishlist, useWishlist } from "@/lib/store";

export function Heart({ id, name, size = "md" }: { id: string; name: string; size?: "md" | "lg" }) {
  const list = useWishlist();
  const on = list.includes(id);
  return (
    <button
      type="button"
      className={`heart ${size}${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      title={on ? "In your wishlist" : "Add to wishlist"}
      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(id); }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
      {size === "lg" && <span>{on ? "In wishlist" : "Add to wishlist"}</span>}
    </button>
  );
}
