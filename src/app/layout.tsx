import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabelCop — TTB Label Compliance Verification",
  description:
    "Prototype tool for TTB compliance agents: verify alcohol beverage labels against COLA application data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
