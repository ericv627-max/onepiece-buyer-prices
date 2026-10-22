"use client";
import { useEffect, useRef, useState } from "react";
import { monthDay } from "@/lib/format";

// TCGplayer's picture server doesn't have every size, and has nothing at all
// for products it hasn't finished listing. If the larger picture is missing,
// try the standard one; if that fails too, show a plain placeholder instead of
// a broken-image icon.
// drops: the release date of a set that hasn't come out yet. Its products usually have no picture yet, so instead of
// "No image" they get a tile that says the set is awaiting its drop and when.
export function ProductImage({ src, alt = "", className, drops }: { src: string; alt?: string; className?: string; drops?: string | null }) {
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  function fail() {
    if (url.includes("_400w")) setUrl(url.replace("_400w", "_200w"));
    else setFailed(true);
  }

  // A picture in the page's first HTML can fail before React is listening for
  // errors, so also look once on arrival: finished loading, but no pixels.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!src || failed) {
    return drops
      ? <span className="awaiting"><b>Awaiting drop</b><small>{monthDay(drops)}</small></span>
      : <span className="noimg">No image</span>;
  }
  return <img ref={ref} src={url} alt={alt} className={className} loading="lazy" onError={fail} />;
}
