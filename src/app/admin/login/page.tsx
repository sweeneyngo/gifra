import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLogin() {
  // Already signed in — no reason to show the form.
  if (await isAdmin()) redirect("/games");

  return (
    <div className="wrap">
      <div className="hline" />
      <header className="page-head">
        <span className="eyebrow">gifra</span>
        <h1>Admin sign-in</h1>
      </header>
      <div className="hline" />
      <LoginForm />
      <div className="hline" />
    </div>
  );
}
