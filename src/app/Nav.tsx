"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Wishlist" },
  { href: "/music", label: "Music" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="nav-brand" aria-label="gifra home">
        <PawIcon />
        <span>gifra</span>
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

const PawIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <ellipse cx="5.4" cy="11.9" rx="1.9" ry="2.5" />
    <ellipse cx="9.4" cy="7" rx="2" ry="2.7" />
    <ellipse cx="14.6" cy="7" rx="2" ry="2.7" />
    <ellipse cx="18.6" cy="11.9" rx="1.9" ry="2.5" />
    <path d="M12 13.4c-2.9 0-5.2 2.3-5.2 4.8 0 1.9 1.5 3 3.3 3 1 0 1.5-.4 1.9-.4s.9.4 1.9.4c1.8 0 3.3-1.1 3.3-3 0-2.5-2.3-4.8-5.2-4.8z" />
  </svg>
);
