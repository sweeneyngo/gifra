"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { enrichAnime } from "@/lib/anilist";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  upsertAnime,
  updateAnimeOwner,
  updateAnimeScraped,
  deleteAnime,
  insertAnimeGroup,
  updateAnimeGroup,
  deleteAnimeGroup,
  animeGroupSlugExists,
} from "@/lib/db";

export interface OwnerFields {
  score: number | null;
  status: string | null;
  recommended: boolean;
  group_id: string | null;
}

const csv = (g: string[]): string | null => (g.length ? g.join(", ") : null);

// A group's detail page shares the [slug] route; revalidate it too on writes.
function revalidateAnime() {
  revalidatePath("/anime");
  revalidatePath("/anime/[slug]", "page");
}

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
  const row = await upsertAnime({
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
  // upsert leaves group untouched; apply the chosen group when adding.
  if (input.group_id) await updateAnimeOwner(row.id, input);
  revalidateAnime();
}

export async function updateAnime(id: string, fields: OwnerFields): Promise<void> {
  await requireAdmin();
  await updateAnimeOwner(id, fields);
  revalidateAnime();
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
  revalidateAnime();
}

export async function removeAnime(id: string): Promise<void> {
  await requireAdmin();
  await deleteAnime(id);
  revalidateAnime();
}

// ---- Group actions ----

export interface GroupFields {
  name: string;
  score: number | null;
}

export async function addAnimeGroup(fields: GroupFields): Promise<void> {
  await requireAdmin();
  const name = fields.name.trim();
  if (!name) throw new Error("Group needs a name.");
  const slug = await uniqueSlug(slugify(name) || "group", animeGroupSlugExists);
  await insertAnimeGroup({ slug, name, score: fields.score });
  revalidateAnime();
}

export async function editAnimeGroup(
  id: string,
  fields: GroupFields,
): Promise<void> {
  await requireAdmin();
  const name = fields.name.trim();
  if (!name) throw new Error("Group needs a name.");
  await updateAnimeGroup(id, { name, score: fields.score });
  revalidateAnime();
}

/** Delete a group; its members fall back to standalone cards on the grid. */
export async function removeAnimeGroup(id: string): Promise<void> {
  await requireAdmin();
  await deleteAnimeGroup(id);
  revalidateAnime();
}
