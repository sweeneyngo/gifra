import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gimme — wishlist",
  description: "A dead-simple cross-storefront wishlist.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
