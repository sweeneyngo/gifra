"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PawMark } from "./paw";

const TABS = [
  { href: "/", label: "Wishlist" },
  { href: "/music", label: "Music" },
  { href: "/games", label: "Games" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand" aria-label="gifra home">
        <PawMark size={26} />
      </Link>
      <div className="nav-tabs">
        {TABS.map((t) => {
          const active =
            t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`nav-tab${active ? " active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
