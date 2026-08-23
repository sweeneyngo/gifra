import { getProjectBySlug, renderProjectPng, type RenderView } from "@/lib/wplace";

const VIEWS: RenderView[] = ["live", "template", "diff"];

// PNG render of a tracked drawing, upscaled so each canvas pixel is a block.
// `?view=live|template|diff` (default live). "live"/"diff" hit the wplace
// backend, so cache briefly to stay polite and keep the dashboard snappy.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const raw = new URL(req.url).searchParams.get("view");
  const view: RenderView = VIEWS.includes(raw as RenderView)
    ? (raw as RenderView)
    : "live";

  const project = await getProjectBySlug(slug);
  if (!project) return new Response("Not found", { status: 404 });

  const png = await renderProjectPng(project, view);
  if (!png) return new Response("No template", { status: 404 });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": view === "template" ? "public, max-age=3600" : "public, max-age=60",
    },
  });
}
