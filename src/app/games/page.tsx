import type { Metadata } from "next";
import { listGames } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import { GamesView } from "./GamesView";
import { FvnAbout } from "./FvnAbout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "FVNs" };

const PAGE_TITLE = "FVNs";
const OWNER_HANDLE = "ifuxyl";

export default async function Games() {
  const games = await listGames();

  return (
    <div className="wrap">
      <div className="hline" />

      {/* Banner image lives at public/banner2.jpg */}
      <header className="banner">
        <CoverArt src="/banner2.jpg" alt="" objectPosition="center 12%" phSize="64px" />
        <div className="banner-inner">
          <div className="banner-title">
            <span className="eyebrow">{OWNER_HANDLE}</span>
            <h1>{PAGE_TITLE}</h1>
          </div>
          <FvnAbout />
        </div>
      </header>

      <div className="hline" />

      <GamesView games={games} />

      <footer className="footer">
        <div className="footer-row">
          <span className="footer-label">Credits</span>
          <span>
            Banner art by{" "}
            <a href="https://x.com/nomifuki" target="_blank" rel="noreferrer">
              @nomifuki
            </a>
          </span>
        </div>
      </footer>

      <div className="hline" />
    </div>
  );
}
