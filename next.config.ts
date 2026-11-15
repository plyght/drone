import type { NextConfig } from "next";

// A static export: the page has no server parts, so it can be served from
// any static host. Renders are pre-sized (scripts/models/export.py), so the
// image optimizer is off. NEXT_PUBLIC_BASE_PATH is the subpath it is served
// from, if any (see lib/asset.ts).
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
