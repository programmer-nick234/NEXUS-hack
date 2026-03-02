"use client";

import React, { useRef, useEffect, useMemo, useState, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap } from "gsap";
import Lenis from "lenis";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import OnboardingOverlay, { useOnboarding } from "@/components/Onboarding";

/* ═══════════════════════════════════════════════════════════════════════════
   THEME
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#0F172A",
  bgDark: "#020617",
  surface: "#1E293B",
  surfaceLight: "#334155",
  border: "#475569",
  orange: "#FF5A1F",
  orangeGlow: "rgba(255, 90, 31, 0.15)",
  accent: "#818CF8",
  green: "#34D399",
  cyan: "#22D3EE",
  white: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
};

/* ═══════════════════════════════════════════════════════════════════════════
   3D COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
const StarField = memo(function StarField() {
  const ref = useRef<THREE.Points>(null!);
  const count = 2500;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60;
      p[i * 3 + 1] = (Math.random() - 0.5) * 60;
      p[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return p;
  }, []);
  useFrame((s) => {
    ref.current.rotation.y = s.clock.getElapsedTime() * 0.008;
  });
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color="#ffffff" size={0.012} sizeAttenuation depthWrite={false} opacity={0.25} />
    </Points>
  );
});

const EnergySphere = memo(function EnergySphere({ mouse }: { mouse: React.RefObject<{ x: number; y: number }> }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.PointLight>(null!);
  const auraRef = useRef<THREE.Points>(null!);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    const m = mouse.current;
    meshRef.current.rotation.y += (m.x * 0.5 - meshRef.current.rotation.y) * 0.05;
    meshRef.current.rotation.x += (-m.y * 0.5 - meshRef.current.rotation.x) * 0.05;
    meshRef.current.rotation.y += 0.005;
    const dist = Math.sqrt(m.x * m.x + m.y * m.y);
    if (glowRef.current) glowRef.current.intensity = 1.5 + (1 - Math.min(dist, 1)) * 1.5;
    auraRef.current.rotation.y = t * 0.05;
    auraRef.current.rotation.z = t * 0.03;
  });

  const auraPositions = useMemo(() => {
    const count = 1200;
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.3 + Math.random() * 0.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  return (
    <group>
      <pointLight ref={glowRef} position={[0, 0, 1]} color={C.orange} intensity={2} distance={10} />
      <Sphere ref={meshRef} args={[1, 64, 64]}>
        <meshBasicMaterial color={C.orange} wireframe transparent opacity={0.35} />
      </Sphere>
      <Points ref={auraRef} positions={auraPositions} stride={3}>
        <PointMaterial transparent color={C.orange} size={0.018} sizeAttenuation depthWrite={false} opacity={0.5} />
      </Points>
    </group>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: "🧠",
    title: "FACS Emotion Detection",
    desc: "Advanced Facial Action Coding System tracks 15+ Action Units in real-time for lab-grade emotion analysis.",
    gradient: `linear-gradient(135deg, ${C.orange}, #FF8A65)`,
  },
  {
    icon: "🖐️",
    title: "Gesture Recognition",
    desc: "Hand gestures, head pose tracking, and micro-expression detection — multi-modal interaction.",
    gradient: `linear-gradient(135deg, ${C.accent}, #6366F1)`,
  },
  {
    icon: "🌊",
    title: "Cinematic Particles",
    desc: "2000+ particles respond to your emotions — drifting, wrapping, and exploding with every feeling.",
    gradient: `linear-gradient(135deg, ${C.cyan}, #0EA5E9)`,
  },
  {
    icon: "🌿",
    title: "Relief Activities",
    desc: "6 interactive stress-relief exercises: breathing, grounding, gratitude, pattern tracing, and more.",
    gradient: `linear-gradient(135deg, ${C.green}, #10B981)`,
  },
  {
    icon: "🏆",
    title: "Gamification System",
    desc: "XP progression, 18+ unique badges, streak tracking, and leveling to keep you engaged.",
    gradient: `linear-gradient(135deg, #FBBF24, #F59E0B)`,
  },
  {
    icon: "📊",
    title: "Analytics Dashboard",
    desc: "Session history, emotion timelines, stability metrics, and AI-powered improvement suggestions.",
    gradient: `linear-gradient(135deg, #A78BFA, #8B5CF6)`,
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Start a Session", desc: "Open your camera and begin real-time emotion analysis with our FACS engine.", icon: "📷" },
  { step: "02", title: "Feel & Interact", desc: "Your emotions are tracked, mapped into particles, and visualized as living art.", icon: "✨" },
  { step: "03", title: "Relief Journey", desc: "Post-session, engage in curated stress-relief activities tailored to your mood.", icon: "🌿" },
  { step: "04", title: "Track & Grow", desc: "Review analytics, earn badges, and build emotional resilience over time.", icon: "📈" },
];

const STATS = [
  { value: "15+", label: "Action Units Tracked" },
  { value: "6", label: "Relief Activities" },
  { value: "18+", label: "Earnable Badges" },
  { value: "Real-time", label: "Emotion Detection" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(15, 23, 42, 0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}33` : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black transition-transform group-hover:scale-110"
            style={{ background: C.orange, color: C.bg }}>N</div>
          <span className="text-lg font-bold text-white">NEXUS</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Features</a>
          <a href="#how-it-works" className="text-sm font-medium transition-colors hover:text-white" style={{ color: C.dim }}>How It Works</a>
          <a href="#stats" className="text-sm font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Stats</a>
          <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Dashboard</Link>
          <Link href="/mood-analyze"
            className="px-5 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
            style={{ background: C.orange, color: C.bg }}>
            Launch App
          </Link>
        </div>
        <Link href="/mood-analyze"
          className="md:hidden px-4 py-2 rounded-full text-xs font-bold"
          style={{ background: C.orange, color: C.bg }}>
          Launch
        </Link>
      </div>
    </nav>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          gsap.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", delay: index * 0.1 });
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 opacity-0"
      style={{
        background: `${C.surface}90`,
        border: `1px solid ${C.border}40`,
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: feature.gradient, filter: "blur(40px)", transform: "scale(0.8)" }}
      />
      <div className="relative z-10">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
          style={{ background: `${C.surfaceLight}80` }}>
          {feature.icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{feature.desc}</p>
      </div>
    </div>
  );
}

function HowItWorksCard({ item, index }: { item: typeof HOW_IT_WORKS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          gsap.fromTo(el, { opacity: 0, x: index % 2 === 0 ? -30 : 30 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out", delay: index * 0.15 });
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div ref={ref} className="flex items-start gap-5 opacity-0">
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: `${C.orange}15`, border: `1px solid ${C.orange}30` }}>
        {item.icon}
      </div>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-mono font-bold" style={{ color: C.orange }}>{item.step}</span>
          <h3 className="text-lg font-bold text-white">{item.title}</h3>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{item.desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });
  const headlineRef = useRef<HTMLDivElement>(null);
  const subtextRef = useRef<HTMLDivElement>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const { shouldShow: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    const lenis = new Lenis({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => { window.removeEventListener("mousemove", handleMouseMove); lenis.destroy(); };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const tl = gsap.timeline();
    tl.fromTo(badgeRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", delay: 0.3 })
      .fromTo(headlineRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, "-=0.3")
      .fromTo(subtextRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.6")
      .fromTo(buttonWrapRef.current, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" }, "-=0.4");
  }, [mounted]);

  if (!mounted) return <div className="h-screen w-screen" style={{ background: C.bg }} />;

  return (
    <div className="relative" style={{ background: C.bg }}>
      {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}
      <Navbar />

      {/* ═══════ HERO ═══════ */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
            <ambientLight intensity={0.1} />
            <StarField />
            <EnergySphere mouse={mouse} />
          </Canvas>
        </div>
        <div className="absolute inset-0 z-[1] pointer-events-none"
          style={{ background: `radial-gradient(circle at center, transparent 0%, ${C.bg} 80%)`, opacity: 0.5 }} />
        <div className="absolute bottom-0 left-0 right-0 h-40 z-[1] pointer-events-none"
          style={{ background: `linear-gradient(transparent, ${C.bg})` }} />

        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl pt-20">
          <div ref={badgeRef} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 opacity-0"
            style={{ background: `${C.orange}15`, border: `1px solid ${C.orange}30`, color: C.orange }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.orange }} />
            AI-Powered Emotional Intelligence Platform
          </div>

          <div ref={headlineRef} className="will-change-transform opacity-0">
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-light tracking-tight text-white leading-[1.1]">
              Feel. Detect.{" "}
              <span className="font-black" style={{
                background: `linear-gradient(135deg, ${C.orange}, #FF8A65)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Heal.
              </span>
            </h1>
          </div>

          <div ref={subtextRef} className="mt-6 max-w-2xl will-change-transform opacity-0">
            <p className="text-base sm:text-lg md:text-xl font-medium leading-relaxed" style={{ color: C.dim }}>
              Real-time emotion detection powered by FACS Action Units, cinematic 3D particle visualization,
              and personalized stress-relief activities — all in your browser.
            </p>
          </div>

          <div ref={buttonWrapRef} className="mt-10 flex flex-col sm:flex-row items-center gap-4 will-change-transform opacity-0">
            <button
              onClick={() => router.push("/mood-analyze")}
              className="px-10 py-4 rounded-full text-sm font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:scale-105"
              style={{ background: C.orange, color: C.bg, boxShadow: `0 0 30px ${C.orangeGlow}` }}
            >
              Start Analyzing →
            </button>
            <a href="#features"
              className="px-8 py-4 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105"
              style={{ border: `1px solid ${C.border}`, color: C.dim }}>
              Explore Features
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 z-10 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: C.muted }}>Scroll</span>
          <div className="w-5 h-8 rounded-full border flex justify-center pt-1.5" style={{ borderColor: C.muted }}>
            <div className="w-1 h-2 rounded-full" style={{ background: C.muted }} />
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.3em]" style={{ color: C.orange }}>Features</span>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold text-white">
              Everything You Need to{" "}
              <span style={{ color: C.orange }}>Understand Yourself</span>
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base" style={{ color: C.dim }}>
              A comprehensive emotion analysis and wellness platform built for the modern world.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
          </div>
        </div>
      </section>

      {/* ═══════ STATS ═══════ */}
      <section id="stats" className="py-16 px-6" style={{ background: `${C.surface}50` }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl md:text-4xl font-black" style={{ color: C.orange }}>{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.15em] font-semibold" style={{ color: C.dim }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.3em]" style={{ color: C.orange }}>Process</span>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold text-white">
              How <span style={{ color: C.orange }}>NEXUS</span> Works
            </h2>
          </div>
          <div className="space-y-10">
            {HOW_IT_WORKS.map((item, i) => <HowItWorksCard key={item.step} item={item} index={i} />)}
          </div>
        </div>
      </section>

      {/* ═══════ EXPERIENCE PREVIEW ═══════ */}
      <section className="py-28 px-6" style={{ background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgDark} 100%)` }}>
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.3em]" style={{ color: C.green }}>Experience</span>
          <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            Your Emotions, <span style={{ color: C.green }}>Visualized</span>
          </h2>
          <p className="max-w-2xl mx-auto mb-12" style={{ color: C.dim }}>
            Watch as your facial expressions transform into living particle systems,
            track Action Units in real-time, and discover patterns in your emotional landscape.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { emoji: "📹", title: "Live Camera Feed", desc: "Real-time webcam analysis with face mesh overlay and action unit bars." },
              { emoji: "🔮", title: "3D Emotion Orb", desc: "A breathing sphere that changes color and particle behavior with your mood." },
              { emoji: "🧘", title: "Relief Journey", desc: "Breathing exercises, grounding, gratitude drops, pattern tracing, and more." },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-1"
                style={{ background: `${C.surface}90`, border: `1px solid ${C.border}40` }}>
                <div className="text-3xl mb-4">{card.emoji}</div>
                <h3 className="text-white font-bold mb-2">{card.title}</h3>
                <p className="text-sm" style={{ color: C.dim }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to <span style={{ color: C.orange }}>Feel Different?</span>
          </h2>
          <p className="max-w-xl mx-auto mb-10" style={{ color: C.dim }}>
            No sign-up required. Open your camera and start understanding your emotions in seconds.
          </p>
          <button
            onClick={() => router.push("/mood-analyze")}
            className="px-12 py-5 rounded-full text-base font-bold uppercase tracking-[0.2em] transition-all duration-300 hover:scale-105"
            style={{ background: C.orange, color: C.bg, boxShadow: `0 0 40px ${C.orangeGlow}` }}
          >
            Launch NEXUS →
          </button>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="py-12 px-6 border-t" style={{ borderColor: `${C.border}30` }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black"
              style={{ background: C.orange, color: C.bg }}>N</div>
            <span className="text-sm font-bold text-white">NEXUS</span>
            <span className="text-xs ml-2" style={{ color: C.muted }}>Emotional Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/mood-analyze" className="text-xs font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Analyze</Link>
            <Link href="/relief" className="text-xs font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Relief</Link>
            <Link href="/session-results" className="text-xs font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Results</Link>
            <Link href="/dashboard" className="text-xs font-medium transition-colors hover:text-white" style={{ color: C.dim }}>Dashboard</Link>
          </div>
          <p className="text-xs" style={{ color: C.muted }}>© 2026 NEXUS · Built for Hackathon</p>
        </div>
      </footer>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        body { margin: 0; padding: 0; background: ${C.bg}; font-family: 'Inter', -apple-system, sans-serif; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .animate-bounce { animation: bounce 2s infinite; }
        .animate-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
