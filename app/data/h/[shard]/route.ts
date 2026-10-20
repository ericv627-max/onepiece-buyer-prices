// Built into 64 files, /data/h/00.json ... 63.json: the saved price history of
// every product whose id falls in that slice.
import { getHistoryShard } from "@/lib/data";
import { SHARDS, shardName } from "@/lib/history";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: SHARDS }, (_, i) => ({ shard: shardName(i) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ shard: string }> }) {
  const { shard } = await params;
  return Response.json(getHistoryShard(parseInt(shard, 10)));
}
