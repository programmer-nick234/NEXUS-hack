"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════════════════════
   PALETTE
   ═══════════════════════════════════════════════════════════════════════════ */
const C = {
  bg: "#0F172A",
  orange: "#FF5A1F",
  amber: "#F59E0B",
  amberDim: "#92400E",
  white: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
  surface: "#1E293B",
  border: "#334155",
};

/* ═══════════════════════════════════════════════════════════════════════════
   THREE.JS COMPONENTS (memoized)
   ═══════════════════════════════════════════════════════════════════════════ */

const HeroOrb = memo(function HeroOrb({ mouse }: { mouse: React.RefObject<{ x: number; y: number }> }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.PointLight>(null!);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    const sc = 1 + Math.sin(t * 1.2) * 0.05;
    mesh.current.scale.set(sc, sc, sc);
    mesh.current.rotation.y = t * 0.25;
    mesh.current.rotation.x = t * 0.12;
    const m = mouse.current ?? { x: 0, y: 0 };
    mesh.current.position.x += (m.x * 0.4 - mesh.current.position.x) * 0.04;
    mesh.current.position.y += (-m.y * 0.4 - mesh.current.position.y) * 0.04;
    if (glow.current) glow.current.intensity = 2.2 + Math.sin(t * 2) * 0.8;
  });

  return (
    <group>
      <pointLight ref={glow} position={[0, 0, 2]} color={C.orange} intensity={2.2} distance={12} />
      <Sphere ref={mesh} args={[1.2, 64, 64]}>
        <MeshDistortMaterial color={C.orange} emissive={C.amberDim} emissiveIntensity={0.7} speed={2.5} distort={0.38} roughness={0.15} />
      </Sphere>
    </group>
  );
});

const Smoke = memo(function Smoke() {
  const ref = useRef<THREE.Points>(null!);
  const count = 900;
  const pos = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.random() * 3;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.random() * Math.PI;
      p[i * 3] = r * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      p[i * 3 + 2] = r * Math.cos(ph);
    }
    return p;
  }, []);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.07;
    ref.current.rotation.x = t * 0.035;
  });

  return (
    <Points ref={ref} positions={pos} stride={3} frustumCulled={false}>
      <PointMaterial transparent color={C.amber} size={0.018} sizeAttenuation depthWrite={false} opacity={0.22} />
    </Points>
  );
});

const Wire = memo(function Wire() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((s) => {
    ref.current.rotation.y = s.clock.getElapsedTime() * 0.18;
    ref.current.rotation.x = s.clock.getElapsedTime() * 0.09;
  });
  return (
    <Sphere ref={ref} args={[1.5, 32, 32]}>
      <meshBasicMaterial color={C.orange} wireframe transparent opacity={0.25} />
    </Sphere>
  );
});

const FieldPts = memo(function FieldPts() {
  const ref = useRef<THREE.Points>(null!);
  const count = 1400;
  const pos = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 14;
      p[i * 3 + 1] = (Math.random() - 0.5) * 7;
      p[i * 3 + 2] = (Math.random() - 0.5) * 7;
    }
    return p;
  }, []);
  useFrame((s) => { ref.current.rotation.y = s.clock.getElapsedTime() * 0.025; });
  return (
    <Points ref={ref} positions={pos} stride={3} frustumCulled={false}>
      <PointMaterial transparent color={C.orange} size={0.013} sizeAttenuation depthWrite={false} opacity={0.28} />
    </Points>
  );
});

const Wheel = memo(function Wheel({ mouse }: { mouse: React.RefObject<{ x: number; y: number }> }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    const m = mouse.current ?? { x: 0, y: 0 };
    g.current.rotation.z = t * 0.4 + m.x * 0.6;
    g.current.rotation.x = m.y * 0.35;
    const sc = 1 + Math.sin(t * 1.5) * 0.025;
    g.current.scale.set(sc, sc, sc);
  });
  return (
    <group ref={g}>
      <pointLight position={[0, 0, 2]} color={C.orange} intensity={1.8} distance={9} />
      <mesh><torusGeometry args={[1.5, 0.035, 16, 120]} /><meshBasicMaterial color={C.orange} /></mesh>
      <mesh rotation-z={0.6}><torusGeometry args={[1.1, 0.018, 16, 90]} /><meshBasicMaterial color={C.amber} transparent opacity={0.45} /></mesh>
      <mesh rotation-z={-0.9}><torusGeometry args={[0.7, 0.012, 16, 70]} /><meshBasicMaterial color={C.orange} transparent opacity={0.25} /></mesh>
    </group>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAGNETIC BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */

function MagneticCTA({ label, onClick }: { label: string; onClick: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const rippleRef = useRef<HTMLDivElement>(null);

  // Magnetic pull on mouse move
  useEffect(() => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    if (!wrap || !btn) return;

    const handleMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        const pull = (1 - dist / 150) * 0.4;
        gsap.to(btn, { x: dx * pull, y: dy * pull, duration: 0.3, ease: "power3.out" });
        setHovered(true);
      } else {
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
        setHovered(false);
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  // Hover frames stagger
  useEffect(() => {
    if (!framesRef.current) return;
    const frames = framesRef.current.children;
    if (hovered) {
      gsap.to(frames, { opacity: 1, y: 0, scale: 1, stagger: 0.08, duration: 0.5, ease: "power3.out" });
    } else {
      gsap.to(frames, { opacity: 0, y: 20, scale: 0.85, stagger: 0.04, duration: 0.3, ease: "power2.in" });
    }
  }, [hovered]);

  // Press animation
  const handlePress = useCallback(() => {
    if (!btnRef.current || !rippleRef.current) return;
    setPressed(true);

    const tl = gsap.timeline({
      onComplete: () => {
        setPressed(false);
        onClick();
      },
    });

    tl.to(btnRef.current, { scale: 0.92, duration: 0.1, ease: "power2.in" })
      .to(btnRef.current, { boxShadow: `0 0 60px ${C.orange}, 0 0 120px ${C.orange}60`, duration: 0.15 }, "<")
      .to(rippleRef.current, { scale: 8, opacity: 0, duration: 0.6, ease: "power2.out" }, "<0.05")
      .to(btnRef.current, { scale: 1, duration: 0.3, ease: "elastic.out(1,0.5)" }, "<0.2")
      .to("body", { opacity: 0.7, duration: 0.15 }, "<")
      .to("body", { opacity: 1, duration: 0.25 }, ">0.05");
  }, [onClick]);

  const frameImgs = ["/previews/emotion.png", "/previews/gesture.png", "/previews/breathing.png", "/previews/report.png"];

  return (
    <div ref={wrapRef} className="relative inline-block mt-12">
      {/* Hover preview frames */}
      <div ref={framesRef} className="absolute -top-48 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-none z-0">
        {frameImgs.map((src, i) => (
          <div
            key={src}
            className="w-20 h-14 rounded-lg overflow-hidden shadow-2xl"
            style={{
              opacity: 0,
              transform: `translateY(20px) scale(0.85) rotate(${(i - 1.5) * 4}deg)`,
              border: `1px solid ${C.orange}40`,
            }}
          >
            <Image src={src} alt="" width={80} height={56} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      {/* Button */}
      <button
        ref={btnRef}
        onClick={handlePress}
        className="relative px-10 py-4 rounded-full text-sm font-bold uppercase tracking-[0.2em] cursor-pointer overflow-hidden"
        style={{
          background: C.orange,
          color: C.bg,
          boxShadow: hovered ? `0 0 40px ${C.orange}90, 0 0 80px ${C.orange}30` : `0 0 20px ${C.orange}40`,
          border: `2px solid transparent`,
          transition: "box-shadow 0.3s ease",
        }}
      >
        {/* Neon border animation */}
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: `2px solid ${C.orange}`,
            opacity: hovered ? 0.8 : 0,
            transition: "opacity 0.3s",
            animation: hovered ? "spin 3s linear infinite" : "none",
          }}
        />
        {label}
        {/* Ripple element */}
        <div
          ref={rippleRef}
          className="absolute w-4 h-4 rounded-full pointer-events-none"
          style={{ background: `${C.orange}50`, top: "50%", left: "50%", transform: "translate(-50%,-50%) scale(0)", opacity: 0.8 }}
        />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STAGGERED TEXT REVEAL
   ═══════════════════════════════════════════════════════════════════════════ */

function StaggerHeadline({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chars = ref.current.querySelectorAll("span");
    gsap.from(chars, { opacity: 0, y: 30, stagger: 0.025, duration: 0.6, ease: "power3.out", delay: 0.3 });
  }, []);

  const words = text.split(" ");
  return (
    <h1 ref={ref} className={className}>
      {words.map((word, wi) => (
        <React.Fragment key={wi}>
          {wi > 0 && " "}
          {word.split("").map((ch, ci) => (
            <span key={`${wi}-${ci}`} className="inline-block">{ch}</span>
          ))}
        </React.Fragment>
      ))}
    </h1>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOATING UI CARDS
   ═══════════════════════════════════════════════════════════════════════════ */

function FloatingCards() {
  const cardsData = [
    { label: "Emotion Engine", x: "-45%", y: "-60%", delay: 0 },
    { label: "Gesture AI", x: "45%", y: "-40%", delay: 0.15 },
    { label: "Live Analysis", x: "-50%", y: "50%", delay: 0.3 },
    { label: "Intervention", x: "48%", y: "55%", delay: 0.45 },
  ];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cards = ref.current.children;
    gsap.from(cards, { opacity: 0, y: 40, scale: 0.8, stagger: 0.15, duration: 0.8, ease: "back.out(1.4)", delay: 0.8 });
    gsap.to(cards, { y: "+=8", duration: 3, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.3 });
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 z-[5] pointer-events-none">
      {cardsData.map((c) => (
        <div
          key={c.label}
          className="absolute top-1/2 left-1/2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest"
          style={{
            transform: `translate(${c.x}, ${c.y})`,
            background: `${C.surface}DD`,
            border: `1px solid ${C.border}`,
            color: C.dim,
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          {c.label}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLOWING DIVIDER
   ═══════════════════════════════════════════════════════════════════════════ */

function GlowDivider() {
  return (
    <div className="w-full flex justify-center py-4">
      <div className="w-32 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${C.orange}80, transparent)` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  const heroRef = useRef<HTMLElement>(null);
  const heroOrbRef = useRef<HTMLDivElement>(null);
  const heroTxtRef = useRef<HTMLDivElement>(null);
  const s2Ref = useRef<HTMLElement>(null);
  const s2TxtRef = useRef<HTMLDivElement>(null);
  const s3Ref = useRef<HTMLElement>(null);
  const s3Wrap = useRef<HTMLDivElement>(null);
  const s4Ref = useRef<HTMLElement>(null);
  const s5Ref = useRef<HTMLElement>(null);
  const s5Txt = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Mouse
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Lenis
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.4, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);
    return () => lenis.destroy();
  }, []);

  // GSAP ScrollTrigger
  useEffect(() => {
    if (!mounted) return;
    const ctx = gsap.context(() => {
      // Hero parallax out
      if (heroOrbRef.current) {
        gsap.to(heroOrbRef.current, { scale: 0.3, opacity: 0, scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1.2 } });
      }
      if (heroTxtRef.current) {
        gsap.to(heroTxtRef.current, { y: -80, opacity: 0, scrollTrigger: { trigger: heroRef.current, start: "25% top", end: "65% top", scrub: 1 } });
      }

      // S2: text from right
      if (s2TxtRef.current) {
        gsap.from(s2TxtRef.current, { x: 150, opacity: 0, scrollTrigger: { trigger: s2Ref.current, start: "top 80%", end: "top 25%", scrub: 1.2 } });
      }

      // S3: horizontal scroll
      if (s3Wrap.current && s3Ref.current) {
        const sw = s3Wrap.current.scrollWidth - window.innerWidth;
        gsap.to(s3Wrap.current, {
          x: -sw, ease: "none",
          scrollTrigger: { trigger: s3Ref.current, pin: true, start: "top top", end: () => `+=${sw}`, scrub: 1.5, invalidateOnRefresh: true },
        });
      }

      // S5: CTA reveal
      if (s5Txt.current) {
        gsap.from(s5Txt.current, { y: 100, opacity: 0, scale: 0.95, scrollTrigger: { trigger: s5Ref.current, start: "top 80%", end: "top 35%", scrub: 1 } });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [mounted]);

  const goto = useCallback(() => router.push("/mood-analyze"), [router]);

  if (!mounted) return <div className="h-screen w-screen" style={{ background: C.bg }} />;

  return (
    <div ref={containerRef} className="overflow-x-hidden" style={{ background: C.bg, color: C.white }}>

      {/* ═══════ S1 — HERO ═══════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* 3D orb */}
        <div ref={heroOrbRef} className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.12} />
            <HeroOrb mouse={mouse} />
            <Smoke />
          </Canvas>
        </div>

        {/* Floating UI cards */}
        <FloatingCards />

        {/* Light beam */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] z-[2] pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent 5%, ${C.orange}50 35%, ${C.orange} 50%, ${C.orange}50 65%, transparent 95%)` }} />

        {/* Text */}
        <div ref={heroTxtRef} className="relative z-10 text-center px-6 max-w-3xl flex flex-col items-center">
          <StaggerHeadline
            text="Experience Emotion Through Interaction"
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1]"
          />
          <p className="mt-6 text-lg md:text-xl max-w-xl" style={{ color: C.dim }}>
            AI-powered emotional detection meets physical UI.
          </p>
          <MagneticCTA label="Get Started →" onClick={goto} />
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <div className="w-5 h-9 rounded-full border-2 flex items-start justify-center pt-1.5" style={{ borderColor: C.muted }}>
            <div className="w-1 h-2 rounded-full animate-bounce" style={{ background: C.orange }} />
          </div>
          <span className="text-[9px] uppercase tracking-[0.3em] font-bold" style={{ color: C.muted }}>Scroll</span>
        </div>
      </section>

      <GlowDivider />

      {/* ═══════ S2 — WHAT WE BUILT ══════════════════════════════════════ */}
      <section ref={s2Ref} className="min-h-screen flex items-center py-28 px-6">
        <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-16 items-center">
          <div className="aspect-square max-w-md mx-auto w-full">
            <Canvas camera={{ position: [0, 0, 4] }}>
              <ambientLight intensity={0.25} />
              <pointLight position={[3, 3, 3]} color={C.orange} intensity={1.2} />
              <Wire />
            </Canvas>
          </div>
          <div ref={s2TxtRef}>
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: C.orange }}>Wildcard #2</p>
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-8">
              Alternative UI for <span style={{ color: C.orange }}>Mental States</span>
            </h2>
            <div className="space-y-5 text-base leading-relaxed" style={{ color: C.dim }}>
              <p>OpenCV-powered real-time emotion detection captures your face and reads your mood — no text, no forms.</p>
              <p>Gesture-based anxiety tracking analyzes your swipe behavior to detect stress patterns through movement speed, direction changes, and hold duration.</p>
              <p>The system responds with real-time visual feedback: breathing animations, color shifts, and particle dynamics — all driven by your emotional state.</p>
              <p className="font-semibold" style={{ color: C.amber }}>Fully interaction-based. Zero typing required.</p>
            </div>
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ═══════ S3 — HOW IT WORKS ═══════════════════════════════════════ */}
      <section ref={s3Ref} className="relative h-screen overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 5] }}><FieldPts /></Canvas>
        </div>
        <div ref={s3Wrap} className="relative z-10 h-full flex items-center gap-10 px-16 will-change-transform" style={{ width: "fit-content" }}>
          <div className="w-[38vw] min-w-[300px] shrink-0 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: C.orange }}>How It Works</p>
            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Three-Stage <span style={{ color: C.orange }}>Pipeline</span>
            </h2>
          </div>
          {[
            { n: "01", title: "Face Detection", desc: "OpenCV captures your webcam feed and DeepFace analyzes facial micro-expressions in real-time to identify your emotional state.", icon: "👁️" },
            { n: "02", title: "Gesture Behavior Analysis", desc: "Your swipe speed, direction changes, hold duration, and movement variance are captured and sent to the anxiety scoring engine.", icon: "🖐️" },
            { n: "03", title: "Real-Time Emotional Intervention", desc: "The system responds with breathing animations, color therapy, and particle dynamics calibrated to your detected anxiety level.", icon: "🧘" },
          ].map((card) => (
            <div
              key={card.n}
              className="w-[380px] shrink-0 rounded-3xl p-8 flex flex-col gap-5 transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1"
              style={{
                background: `${C.surface}DD`,
                border: `1px solid ${C.border}`,
                boxShadow: `inset 0 0 30px ${C.orange}06`,
                backdropFilter: "blur(10px)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.orange; e.currentTarget.style.boxShadow = `0 0 35px ${C.orange}18, inset 0 0 30px ${C.orange}0A`; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = `inset 0 0 30px ${C.orange}06`; }}
            >
              <span className="text-5xl">{card.icon}</span>
              <div>
                <span className="text-xs font-bold tracking-widest" style={{ color: C.orange }}>STEP {card.n}</span>
                <h3 className="text-2xl font-extrabold mt-1">{card.title}</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{card.desc}</p>
            </div>
          ))}
          <div className="w-[10vw] shrink-0" />
        </div>
      </section>

      <GlowDivider />

      {/* ═══════ S4 — ENERGY WHEEL ═══════════════════════════════════════ */}
      <section ref={s4Ref} className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 4] }}>
            <ambientLight intensity={0.08} />
            <Wheel mouse={mouse} />
            <Smoke />
          </Canvas>
        </div>
        <div className="relative z-10 text-center px-6 max-w-2xl pointer-events-none">
          <p className="text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: C.orange }}>Interactive Energy</p>
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Move Your Cursor. <span style={{ color: C.orange }}>Feel the Response.</span>
          </h2>
          <p className="mt-5" style={{ color: C.dim }}>
            The energy wheel reacts to your movement — a glimpse into how our Alternative UI reads interaction patterns.
          </p>
        </div>
      </section>

      <GlowDivider />

      {/* ═══════ S5 — FINAL CTA ══════════════════════════════════════════ */}
      <section ref={s5Ref} className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0" style={{
          background: `radial-gradient(ellipse at center, ${C.orange}10 0%, transparent 65%)`,
          animation: "pulse 4s ease-in-out infinite alternate",
        }} />
        <div ref={s5Txt} className="relative z-10 text-center px-6 max-w-3xl flex flex-col items-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
            Ready to Experience the Future of{" "}
            <span style={{ color: C.orange, textShadow: `0 0 30px ${C.orange}60` }}>Emotional UI</span>?
          </h2>
          <p className="mt-6 text-lg" style={{ color: C.dim }}>No forms. No text. Just your presence and movement.</p>
          <MagneticCTA label="Enter Mood Analyzer" onClick={goto} />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
        © {new Date().getFullYear()} Nexus Platform · Wildcard #2: Alternative UI · Built for Hackathon
      </footer>

      {/* Global keyframes */}
      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { opacity: 0.3; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
