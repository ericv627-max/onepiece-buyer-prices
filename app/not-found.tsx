import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="state empty panel">
      <h1>Not found</h1>
      <p>That page or product isn’t in {BRAND}. It may not be listed on TCGplayer yet, or the link is wrong.</p>
      <div className="actions"><Link href="/products?focus=1" className="btn primary">Search products</Link><Link href="/sets" className="btn">Browse sets</Link></div>
    </div>
  );
}
