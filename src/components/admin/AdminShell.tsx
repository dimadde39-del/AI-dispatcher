import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/masters", label: "Masters" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/calls", label: "Calls" },
  { href: "/admin/numbers", label: "AI Numbers" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <strong>AI Dispatcher</strong>
          <span>Internal pilot ops</span>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
