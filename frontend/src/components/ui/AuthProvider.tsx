"use client";

import { useAuthHydration } from "@/hooks/useAuth";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthHydration();
  return <>{children}</>;
}
