"use client";

import { useAuthStore } from "@/store";

export default function OverviewPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Welcome back, {user?.fullName ?? "User"}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          { label: "Role", value: user?.role ?? "—" },
          { label: "Status", value: user?.isActive ? "Active" : "Inactive" },
          { label: "Member Since", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <p className="text-sm text-gray-400">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold capitalize">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
