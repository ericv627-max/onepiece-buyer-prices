// Built once into /data/index.json: everything the browser needs to search.
import { getMeta, getProducts, getSets } from "@/lib/data";
import type { IndexData } from "@/lib/types";

export const dynamic = "force-static";

export function GET() {
  const body: IndexData = { ...getMeta(), products: getProducts(), sets: getSets() };
  return Response.json(body);
}
