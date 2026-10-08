import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { IdentityProvider } from "@/lib/identity/IdentityProvider";

/*
 * Fonts are self-hosted from the official Fontsource packages (Google Fonts
 * files, OFL). next/font/local gives the same preloading and fallback metrics
 * as next/font/google without a network fetch at build time.
 */

// Primary voice. One variable file carrying weight, width and optical size,
// so display type can be set narrower and sharper than body copy.
const bricolage = localFont({
  variable: "--font-bricolage",
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "75% 100%" }],
  adjustFontFallback: "Arial",
});

// Technical layer: addresses, IDs, timestamps, system labels.
const plexMono = localFont({
  variable: "--font-plex-mono",
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
});

const DESCRIPTION = "A permission layer for AI applications. Give AI exactly what you choose. Nothing more.";

export const metadata: Metadata = {
  title: {
    default: "ContextPass — Your context. Your control.",
    template: "%s · ContextPass",
  },
  description: DESCRIPTION,
  applicationName: "ContextPass",
  openGraph: {
    type: "website",
    siteName: "ContextPass",
    title: "ContextPass — Your context. Your control.",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "ContextPass — Your context. Your control.",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#f1eee6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${bricolage.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="type-action sr-only z-[100] bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <IdentityProvider>{children}</IdentityProvider>
      </body>
    </html>
  );
}
