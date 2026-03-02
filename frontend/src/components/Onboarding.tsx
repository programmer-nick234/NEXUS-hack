"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const P = {
  bg: "#0F172A",
  surface: "#1E293B",
  border: "#475569",
  orange: "#FF5A1F",
  accent: "#818CF8",
  green: "#34D399",
  text: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
};

const STEPS = [
  {
    icon: "👋",
    title: "Welcome to NEXUS",
    desc: "Your AI-powered emotional intelligence platform. Let's walk through what you can do here.",
    tip: "This onboarding takes about 30 seconds.",
  },
  {
    icon: "📹",
    title: "Real-Time Emotion Detection",
    desc: "Open your camera and our FACS engine analyzes 15+ facial Action Units to detect your emotions — no data leaves your browser.",
    tip: "Works best in good lighting with your face clearly visible.",
  },
  {
    icon: "🔮",
    title: "Living Particle Visualization",
    desc: "Your emotions are visualized as a 3D particle system. 2000+ particles drift, wrap, and pulse in response to what you feel.",
    tip: "The orb changes color and the smoke responds to your mood.",
  },
  {
    icon: "🌿",
    title: "Stress Relief Activities",
    desc: "After each session, choose from 6 interactive exercises: breathing, grounding, gratitude, pattern tracing, and more.",
    tip: "Audio cues guide you through each activity.",
  },
  {
    icon: "🏆",
    title: "Gamification & Growth",
    desc: "Earn XP, unlock 18+ badges, build streaks, and level up as you develop emotional resilience over time.",
    tip: "Check the Dashboard to see your progress.",
  },
  {
    icon: "📝",
    title: "AI Journal & Reflection",
    desc: "Generate personalized reflections after each session — insights about your mood, stability, and actionable tips.",
    tip: "Find this in the Journal page or the dashboard.",
  },
  {
    icon: "🚀",
    title: "You're Ready!",
    desc: "Start your first emotion analysis session. No sign-up needed — just open your camera and begin.",
    tip: "Click 'Start Now' to begin your journey.",
  },
];

const STORAGE_KEY = "nexus_onboarding_complete";

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setShouldShow(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setShouldShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  const reset = useCallback(() => {
    setShouldShow(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { shouldShow, dismiss, reset };
}

export default function OnboardingOverlay({ onDismiss }: { onDismiss: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const goNext = () => {
    if (isLast) {
      onDismiss();
      router.push("/mood-analyze");
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => Math.min(s + 1, total - 1));
      setAnimating(false);
    }, 200);
  };

  const goBack = () => {
    if (step > 0) {
      setAnimating(true);
      setTimeout(() => {
        setStep((s) => s - 1);
        setAnimating(false);
      }, 200);
    }
  };

  const skip = () => {
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(2, 6, 23, 0.85)", backdropFilter: "blur(12px)" }}>
      <div
        className="relative w-full max-w-md mx-4 rounded-3xl overflow-hidden"
        style={{ background: P.surface, border: `1px solid ${P.border}40` }}
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i === step ? P.orange : i < step ? P.green : `${P.border}80`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div
          className="px-8 pt-8 pb-6 text-center transition-all duration-200"
          style={{ opacity: animating ? 0 : 1, transform: animating ? "translateY(10px)" : "translateY(0)" }}
        >
          <div className="text-5xl mb-5">{current.icon}</div>
          <h2 className="text-xl font-black mb-3" style={{ color: P.text }}>{current.title}</h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: P.dim }}>{current.desc}</p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium"
            style={{ background: `${P.orange}10`, color: P.orange, border: `1px solid ${P.orange}20` }}>
            💡 {current.tip}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <div>
            {step > 0 ? (
              <button onClick={goBack} className="text-xs font-medium transition-colors" style={{ color: P.muted }}>
                ← Back
              </button>
            ) : (
              <button onClick={skip} className="text-xs font-medium transition-colors" style={{ color: P.muted }}>
                Skip
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono" style={{ color: P.muted }}>
              {step + 1}/{total}
            </span>
            <button
              onClick={goNext}
              className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: isLast ? P.green : P.orange, color: isLast ? P.bg : P.bg }}
            >
              {isLast ? "Start Now →" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
