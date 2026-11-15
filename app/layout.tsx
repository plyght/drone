import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

// One family throughout, set at modest sizes and solid weights.
const host = Host_Grotesk({ subsets: ["latin"], variable: "--font-host" });

const title = `${SITE.name}: ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title,
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    title,
    description: SITE.description,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "A Mercury drone rotor in a dark studio." }],
  },
  twitter: { card: "summary_large_image", title, description: SITE.description, images: ["/og-image.jpg"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeee9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0c" },
  ],
  viewportFit: "cover",
};

// The theme follows the visitor's system setting, with no toggle. Applied
// before paint so the page never flashes the wrong theme, and kept in step if
// the setting changes while the page is open.
const THEME_INIT = `(function(){var m=matchMedia("(prefers-color-scheme: light)");function a(){document.documentElement.dataset.theme=m.matches?"light":"dark"}a();m.addEventListener("change",a)})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={host.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
