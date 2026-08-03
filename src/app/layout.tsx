import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Nav } from "./Nav";
import { PlayerProvider } from "./player/PlayerProvider";
import "./theme.css";
import "./globals.css";

// Self-hosted at build time by next/font — no external requests at runtime.
// Swap the import + variable here (and --font-sans in globals.css) to try
// another Google font.
const sans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gifra.me"),
  title: "My Wishlist",
  description: "A running wishlist of things I'm after.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <PlayerProvider>
          <Nav />
          {children}
        </PlayerProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
