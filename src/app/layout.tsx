import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://labelcop.vercel.app";
const SITE_TITLE = "LabelCop — TTB Label Compliance Verification";
const SITE_DESCRIPTION =
  "Prototype tool for TTB compliance agents: verify alcohol beverage labels against COLA application data in seconds.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "LabelCop",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
