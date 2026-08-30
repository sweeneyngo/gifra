"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { enrichAnime } from "@/lib/anilist";
import {
  upsertAnime,
  updateAnimeOwner,
  updateAnimeScraped,
  deleteAnime,
} from "@/lib/db";

export interface OwnerFields {
  score: number | null;
  status: string | null;
  recommended: boolean;
}

const csv = (g: string[]): string | null => (g.length ? g.join(", ") : null);

/** Add (or refresh) an anime by AniList URL or title search, then apply owner fields. */
export async function addAnime(
  input: OwnerFields & { query: string },
): Promise<void> {
  await requireAdmin();
  const d = await enrichAnime(input.query);
  if (!d) {
    throw new Error(
      "Couldn't find that on AniList — try the anilist.co URL or a different title.",
    );
  }
  await upsertAnime({
    url: d.url,
    title: d.title,
    image_url: d.image_url,
    score: input.score,
    status: input.status,
    recommended: input.recommended,
    format: d.format,
    episodes: d.episodes,
    season_year: d.season_year,
    average_score: d.average_score,
    genres: csv(d.genres),
    cover_color: d.cover_color,
  });
  revalidatePath("/anime");
}

export async function updateAnime(id: string, fields: OwnerFields): Promise<void> {
  await requireAdmin();
  await updateAnimeOwner(id, fields);
  revalidatePath("/anime");
}

/** Re-query AniList and refresh only the scraped fields. */
export async function reenrichAnime(id: string, url: string): Promise<void> {
  await requireAdmin();
  const d = await enrichAnime(url);
  if (!d) throw new Error("Couldn't refresh from AniList.");
  await updateAnimeScraped(id, {
    title: d.title,
    image_url: d.image_url,
    format: d.format,
    episodes: d.episodes,
    season_year: d.season_year,
    average_score: d.average_score,
    genres: csv(d.genres),
    cover_color: d.cover_color,
    focal_x: 50,
    focal_y: 50,
  });
  revalidatePath("/anime");
}

export async function removeAnime(id: string): Promise<void> {
  await requireAdmin();
  await deleteAnime(id);
  revalidatePath("/anime");
}
