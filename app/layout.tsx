import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

const SITE_DESCRIPTION =
  "Ledger tracks the licenses, filings and stocking rules a small retailer is judged on, and tells you which one is about to fail.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ledger.vercel.app"),
  title: {
    default: "Ledger: every permit your store holds, in one place",
    template: "%s · Ledger",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Ledger: every permit your store holds, in one place",
    description: SITE_DESCRIPTION,
    type: "website",
    images: [{ url: "/og-image-1200x630.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ledger",
    description: SITE_DESCRIPTION,
    images: ["/og-image-1200x630.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }],
    apple: "/apple-touch-icon-180.png",
  },
};

/**
 * Marks the document as scripted, before first paint.
 *
 * Scroll reveals need JavaScript for the trigger, so their hidden state is
 * gated on this attribute in app/globals.css. Without it — JS off, JS broken,
 * a crawler — nothing is ever hidden. It is set inline rather than in an effect
 * so the gate is in place before the first frame, which is the only way to
 * avoid content appearing and then being hidden again.
 */
const MARK_SCRIPTED = "document.documentElement.setAttribute('data-js','');";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MARK_SCRIPTED }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
