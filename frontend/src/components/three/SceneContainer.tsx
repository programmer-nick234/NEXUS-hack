"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Preload } from "@react-three/drei";

interface SceneContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable Three.js Canvas wrapper with performance defaults.
 * - dpr capped at [1, 1.5] for perf
 * - frameloop="demand" renders only when needed
 * - Suspense fallback for lazy-loaded 3D assets
 */
export default function SceneContainer({
  children,
  className = "",
}: SceneContainerProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0, 5], fov: 45 }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <Environment preset="city" />
          {children}
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  );
}
