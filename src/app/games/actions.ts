"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { enrich } from "@/lib/enrich";
import {
  upsertGame,
  updateGameOwner,
  updateGameScraped,
  deleteGame,
} from "@/lib/db";

export interface OwnerFields {
  score: number | null;
  status: string | null;
  recommended: boolean;
}

const csv = (p: string[]): string | null => (p.length ? p.join(", ") : null);

/** Add (or refresh) a game by URL: scrape it, then apply the owner fields. */
export async function addGame(input: OwnerFields & { url: string }): Promise<void> {
  await requireAdmin();
  if (!/^https?:\/\//i.test(input.url)) throw new Error("Invalid URL");

  const d = await enrich(input.url);
  // itch pages always expose og:image + a title; getting neither means the URL
  // 404'd or was blocked — reject rather than save an empty card.
  if (!d.title && !d.image_url) {
    throw new Error("Couldn't load that page — check the URL is a live itch.io game.");
  }
  await upsertGame({
    url: input.url,
    title: d.title,
    image_url: d.image_url,
    score: input.score,
    status: input.status,
    recommended: input.recommended,
    dev_status: d.dev_status,
    platforms: csv(d.platforms),
    updated_at: d.updated_at,
    rating_value: d.rating_value,
    rating_count: d.rating_count,
    focal_x: d.focal_x,
    focal_y: d.focal_y,
  });
  revalidatePath("/games");
}

export async function updateGame(id: string, fields: OwnerFields): Promise<void> {
  await requireAdmin();
  await updateGameOwner(id, fields);
  revalidatePath("/games");
}

/** Re-scrape the itch page and refresh only the scraped fields. */
export async function reenrichGame(id: string, url: string): Promise<void> {
  await requireAdmin();
  const d = await enrich(url);
  await updateGameScraped(id, {
    title: d.title,
    image_url: d.image_url,
    platforms: csv(d.platforms),
    dev_status: d.dev_status,
    updated_at: d.updated_at,
    rating_value: d.rating_value,
    rating_count: d.rating_count,
    focal_x: d.focal_x,
    focal_y: d.focal_y,
  });
  revalidatePath("/games");
}

export async function removeGame(id: string): Promise<void> {
  await requireAdmin();
  await deleteGame(id);
  revalidatePath("/games");
}
