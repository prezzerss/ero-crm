import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "ERO CRM",
  description: "Easy Read Online CRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-64 bg-white border-r-2 border-[#303030] p-6">
            <div className="mb-8">
              <p className="text-sm font-bold text-[var(--brand-teal)]">
                Easy Read Online
              </p>
              <h1 className="text-3xl font-black tracking-tight">
                CRM
              </h1>
            </div>

            <nav className="space-y-3">
              <Link className="block rounded-xl px-3 py-2 font-bold hover:bg-gray-100" href="/">
                Dashboard
              </Link>
              <Link className="block rounded-xl px-3 py-2 font-bold hover:bg-gray-100" href="/companies">
                Companies
              </Link>
              <Link className="block rounded-xl px-3 py-2 font-bold hover:bg-gray-100" href="/contacts">
                Contacts
              </Link>
              <Link className="block rounded-xl px-3 py-2 font-bold hover:bg-gray-100" href="/emails">
                Emails
              </Link>
            </nav>
          </aside>

          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}