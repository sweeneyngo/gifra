import { listGames } from "@/lib/db";
import { CoverArt } from "../CoverArt";
import { GamesView } from "./GamesView";

export const dynamic = "force-dynamic";

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
        </div>
      </header>

      <div className="hline" />

      <GamesView games={games} />

      <div className="hline" />
    </div>
  );
}
