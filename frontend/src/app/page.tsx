"use client";

import dynamic from "next/dynamic";
import { SectionReveal, StaggerText, Parallax, HeroIntro } from "@/components/animations";

// SSR-safe dynamic import for Three.js heavy components
const HeroScene = dynamic(() => import("@/components/three/HeroSceneClient"), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  ),
});

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <HeroIntro>
        <section className="relative h-screen flex flex-col items-center justify-center">
          <div className="absolute inset-0 z-0">
            <HeroScene />
          </div>
          <div className="relative z-10 text-center px-4">
            <StaggerText
              text="Welcome to Nexus"
              tag="h1"
              className="text-5xl md:text-7xl font-bold tracking-tight"
            />
            <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Production-grade intelligent SaaS platform with real-time face
              detection, role-based access, and cinematic experiences.
            </p>
          </div>
        </section>
      </HeroIntro>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="py-32 px-6 max-w-6xl mx-auto">
        <SectionReveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">
            Built for Scale
          </h2>
        </SectionReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Face Detection",
              desc: "AI-powered real-time face analysis and emotion detection.",
            },
            {
              title: "Role-Based Access",
              desc: "Granular permissions for students, mentors, admins, and superadmins.",
            },
            {
              title: "Cinematic UI",
              desc: "Scroll-driven 3D animations, smooth scrolling, and parallax effects.",
            },
          ].map((feature, i) => (
            <SectionReveal key={feature.title} delay={i * 0.15}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition-colors">
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </section>

      {/* ── Parallax Showcase ─────────────────────────────────── */}
      <section className="relative py-32 overflow-hidden">
        <Parallax speed={-30} className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-gradient-to-b from-indigo-600/40 to-transparent" />
        </Parallax>
        <div className="relative z-10 text-center px-6">
          <SectionReveal>
            <h2 className="text-3xl md:text-5xl font-bold">
              Designed for 100K+ Users
            </h2>
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
              Rate limiting, JWT refresh flows, MongoDB indexing, and async
              processing — engineered from the ground up for scale.
            </p>
          </SectionReveal>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} Nexus Platform. All rights reserved.
      </footer>
    </main>
  );
}
