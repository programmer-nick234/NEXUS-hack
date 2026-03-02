"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store";

/**
 * Hook to hydrate auth state on app load.
 * Only fires ONCE — guards against HMR re-mount loops.
 */
export function useAuthHydration() {
  const refreshAuth = useAuthStore((s) => s.refreshAuth);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    refreshAuth();
  }, [refreshAuth]);
}
