/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote product images from any storefront in <Image>-less <img> tags.
  // We render plain <img>, so no domain allowlist is needed here.

  // Keep the native image libs out of the bundle; load them from node_modules
  // at runtime (used only in the Discord route's background enrichment).
  serverExternalPackages: ["sharp", "smartcrop-sharp"],
};

export default nextConfig;
