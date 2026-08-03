import { redirect, notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { ReviewEditor } from "./ReviewEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit review" };

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { slug } = await params;
  const game = await getGameBySlug(slug);
  if (!game || !game.slug) notFound();

  return (
    <ReviewEditor
      id={game.id}
      slug={game.slug}
      gameTitle={game.title}
      reviewTitle={game.review_title}
      md={game.review_md ?? ""}
    />
  );
}
