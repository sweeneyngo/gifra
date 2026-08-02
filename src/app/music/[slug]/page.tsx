import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listSongs } from "@/lib/music";
import { groupSongs, slugify } from "../lib";
import { SongDetail } from "./SongDetail";

export const dynamic = "force-dynamic";

// Cached per-request so generateMetadata + the page share one DB round-trip.
const resolve = cache(async (slug: string) => {
  const songs = await listSongs();
  const groups = groupSongs(songs);
  const group = groups.find(
    (g) => slugify(g.latest.title) === slug || g.key === slug,
  );
  return { songs, group };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { group } = await resolve(slug);
  if (!group) return { title: "Not found — gifra" };

  const s = group.latest;
  const img = `/api/music/songs/${s.hashId}/art`;
  const desc = (s.description ?? `${s.title} — ${s.singers.join(", ")}`).slice(
    0,
    160,
  );
  return {
    title: `${s.title} — gifra`,
    description: desc,
    openGraph: {
      title: s.title,
      description: s.singers.join(", "),
      images: [img],
      type: "music.song",
    },
    twitter: { card: "summary_large_image", title: s.title, images: [img] },
  };
}

export default async function SongPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { songs, group } = await resolve(slug);
  if (!group) notFound();
  return <SongDetail group={group} songs={songs} />;
}
