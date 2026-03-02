"use client";

import { useAuthStore } from "@/store";
import Link from "next/link";
import { usePathname } from "next/navigation";

const C = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceLight: "#334155",
  border: "#475569",
  orange: "#FF5A1F",
  accent: "#818CF8",
  text: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
  green: "#34D399",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/mood-analyze", label: "New Session", icon: "📹" },
  { href: "/relief", label: "Relief Journey", icon: "🌿" },
  { href: "/session-results", label: "Session Results", icon: "📈" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>
      {/* Sidebar */}
      <aside
        className="hidden md:flex w-64 flex-col p-5 border-r"
        style={{ background: `${C.surface}80`, borderColor: `${C.border}40` }}
      >
        <Link href="/" className="flex items-center gap-2 mb-8 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-transform group-hover:scale-110"
            style={{ background: C.orange, color: C.bg }}
          >
            N
          </div>
          <span className="text-lg font-bold" style={{ color: C.text }}>NEXUS</span>
        </Link>

        <nav className="flex-1 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: active ? `${C.orange}15` : "transparent",
                  color: active ? C.orange : C.dim,
                  border: active ? `1px solid ${C.orange}30` : "1px solid transparent",
                }}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {isAuthenticated && (user?.role === "admin" || user?.role === "superadmin") && (
            <Link
              href="/dashboard/admin"
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
              style={{ color: C.dim }}
            >
              <span className="text-base">⚙️</span>
              Admin Panel
            </Link>
          )}
        </nav>

        {/* User info */}
        <div className="pt-4 mt-4 border-t" style={{ borderColor: `${C.border}40` }}>
          {isAuthenticated ? (
            <>
              <p className="text-xs mb-2 truncate" style={{ color: C.muted }}>
                Signed in as <span style={{ color: C.dim }}>{user?.email}</span>
              </p>
              <button
                onClick={() => logout()}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: "#F87171" }}
              >
                Logout
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Link
                href="/auth/login"
                className="block text-xs font-medium text-center py-2 rounded-lg transition-all"
                style={{ background: `${C.orange}15`, color: C.orange, border: `1px solid ${C.orange}30` }}
              >
                Sign In
              </Link>
              <p className="text-[10px] text-center" style={{ color: C.muted }}>
                Anonymous mode active
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: `${C.surface}E6`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}40` }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black"
            style={{ background: C.orange, color: C.bg }}>N</div>
          <span className="text-sm font-bold" style={{ color: C.text }}>NEXUS</span>
        </Link>
        <div className="flex items-center gap-3">
          {NAV_ITEMS.slice(0, 3).map((item) => (
            <Link key={item.href} href={item.href} className="text-lg">{item.icon}</Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto md:p-8 p-4 pt-18 md:pt-8">{children}</main>
    </div>
  );
}
