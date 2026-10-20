import type { Metadata } from "next";
import { WishlistView } from "@/components/wishlist-view";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return (
    <>
      <header className="page-head">
        <h1>Wishlist</h1>
        <p>Cards and sealed products you’ve saved with the ♡. Saved on this device until Google sign-in syncs it.</p>
      </header>
      <WishlistView />
    </>
  );
}
