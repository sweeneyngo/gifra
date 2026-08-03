import {
  siNextdotjs,
  siVercel,
  siNeon,
  siCloudflare,
  siDiscord,
} from "simple-icons";
import { listItems } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { TopActions } from "./TopActions";
import { CoverArt } from "./CoverArt";
import { WishlistView } from "./WishlistView";

export const dynamic = "force-dynamic";

// Public-facing page title — rename freely.
const PAGE_TITLE = "My Wishlist";
const OWNER_HANDLE = "ifuxyl";

export default async function Home() {
  const [items, admin] = await Promise.all([listItems(), isAdmin()]);

  return (
    <div className="wrap">
      <div className="hline" />

      {/* Banner image lives at public/banner.jpg */}
      <header className="banner">
        <CoverArt src="/banner.jpg" alt="" objectPosition="center 12%" phSize="64px" />
        <div className="banner-inner">
          <div className="banner-title">
            <span className="eyebrow">{OWNER_HANDLE}</span>
            <h1>{PAGE_TITLE}</h1>
          </div>
          <TopActions />
        </div>
      </header>

      <div className="hline" />

      <WishlistView items={items} admin={admin} />

      <footer className="footer">
        <div className="footer-row">
          <span className="footer-label">Credits</span>
          <span>
            Banner art by{" "}
            <a
              href="https://x.com/stoatallynate?lang=en"
              target="_blank"
              rel="noreferrer"
            >
              @stoatallynate
            </a>
          </span>
        </div>

        <div className="footer-row">
          <span className="footer-label">Built with</span>
          <span className="stack">
            <BrandLink icon={siNextdotjs} href="https://nextjs.org" />
            <span className="plus">+</span>
            <BrandLink icon={siVercel} href="https://vercel.com" />
            <span className="plus">+</span>
            <BrandLink icon={siNeon} href="https://neon.tech" />
            <span className="plus">+</span>
            <BrandLink
              icon={siCloudflare}
              href="https://www.cloudflare.com/developer-platform/products/r2/"
            />
            <span className="plus">+</span>
            <BrandLink icon={siDiscord} href="https://discord.com" />
          </span>
        </div>
      </footer>

      <div className="hline" />
    </div>
  );
}

/* ---- Official brand marks (simple-icons), icon-only + linked ---- */
function BrandLink({
  icon,
  href,
}: {
  icon: { path: string; title: string };
  href: string;
}) {
  return (
    <a
      className="brand"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={icon.title}
      aria-label={icon.title}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={icon.path} />
      </svg>
    </a>
  );
}
