import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScoreJam",
  description: "Diagnostic CRM built on the Sales Unlocked methodology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-stone-900 antialiased">{children}</body>
    </html>
  );
}
