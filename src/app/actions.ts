"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { enrich, storeName } from "@/lib/enrich";
import {
  insertItem,
  setStatus,
  deleteItem,
  updateItemMeta,
  type ItemStatus,
} from "@/lib/db";

/**
 * Add a wishlist item by URL. Saves immediately (store from the hostname), then
 * fills in title/image/focal from enrichment. Unlike games we keep thin results
 * — a hostile store (Amazon) still saves as a bare link, per the wishlist design.
 */
export async function addItem(url: string): Promise<void> {
  await requireAdmin();
  if (!/^https?:\/\//i.test(url)) throw new Error("Invalid URL");

  const item = await insertItem({
    url,
    title: null,
    image_url: null,
    store: storeName(url),
  });
  const d = await enrich(url);
  if (d.title || d.image_url) {
    await updateItemMeta(item.id, d.title, d.image_url, d.focal_x, d.focal_y);
  }
  revalidatePath("/");
}

export async function updateStatus(id: string, status: ItemStatus): Promise<void> {
  await requireAdmin();
  await setStatus(id, status);
  revalidatePath("/");
}

/** Re-scrape the page and refresh title/image/focal. */
export async function reenrichItem(id: string, url: string): Promise<void> {
  await requireAdmin();
  const d = await enrich(url);
  await updateItemMeta(id, d.title, d.image_url, d.focal_x, d.focal_y);
  revalidatePath("/");
}

export async function removeItem(id: string): Promise<void> {
  await requireAdmin();
  await deleteItem(id);
  revalidatePath("/");
}
