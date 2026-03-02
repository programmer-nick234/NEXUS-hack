"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import Lenis from "lenis";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, Float, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   THEME & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#0F172A",
  orange: "#FF5A1F",
  white: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
};

/* ═══════════════════════════════════════════════════════════════════════════
   3D COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A subtle background star field for a cinematic feel.
 */
const StarField = memo(function StarField() {
  const ref = useRef<THREE.Points>(null!);
  const count = 2000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 50;
      p[i * 3 + 1] = (Math.random() - 0.5) * 50;
      p[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return p;
  }, []);

  useFrame((state) => {
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.01;
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#ffffff"
        size={0.015}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.3}
      />
    </Points>
  );
});

/**
 * The central 3D wireframe sphere with particle aura and mouse interaction.
 */
const EnergySphere = memo(function EnergySphere({ mouse }: { mouse: React.RefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.PointLight>(null!);
  const auraRef = useRef<THREE.Points>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const m = mouse.current;

    // Smooth rotation towards mouse
    meshRef.current.rotation.y += (m.x * 0.5 - meshRef.current.rotation.y) * 0.05;
    meshRef.current.rotation.x += (-m.y * 0.5 - meshRef.current.rotation.x) * 0.05;

    // Constant slow idle rotation
    meshRef.current.rotation.y += 0.005;

    // Hover glow effect
    const dist = Math.sqrt(m.x * m.x + m.y * m.y);
    const glowIntensity = 1.5 + (1 - Math.min(dist, 1)) * 1.5;
    if (glowRef.current) glowRef.current.intensity = glowIntensity;

    // Aura movement
    auraRef.current.rotation.y = t * 0.05;
    auraRef.current.rotation.z = t * 0.03;
  });

  const auraPositions = useMemo(() => {
    const count = 1000;
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 1.3 + Math.random() * 0.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = radius * Math.cos(phi);
    }
    return p;
  }, []);

  return (
    <group>
      <pointLight ref={glowRef} position={[0, 0, 1]} color={C.orange} intensity={2} distance={10} />

      {/* Wireframe Sphere */}
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <meshBasicMaterial color={C.orange} wireframe transparent opacity={0.4} />
      </Sphere>

      {/* Particle Aura */}
      <Points ref={auraRef} positions={auraPositions} stride={3}>
        <PointMaterial
          transparent
          color={C.orange}
          size={0.02}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.6}
        />
      </Points>
    </group>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

const CTAButton = memo(function CTAButton({ label, onClick }: { label: string; onClick: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    gsap.to(btnRef.current, { scale: 1.05, boxShadow: "0 0 30px rgba(255, 90, 31, 0.4)", duration: 0.3, ease: "power2.out" });
  };

  const handleMouseLeave = () => {
    gsap.to(btnRef.current, { scale: 1, boxShadow: "0 0 15px rgba(255, 90, 31, 0.2)", duration: 0.3, ease: "power2.out" });
  };

  return (
    <button
      ref={btnRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className="px-10 py-4 rounded-full text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 shadow-lg"
      style={{
        background: C.orange,
        color: C.bg,
        boxShadow: "0 0 15px rgba(255, 90, 31, 0.2)",
      }}
    >
      {label}
    </button>
  );
});

/**
 * A floating, animated helper pointer to guide user attention.
 */
const HelperPointer = memo(function HelperPointer({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Explicit "poking" animation towards the button
    gsap.fromTo(ref.current,
      { x: 0, y: 0 },
      {
        x: 20,
        y: 15,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut"
      }
    );

    const arrow = ref.current.querySelector(".pointer-arrow");
    if (arrow) {
      gsap.to(arrow, {
        scale: 1.2,
        opacity: 1,
        duration: 0.6,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }
  }, []);

  const handleMouseEnter = () => {
    gsap.to(ref.current, { scale: 1.1, filter: "drop-shadow(0 0 15px rgba(255, 90, 31, 0.7))", duration: 0.3 });
  };

  const handleMouseLeave = () => {
    gsap.to(ref.current, { scale: 1, filter: "drop-shadow(0 0 6px rgba(255, 90, 31, 0.3))", duration: 0.3 });
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute -top-14 -left-32 flex flex-col items-center cursor-pointer select-none z-20 group"
      style={{ filter: "drop-shadow(0 0 6px rgba(255, 90, 31, 0.3))" }}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 group-hover:text-white transition-colors">
        Click Here
      </span>
      {/* Points directly at the CTA button center */}
      <div className="pointer-arrow mt-2" style={{ color: C.orange, transform: "rotate(-35deg)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 13l5 5 5-5M12 18V6" />
        </svg>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subtextRef = useRef<HTMLDivElement>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Lenis Smooth Scroll
    const lenis = new Lenis();
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      lenis.destroy();
    };
  }, []);

  // Entry Animations
  useEffect(() => {
    if (!mounted) return;

    const tl = gsap.timeline();
    tl.fromTo(headlineRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, ease: "power3.out", delay: 0.5 }
    )
      .fromTo(subtextRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=0.6"
      )
      .fromTo(buttonWrapRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" },
        "-=0.4"
      );
  }, [mounted]);

  if (!mounted) return <div className="h-screen w-screen bg-[#0F172A]" />;

  return (
    <main
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: C.bg }}
    >
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
          <ambientLight intensity={0.1} />
          <StarField />
          <EnergySphere mouse={mouse} />
        </Canvas>
      </div>

      {/* Parallax Overlay (Subtle) */}
      <div className="absolute inset-0 z-1 pointer-events-none"
        style={{ background: `radial-gradient(circle at center, transparent 0%, ${C.bg} 85%)`, opacity: 0.6 }} />

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl">
        <div ref={headlineRef} className="will-change-transform">
          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-white leading-tight">
            Experience Emotion <br />
            <span className="font-bold">Through Interaction</span>
          </h1>
        </div>

        <div ref={subtextRef} className="mt-8 will-change-transform">
          <p className="text-lg md:text-xl font-medium tracking-wide" style={{ color: C.dim }}>
            AI-powered emotional detection meets physical UI.
          </p>
        </div>

        <div ref={buttonWrapRef} className="mt-12 will-change-transform relative">
          <HelperPointer onClick={() => router.push("/mood-analyze")} />
          <CTAButton label="Get Started →" onClick={() => router.push("/mood-analyze")} />
        </div>
      </div>

      {/* Footnote Branding */}
      <div className="absolute bottom-10 z-10 opacity-30">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white">
          Nexus Platform · AI Intelligence · v1.0
        </p>
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #0F172A;
          font-family: 'Inter', -apple-system, sans-serif;
        }
      `}</style>
    </main>
  );
}
