import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catalog Reglementări Tehnice",
  description: "Catalog intern pentru reglementări tehnice AIP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>
        <header className="topbar">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-base font-bold">
              Catalog Reglementări Tehnice
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/" className="btn border-slate-600 bg-slate-900 text-white hover:bg-slate-800">
                Catalog
              </Link>
              <Link href="/reglementari/new" className="btn btn-primary">
                Adaugă
              </Link>
              <Link href="/reglementari/bulk" className="btn btn-primary">
                Bulk
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
