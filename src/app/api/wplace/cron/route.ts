import { listProjects, takeSnapshot } from "@/lib/wplace";

// Polls the live wplace canvas for every tracked project and records one
// progress snapshot each. Wired to a Vercel cron (see vercel.json); Vercel
// sends `Authorization: Bearer $CRON_SECRET`, which we require so the endpoint
// can't be triggered by anyone. If CRON_SECRET is unset the route stays locked.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET not set", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });

  const projects = await listProjects();
  const results = [];
  for (const p of projects) {
    // One slow/failed project shouldn't sink the others' snapshots.
    try {
      const diff = await takeSnapshot(p);
      results.push({ slug: p.slug, percent: diff ? Math.round(diff.percent * 10) / 10 : null });
    } catch (err) {
      results.push({ slug: p.slug, error: String(err) });
    }
  }
  return Response.json({ ok: true, count: results.length, results });
}
