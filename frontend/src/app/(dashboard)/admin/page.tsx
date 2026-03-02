"use client";

import { ProtectedRoute } from "@/components/ui";

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-gray-400">
          Manage users, view analytics, and configure system settings.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-2">User Management</h3>
            <p className="text-sm text-gray-400">
              Create, update, delete, and soft-delete users. Assign roles.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-2">Face Detection Logs</h3>
            <p className="text-sm text-gray-400">
              View face analysis history and confidence metrics.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-2">System Health</h3>
            <p className="text-sm text-gray-400">
              Monitor API response times, error rates, and DB metrics.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-2">Audit Log</h3>
            <p className="text-sm text-gray-400">
              Track all admin actions with timestamps and user IDs.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
