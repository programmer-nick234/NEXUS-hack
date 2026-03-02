"use client";

import { ProtectedRoute } from "@/components/ui";
import { useAuthStore } from "@/store";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuthStore();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-white/[0.02] p-6 flex flex-col">
          <div className="text-xl font-bold text-indigo-400 mb-8">Nexus</div>
          <nav className="flex-1 space-y-2">
            <Link
              href="/dashboard/overview"
              className="block rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Overview
            </Link>
            <Link
              href="/dashboard/analytics"
              className="block rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Analytics
            </Link>
            <Link
              href="/mood-analyze"
              className="block rounded-lg px-4 py-2 text-sm text-indigo-400 hover:bg-white/10 transition-colors"
            >
              Mood Session
            </Link>
            <Link
              href="/dashboard/profile"
              className="block rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Profile
            </Link>
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link
                href="/dashboard/admin"
                className="block rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
              >
                Admin Panel
              </Link>
            )}
          </nav>
          <div className="border-t border-white/10 pt-4 mt-4">
            <p className="text-xs text-gray-500 mb-2">
              Signed in as <span className="text-gray-300">{user?.email}</span>
            </p>
            <button
              onClick={() => logout()}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
