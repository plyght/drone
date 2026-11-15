// The site may be served from a subpath (GitHub Pages serves it at /drone).
// Anything fetched by URL at runtime (models, render plates, frames) goes
// through this so the path holds wherever the site lives.
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export const asset = (path: string) => `${BASE}${path}`;
