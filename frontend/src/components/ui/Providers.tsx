"use client";

import dynamic from "next/dynamic";
import AuthProvider from "@/components/ui/AuthProvider";

// Dynamic import – Lenis + GSAP is client-only
const SmoothScrollProvider = dynamic(
  () => import("@/components/animations/SmoothScrollProvider"),
  { ssr: false },
);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SmoothScrollProvider>{children}</SmoothScrollProvider>
    </AuthProvider>
  );
}
