"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveReview, removeReview } from "../../actions";
import { MarkdownView } from "../MarkdownView";

type Props = {
  id: string;
  slug: string;
  gameTitle: string | null;
  reviewTitle: string | null;
  md: string;
};

export function ReviewEditor({ id, slug, gameTitle, reviewTitle, md: initialMd }: Props) {
  const [title, setTitle] = useState(reviewTitle ?? "");
  const [md, setMd] = useState(initialMd);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      setError(null);
      try {
        await saveReview(id, { title: title.trim() || null, md });
        router.push(`/games/${slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const remove = () => {
    if (!confirm("Delete this review?")) return;
    start(async () => {
      setError(null);
      try {
        await removeReview(id);
        router.push(`/games/${slug}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="wrap">
      <div className="hline" />
      <header className="page-head">
        <span className="eyebrow">Editing review</span>
        <h1>{gameTitle ?? slug}</h1>
      </header>
      <div className="hline" />

      <div className="review-editor">
        <div className="review-edit-pane">
          <label className="editor-field">
            <span>Headline (optional — defaults to the game title)</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={gameTitle ?? ""}
            />
          </label>
          <textarea
            className="review-textarea"
            value={md}
            onChange={(e) => setMd(e.target.value)}
            placeholder="Write your review in Markdown…"
          />
          {error && <p className="login-error">{error}</p>}
          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save review"}
            </button>
            <Link className="btn" href={`/games/${slug}`}>
              Cancel
            </Link>
            {initialMd && (
              <button className="btn danger" onClick={remove} disabled={pending}>
                Delete review
              </button>
            )}
          </div>
        </div>

        <div className="review-preview-pane">
          <div className="review-preview-label">Preview</div>
          <div className="article-body">
            {md.trim() ? (
              <MarkdownView md={md} />
            ) : (
              <p className="article-empty">Nothing yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="hline" />
    </div>
  );
}
