"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, checkPassword, signToken } from "@/lib/auth";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** useActionState handler: verify the password, set the session cookie. */
export async function login(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const pw = String(formData.get("password") ?? "");
  if (!checkPassword(pw)) return "Wrong password.";

  const token = signToken();
  if (!token) return "Admin is not configured.";

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  redirect("/games");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/games");
}
