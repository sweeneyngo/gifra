import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { ReviewArticle } from "./ReviewArticle";

export const dynamic = "force-dynamic";

// Cached per-request so generateMetadata + the page share one DB round-trip.
const resolve = cache((slug: string) => getGameBySlug(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = await resolve(slug);
  if (!game) return { title: "Not found" };

  const title = game.review_title ?? game.title ?? "FVN";
  return {
    title,
    openGraph: {
      title,
      images: game.image_url ? [game.image_url] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: game.image_url ? [game.image_url] : [],
    },
  };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [game, admin] = await Promise.all([resolve(slug), isAdmin()]);
  if (!game) notFound();
  return <ReviewArticle game={game} admin={admin} />;
}
