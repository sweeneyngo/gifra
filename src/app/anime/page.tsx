import type { Metadata } from "next";
import {
  listUngroupedAnime,
  listAnimeGroupCards,
  listAnimeGroupOptions,
  buildAnimeGrid,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { AnimeView } from "./AnimeView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anime" };

const PAGE_TITLE = "Anime";
const OWNER_HANDLE = "ifuxyl";

export default async function Anime() {
  const [anime, groupCards, groupOptions, admin] = await Promise.all([
    listUngroupedAnime(),
    listAnimeGroupCards(),
    listAnimeGroupOptions(),
    isAdmin(),
  ]);
  const entries = buildAnimeGrid(anime, groupCards);

  return (
    <div className="wrap">
      <div className="hline" />

      <header className="page-head">
        <span className="eyebrow">{OWNER_HANDLE}</span>
        <h1>{PAGE_TITLE}</h1>
      </header>

      <div className="hline" />

      <AnimeView entries={entries} groups={groupOptions} admin={admin} />

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
