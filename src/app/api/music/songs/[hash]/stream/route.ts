import { getAudioKey } from "@/lib/music";
import { presign } from "@/lib/r2";

// Stable audio URL: <audio src="/api/music/songs/{hash}/stream"> → 302 to a
// short-lived presigned R2 URL. The browser streams bytes straight from R2.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;

  const key = await getAudioKey(hash);
  if (!key) return new Response("Not found", { status: 404 });

  const url = await presign(key, 6 * 3600);
  if (!url) return new Response("Streaming not configured", { status: 503 });

  return Response.redirect(url, 302);
}
