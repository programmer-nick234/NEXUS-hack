"use client";

import { useAuthStore } from "@/store";

export default function ProfilePage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-bold">Profile</h1>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-indigo-600/30 flex items-center justify-center text-2xl font-bold text-indigo-400">
            {user?.fullName?.charAt(0) ?? "U"}
          </div>
          <div>
            <p className="text-xl font-semibold">{user?.fullName}</p>
            <p className="text-gray-400">{user?.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Role</p>
            <p className="capitalize">{user?.role}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p>{user?.isActive ? "Active" : "Inactive"}</p>
          </div>
          <div>
            <p className="text-gray-500">User ID</p>
            <p className="font-mono text-xs text-gray-400">{user?.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
