import {
  getProjectBySlug,
  getTemplatePng,
  renderProjectPng,
  type RenderView,
} from "@/lib/wplace";

const VIEWS: RenderView[] = ["live", "template", "diff"];

// PNG render of a tracked drawing, upscaled so each canvas pixel is a block.
// `?view=live|template|diff` (default live). "live"/"diff" hit the wplace
// backend, so cache briefly to stay polite and keep the dashboard snappy.
// `?download=1` streams the original 1:1 template PNG as a file attachment.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const search = new URL(req.url).searchParams;
  const raw = search.get("view");
  const view: RenderView = VIEWS.includes(raw as RenderView)
    ? (raw as RenderView)
    : "live";

  const project = await getProjectBySlug(slug);
  if (!project) return new Response("Not found", { status: 404 });

  // Download = the source template exactly as stored (one canvas pixel = one
  // image pixel), so it can be re-pinned or re-imported without rescaling.
  if (search.get("download")) {
    const original = await getTemplatePng(project.id);
    if (!original) return new Response("No template", { status: 404 });
    return new Response(new Uint8Array(original), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${slug}.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const png = await renderProjectPng(project, view);
  if (!png) return new Response("No template", { status: 404 });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": view === "template" ? "public, max-age=3600" : "public, max-age=60",
    },
  });
}
