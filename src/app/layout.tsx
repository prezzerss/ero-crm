import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

export const metadata = {
  title: "ERO CRM",
  description: "Easy Read Online CRM",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAuthRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/auth/");
  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/companies", label: "Companies" },
    { href: "/contacts", label: "Contacts" },
    { href: "/inbox", label: "Inbox" },
    { href: "/mailing-lists", label: "Mailing lists" },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <html lang="en">
      <body>
        {isAuthRoute ? (
          children
        ) : (
          <div className="crm-shell">
            <aside className="crm-sidebar">
              <div className="mb-8">
                <div className="crm-logo-card">
                  <Image
                    alt="Easy Read Online logo"
                    className="crm-logo"
                    height={963}
                    priority
                    src="/er_logo.jpg"
                    style={{ height: "auto" }}
                    width={669}
                  />
                </div>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link className="crm-nav-link" href={item.href} key={item.href}>
                    {item.label}
                  </Link>
                ))}
              </nav>

            </aside>

            <main className="crm-main">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
