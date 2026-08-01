"use server";

import { revalidatePath } from "next/cache";
import { setStatus, deleteItem, type ItemStatus } from "@/lib/db";

export async function updateStatus(id: string, status: ItemStatus) {
  await setStatus(id, status);
  revalidatePath("/");
}

export async function removeItem(id: string) {
  await deleteItem(id);
  revalidatePath("/");
}
