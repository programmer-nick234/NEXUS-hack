"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store";

/**
 * Hook to hydrate auth state on app load.
 * Call once in a top-level client provider.
 */
export function useAuthHydration() {
  const refreshAuth = useAuthStore((s) => s.refreshAuth);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);
}
