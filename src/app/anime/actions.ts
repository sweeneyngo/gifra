"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { enrichAnime, AniListUnavailableError } from "@/lib/anilist";
import { slugify, uniqueSlug } from "@/lib/slug";
import {
  upsertAnime,
  updateAnimeOwner,
  updateAnimeScraped,
  deleteAnime,
  insertAnimeGroup,
  updateAnimeGroup,
  deleteAnimeGroup,
  setAnimeGroupCover,
  animeGroupSlugExists,
} from "@/lib/db";

export interface OwnerFields {
  score: number | null;
  status: string | null;
  recommended: boolean;
  group_id: string | null;
}

// Expected, user-facing outcomes are returned (not thrown) so the message
// survives to the client — Next.js replaces thrown Server Action errors with a
// generic digest in production, which is what hid the real cause here.
export type ActionResult = { ok: true } | { ok: false; error: string };

const csv = (g: string[]): string | null => (g.length ? g.join(", ") : null);

// A group's detail page shares the [slug] route; revalidate it too on writes.
function revalidateAnime() {
  revalidatePath("/anime");
  revalidatePath("/anime/[slug]", "page");
}

/** Add (or refresh) an anime by AniList URL or title search, then apply owner fields. */
export async function addAnime(
  input: OwnerFields & { query: string },
): Promise<ActionResult> {
  await requireAdmin();
  let d;
  try {
    d = await enrichAnime(input.query);
  } catch (e) {
    if (e instanceof AniListUnavailableError) return { ok: false, error: e.message };
    throw e;
  }
  if (!d) {
    return {
      ok: false,
      error: "Couldn't find that on AniList — try the anilist.co URL or a different title.",
    };
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
  return { ok: true };
}

export async function updateAnime(
  id: string,
  fields: OwnerFields,
): Promise<ActionResult> {
  await requireAdmin();
  await updateAnimeOwner(id, fields);
  revalidateAnime();
  return { ok: true };
}

/** Re-query AniList and refresh only the scraped fields. */
export async function reenrichAnime(id: string, url: string): Promise<ActionResult> {
  await requireAdmin();
  let d;
  try {
    d = await enrichAnime(url);
  } catch (e) {
    if (e instanceof AniListUnavailableError) return { ok: false, error: e.message };
    throw e;
  }
  if (!d) {
    return { ok: false, error: "Couldn't find this title on AniList anymore." };
  }
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
  return { ok: true };
}

export async function removeAnime(id: string): Promise<ActionResult> {
  await requireAdmin();
  await deleteAnime(id);
  revalidateAnime();
  return { ok: true };
}

// ---- Group actions ----

// A group's score is derived (floor of members' average), so the editor only
// sets the name.
export interface GroupFields {
  name: string;
}

export async function addAnimeGroup(fields: GroupFields): Promise<void> {
  await requireAdmin();
  const name = fields.name.trim();
  if (!name) throw new Error("Group needs a name.");
  const slug = await uniqueSlug(slugify(name) || "group", animeGroupSlugExists);
  await insertAnimeGroup({ slug, name });
  revalidateAnime();
}

export async function editAnimeGroup(
  id: string,
  fields: GroupFields,
): Promise<void> {
  await requireAdmin();
  const name = fields.name.trim();
  if (!name) throw new Error("Group needs a name.");
  await updateAnimeGroup(id, { name });
  revalidateAnime();
}

/** Set (or clear, with null) which member's poster represents the group. */
export async function setGroupCover(
  groupId: string,
  animeId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  await setAnimeGroupCover(groupId, animeId);
  revalidateAnime();
  return { ok: true };
}

/** Delete a group; its members fall back to standalone cards on the grid. */
export async function removeAnimeGroup(id: string): Promise<void> {
  await requireAdmin();
  await deleteAnimeGroup(id);
  revalidateAnime();
}
