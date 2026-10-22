"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CURRENCIES, coinFor, shortDate } from "@/lib/format";
import { CURRENCY_KEY, NAME_KEY, useStored, write } from "@/lib/store";
import { useIndex } from "@/lib/use-index";
import { BRAND } from "@/lib/brand";
import { Logo } from "./logo";
import { useCurrency } from "./money";

const NO_SEEN: string[] = [];

const LINKS = [
  ["/", "Home"],
  ["/products", "Products"],
  ["/sets", "Sets"],
  ["/wishlist", "Wishlist"],
  ["/portfolio", "Portfolio"],
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/") || (href === "/products" && path.startsWith("/product/"));
}

// One menu open at a time; Escape or a click outside closes it.
function useMenu() {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  return { open, setOpen, ref };
}

export function Nav() {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [path]);

  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Link href="/" className="logo" aria-label={`${BRAND} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className={`main-nav${mobileOpen ? " open" : ""}`}>
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <TopActions />
        <button type="button" className="icon-btn menu-btn" aria-expanded={mobileOpen} aria-label="Menu" onClick={() => setMobileOpen(o => !o)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={mobileOpen ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        </button>
      </div>
    </header>
  );
}

function TopActions() {
  const { open, setOpen, ref } = useMenu();
  const { code, rates } = useCurrency();
  const name = useStored<string>(NAME_KEY, "");
  const { data } = useIndex();

  // Notifications come straight from the data: upcoming and new sets, and the
  // latest price update. Each one links to a page that exists (every set in the
  // data has a page, even before its products are listed).
  const today = new Date().toISOString().slice(0, 10);
  const days = (iso: string) => Math.round((Date.parse(iso) - Date.parse(today)) / 86400000);
  const notes = !data ? [] : [
    ...data.sets.filter(s => s.released && s.released > today).sort((a, b) => a.released!.localeCompare(b.released!))
      .map(s => ({ id: `soon:${s.slug}`, href: `/sets/${s.slug}`, icon: "◆", title: `${s.name}${s.code ? ` (${s.code})` : ""} releases ${shortDate(s.released)}`,
        text: `Upcoming · in ${days(s.released!)} days · ${s.cards + s.sealed ? "products already listed" : "no products listed yet"}` })),
    ...data.sets.filter(s => s.released && s.released <= today && days(s.released) > -30)
      .map(s => ({ id: `new:${s.slug}`, href: `/sets/${s.slug}`, icon: "★", title: `New set: ${s.name}`, text: `Released ${shortDate(s.released)}` })),
    { id: `prices:${data.updated}`, href: "/products", icon: "●", title: "Prices updated", text: `${data.products.length.toLocaleString()} products · ${data.updated}` },
  ];
  const seen = useStored<string[]>("vendr.seenNotes", NO_SEEN);
  // A first visit has nothing "new" yet: everything that exists now counts as already seen,
  // so the badge only ever counts things that appeared since the visitor was last here.
  const firstVisit = seen === NO_SEEN;
  useEffect(() => { if (firstVisit && data) write("vendr.seenNotes", notes.map(n => n.id)); }, [firstVisit, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const unread = firstVisit ? 0 : notes.filter(n => !seen.includes(n.id)).length;

  return (
    <div className="top-actions" ref={ref}>
      <Link href="/products?focus=1" className="icon-btn" aria-label="Search products">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      </Link>
      <div className="menu">
        <button type="button" className="pill-btn" aria-haspopup="true" aria-expanded={open === "cur"} onClick={() => setOpen(open === "cur" ? null : "cur")}>
          <span className="coin">{coinFor(code)}</span><span className="cur-code">{code}</span><span className="sr-only">Change currency</span>
        </button>
        {open === "cur" && (
          <div className="dropdown currency-list" role="menu">
            {CURRENCIES.filter(([c]) => c === "USD" || rates[c]).map(([c, label]) => (
              <button key={c} type="button" role="menuitemradio" aria-checked={c === code} onClick={() => { write(CURRENCY_KEY, c); setOpen(null); }}>
                <span className="coin">{coinFor(c)}</span>{c}<small>{label}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="menu">
        <button type="button" className="icon-btn" aria-haspopup="true" aria-expanded={open === "bell"}
          aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
          onClick={() => { setOpen(open === "bell" ? null : "bell"); write("vendr.seenNotes", notes.map(n => n.id)); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        {open === "bell" && (
          <div className="dropdown wide" role="menu">
            <p className="menu-title">Notifications</p>
            {notes.length === 0 ? <p className="menu-help">Nothing new.</p> : notes.map(n => (
              <Link key={n.id} href={n.href} className="note-item" role="menuitem" onClick={() => setOpen(null)}>
                <span className="ico" aria-hidden="true">{n.icon}</span>
                <span><b>{n.title}</b><small>{n.text}</small></span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="menu">
        <button type="button" className="profile-btn" aria-haspopup="true" aria-expanded={open === "me"} onClick={() => setOpen(open === "me" ? null : "me")}>
          <span className="avatar" aria-hidden="true">{(name || "Guest")[0].toUpperCase()}</span><span className="pname-nav">{name || "Guest"}</span>
        </button>
        {open === "me" && (
          <div className="dropdown" role="menu">
            <p className="menu-title">{name ? `Hi, ${name}` : "Guest"}</p>
            <p className="menu-help">Not signed in. Your wishlist is saved on this device; Google sign-in will sync it.</p>
            <label className="field">Your name
              <input type="text" maxLength={30} value={name} placeholder="Guest" onChange={e => write(NAME_KEY, e.target.value)} />
            </label>
            <Link href="/account" className="btn wide" onClick={() => setOpen(null)}>Account</Link>
          </div>
        )}
      </div>
    </div>
  );
}
