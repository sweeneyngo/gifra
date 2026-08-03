import Link from "next/link";
import type { GameWithReview } from "@/lib/db";
import { CoverArt } from "../../CoverArt";
import {
  scoreColor,
  STATUS_LABEL,
  PlatformIcons,
  parsePlatforms,
} from "../marks";
import { readingTime } from "@/lib/reading";
import { MarkdownView } from "./MarkdownView";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function ReviewArticle({
  game,
  admin,
}: {
  game: GameWithReview;
  admin: boolean;
}) {
  const title = game.review_title ?? game.title ?? game.url;
  const review = game.review_md;

  return (
    <div className="wrap">
      <div className="hline" />
      <Link href="/games" className="article-back">
        ← FVNs
      </Link>

      <article className="article">
        <div className="article-hero">
          <CoverArt
            src={game.image_url}
            alt=""
            objectPosition={`${game.focal_x}% ${game.focal_y}%`}
            phSize="64px"
          />
        </div>

        <h1 className="article-title">{title}</h1>

        <div className="article-byline">
          <span>ifuxyl</span>
          {game.review_updated_at && (
            <span>· {dateFmt.format(new Date(game.review_updated_at))}</span>
          )}
          {review && <span>· {readingTime(review)} min read</span>}
        </div>

        <div className="article-metastrip">
          {game.score != null && (
            <span className="article-score" style={{ color: scoreColor(game.score) }}>
              {game.score}
              <span className="score-max">/10</span>
            </span>
          )}
          {game.status && (
            <span className={`play-status is-${game.status}`}>
              {STATUS_LABEL[game.status] ?? game.status}
            </span>
          )}
          <PlatformIcons platforms={parsePlatforms(game.platforms)} />
        </div>

        {review ? (
          <div className="article-body">
            <MarkdownView md={review} />
          </div>
        ) : (
          <p className="article-empty">No review written yet.</p>
        )}

        <div className="article-actions">
          <a className="btn primary" href={game.url} target="_blank" rel="noreferrer">
            Open on itch.io ↗
          </a>
          {admin && game.slug && (
            <Link className="btn" href={`/games/${game.slug}/edit`}>
              {review ? "Edit review" : "Write review"}
            </Link>
          )}
        </div>
      </article>

      <div className="hline" />
    </div>
  );
}
