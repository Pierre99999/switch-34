import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { RoleProvider } from "@/lib/role-context";

export const metadata: Metadata = {
  title: "Switch",
  description: "Diagnostic CRM built on the Sales Unlocked methodology",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-neutral-50 text-neutral-900 antialiased">
        <I18nProvider><RoleProvider>{children}</RoleProvider></I18nProvider>
      </body>
    </html>
  );
}
