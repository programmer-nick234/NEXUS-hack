"use client";

import { SceneContainer } from "@/components/three";
import HeroSphere from "@/components/three/HeroSphere";
import { useMediaQuery } from "@/hooks";

/**
 * Client-only hero 3D scene.
 * Falls back to a gradient on mobile / low-power devices.
 */
export default function HeroSceneClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (isMobile) {
    // Lightweight fallback for mobile
    return (
      <div className="h-full w-full bg-gradient-to-br from-indigo-900/40 via-black to-purple-900/30" />
    );
  }

  return (
    <SceneContainer className="h-full">
      <HeroSphere />
    </SceneContainer>
  );
}
