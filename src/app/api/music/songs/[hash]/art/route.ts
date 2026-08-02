import { getArtKey } from "@/lib/music";
import { presign } from "@/lib/r2";

// Stable cover-art URL → 302 to a fresh presigned R2 URL. Used for Open Graph
// images (which must stay valid) and anywhere a durable art link is handy.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const key = await getArtKey(hash);
  if (!key) return new Response("Not found", { status: 404 });
  const url = await presign(key, 6 * 3600);
  if (!url) return new Response("Art not configured", { status: 503 });
  return Response.redirect(url, 302);
}
