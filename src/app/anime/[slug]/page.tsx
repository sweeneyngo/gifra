import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnimeGroupBySlug, listAnimeGroupOptions } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { scoreColor } from "../marks";
import { GroupDetail } from "../GroupDetail";

export const dynamic = "force-dynamic";

// Cached per-request so generateMetadata + the page share one DB round-trip.
const resolve = cache((slug: string) => getAnimeGroupBySlug(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await resolve(slug);
  return { title: data ? data.group.name : "Not found" };
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, groupOptions, admin] = await Promise.all([
    resolve(slug),
    listAnimeGroupOptions(),
    isAdmin(),
  ]);
  if (!data) notFound();
  const { group, members } = data;

  return (
    <div className="wrap">
      <div className="hline" />

      <header className="page-head">
        <Link href="/anime" className="eyebrow back-link">
          ← Anime
        </Link>
        <div className="group-head">
          <h1>{group.name}</h1>
          {group.score != null && (
            <span className="group-head-score" style={{ color: scoreColor(group.score) }}>
              {group.score}
              <span className="score-max">/10</span>
            </span>
          )}
        </div>
      </header>

      <div className="hline" />

      <GroupDetail
        groupId={group.id}
        coverAnimeId={group.cover_anime_id}
        members={members}
        groups={groupOptions}
        admin={admin}
      />

      <footer className="footer">
        <div className="footer-row">
          <span className="footer-label">Data</span>
          <span>
            Covers &amp; metadata from{" "}
            <a href="https://anilist.co" target="_blank" rel="noreferrer">
              AniList
            </a>
          </span>
        </div>
      </footer>

      <div className="hline" />
    </div>
  );
}
