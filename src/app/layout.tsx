import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Nav } from "./Nav";
import { PlayerProvider } from "./player/PlayerProvider";
import "./theme.css";
import "./globals.css";

// Momo Trust Sans (SIL OFL — see src/app/fonts/OFL.txt), self-hosted via
// next/font. One variable file covers every weight the UI uses (400/600/700).
const momo = localFont({
  src: "./fonts/MomoTrustSans-VariableFont_wght.ttf",
  variable: "--font-momo",
  weight: "200 800",
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
    <html lang="en" className={momo.variable}>
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
