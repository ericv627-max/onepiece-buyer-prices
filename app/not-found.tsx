import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state empty panel">
      <h1>Not found</h1>
      <p>That page or product isn’t in VENDR. It may not be listed on TCGplayer yet, or the link is wrong.</p>
      <div className="actions"><Link href="/" className="btn primary">Search VENDR</Link><Link href="/sets" className="btn">Browse sets</Link></div>
    </div>
  );
}
