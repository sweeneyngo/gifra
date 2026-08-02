import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Nav } from "./Nav";
import { PlayerProvider } from "./player/PlayerProvider";
import "./theme.css";
import "./globals.css";

// Self-hosted at build time by next/font — no external requests at runtime.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Wishlist",
  description: "A running wishlist of things I'm after.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={hanken.variable}>
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
