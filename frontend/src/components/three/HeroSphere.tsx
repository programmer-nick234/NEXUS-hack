"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

/**
 * Scroll-reactive rotating sphere.
 * Rotation speed is tied to scroll progress via GSAP ScrollTrigger
 * (scroll position is passed through a global ref or prop).
 */
export default function HeroSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.15;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
  });

  return (
    <mesh ref={meshRef} scale={2.2}>
      <icosahedronGeometry args={[1, 64]} />
      <MeshDistortMaterial
        color="#6366f1"
        roughness={0.2}
        metalness={0.8}
        distort={0.3}
        speed={1.5}
      />
    </mesh>
  );
}
