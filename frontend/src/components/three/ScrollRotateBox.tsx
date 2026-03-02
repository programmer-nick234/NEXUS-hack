"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

/**
 * A box that rotates based on scroll progress.
 * Demonstrates scroll-driven 3D animation via GSAP ScrollTrigger.
 */
export default function ScrollRotateBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  const progress = useRef({ value: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: (self) => {
          progress.current.value = self.progress;
        },
      });
    });

    return () => ctx.revert();
  }, []);

  useFrame(() => {
    if (!meshRef.current || !ready) return;
    meshRef.current.rotation.y = progress.current.value * Math.PI * 4;
    meshRef.current.rotation.x = progress.current.value * Math.PI * 2;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial
        color="#a855f7"
        wireframe
        emissive="#7c3aed"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}
