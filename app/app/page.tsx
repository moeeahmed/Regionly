import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getRegion } from "@/lib/regions";

type AdCard = { id: string; name: string; thumbnail_url: string | null; duration_sec: number; aspect_ratio: string; total: number; done: number; active: number; markets: string[] | null };

export default async function Dashboard() {
  const ctx = await requireCtx();
  const q = await db();
  const ads = (await q`
    SELECT a.id, a.name, a.thumbnail_url, a.duration_sec, a.aspect_ratio,
      COUNT(j.id)::int AS total,
      COUNT(j.id) FILTER (WHERE j.status = 'completed')::int AS done,
      COUNT(j.id) FILTER (WHERE j.status IN ('queued','running'))::int AS active,
      ARRAY_AGG(DISTINCT j.region_code) FILTER (WHERE j.id IS NOT NULL) AS markets
    FROM ads a LEFT JOIN jobs j ON j.ad_id = a.id
    WHERE a.workspace_id = ${ctx.workspace.id}
    GROUP BY a.id ORDER BY a.created_at DESC`) as AdCard[];
  const anyActive = ads.some((a) => a.active > 0);

  return (
    <>
      <AutoRefresh active={anyActive} ms={10000} />
      <div className="page-head">
        <div>
          <h1>Ads</h1>
          <p className="sub">{ctx.workspace.name}</p>
        </div>
        {ads.length > 0 && <Link href="/app/ads/new" className="btn primary">Upload an ad</Link>}
      </div>

      {ads.length === 0 ? (
        <div className="panel empty">
          <h2>Start with the ad that already works.</h2>
          <p className="muted" style={{ maxWidth: 56 + "ch" }}>
            Upload the ad with your best ROAS or hook rate. It&apos;s transcribed in about a minute, then you choose the markets to localise it for.
          </p>
          <Link href="/app/ads/new" className="btn primary">Upload an ad</Link>
        </div>
      ) : (
        <div className="ad-grid">
          {ads.map((a) => {
            const markets = a.markets ?? [];
            return (
              <Link key={a.id} href={`/app/ads/${a.id}`} className="ad-card">
                <div className="ad-thumb" style={{ backgroundImage: a.thumbnail_url ? `url(${a.thumbnail_url})` : undefined }}>
                  <span className="dur">{Math.round(a.duration_sec)}s, {a.aspect_ratio}</span>
                </div>
                <div className="ad-meta">
                  <div className="name">{a.name}</div>
                  {a.total === 0 ? (
                    <div className="faint">Not localised yet</div>
                  ) : (
                    <>
                      <div className="faint">
                        {a.done} of {a.total} ready{a.active > 0 ? `, ${a.active} in progress` : ""}
                      </div>
                      <div className="markets">
                        {markets.slice(0, 5).map((m) => <span key={m} className="loc light">{getRegion(m)?.locale ?? m}</span>)}
                        {markets.length > 5 && <span className="faint">+{markets.length - 5}</span>}
                      </div>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
