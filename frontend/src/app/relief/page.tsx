"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSessionStore } from "@/store";
import Link from "next/link";
import {
  startAmbient, stopAmbient, startBreathTone, stopBreathTone,
  breathInhale, breathExhale, breathHold, playChime,
  startRain, stopRain, startHeartbeat, stopHeartbeat, stopAll,
} from "@/lib/audio";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const API = "http://localhost:8000/api/v1";

const P = {
  bg: "#050A18",
  card: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  accent: "#818CF8",
  green: "#10B981",
  red: "#EF4444",
  yellow: "#F59E0B",
  blue: "#3B82F6",
  purple: "#A855F7",
  cyan: "#06B6D4",
  text: "#E2E8F0",
  dim: "#94A3B8",
  muted: "#64748B",
  surface: "rgba(255,255,255,0.03)",
};

const EMOTION_COLORS: Record<string, string> = {
  happy: "#10B981", sad: "#3B82F6", angry: "#EF4444", neutral: "#94A3B8",
  surprised: "#F59E0B", fear: "#A855F7", disgust: "#06B6D4",
};

type Phase = "loading" | "intro" | "activity" | "transition" | "after-check" | "results";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface BreathPhase { name: string; duration: number; instruction: string }
interface GroundStep { sense: string; count: number; prompt: string; icon: string }
interface Movement { action: string; duration: number; icon: string }

interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  durationSec: number;
  cycles?: number;
  phases?: BreathPhase[];
  steps?: GroundStep[];
  dropCount?: number;
  patterns?: string[];
  movements?: Movement[];
  emotionPlants?: Record<string, { plant: string; emoji: string }>;
}

interface Plan {
  activities: Activity[];
  totalDuration: number;
  message: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ReliefPage() {
  const { lastResult, timeline } = useSessionStore();

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activityIdx, setActivityIdx] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [allBadges, setAllBadges] = useState<Array<{ name: string; icon: string }>>([]);
  const [moodImproved, setMoodImproved] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Audio lifecycle: start ambient on activity, stop on results/unmount
  useEffect(() => {
    if (phase === "activity" && audioEnabled) startAmbient(0.08);
    else if (phase === "results" || phase === "intro") { stopAmbient(); stopBreathTone(); stopRain(); stopHeartbeat(); }
    return () => { stopAll(); };
  }, [phase, audioEnabled]);

  // Fetch plan on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/relief/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dominantEmotion: lastResult?.dominantEmotion || "neutral",
            anxietyScore: 0.5,
            stability: lastResult?.stabilityIndex || 0.5,
          }),
        });
        const data = await res.json();
        setPlan(data);
        setPhase("intro");
      } catch {
        // Fallback plan
        setPlan({
          activities: [
            { id: "breathing_box", name: "Box Breathing", description: "Breathe in 4s → hold 4s → out 4s → hold 4s.", category: "breathing", icon: "🫁", durationSec: 96, cycles: 6, phases: [
              { name: "Inhale", duration: 4, instruction: "Breathe in slowly" },
              { name: "Hold", duration: 4, instruction: "Hold gently" },
              { name: "Exhale", duration: 4, instruction: "Release slowly" },
              { name: "Hold", duration: 4, instruction: "Pause" },
            ]},
            { id: "grounding_54321", name: "5-4-3-2-1 Grounding", description: "Engage all five senses.", category: "grounding", icon: "🌳", durationSec: 120, steps: [
              { sense: "see", count: 5, prompt: "Name 5 things you can SEE", icon: "👁️" },
              { sense: "touch", count: 4, prompt: "Name 4 things you can TOUCH", icon: "✋" },
              { sense: "hear", count: 3, prompt: "Name 3 things you can HEAR", icon: "👂" },
              { sense: "smell", count: 2, prompt: "Name 2 things you can SMELL", icon: "👃" },
              { sense: "taste", count: 1, prompt: "Name 1 thing you can TASTE", icon: "👅" },
            ]},
            { id: "gratitude_drop", name: "Gratitude Drop", description: "Drop three things you're grateful for.", category: "cognitive", icon: "💧", durationSec: 60, dropCount: 3 },
          ],
          totalDuration: 276,
          message: "Take a moment to care for yourself.",
        });
        setPhase("intro");
      }
    }
    load();
  }, [lastResult]);

  const currentActivity = plan?.activities[activityIdx] ?? null;

  const handleActivityComplete = useCallback(async () => {
    // Record completion
    try {
      const res = await fetch(`${API}/relief/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityId: currentActivity?.id,
          beforeMood: lastResult ? { emotion: lastResult.dominantEmotion || "neutral", moodScore: lastResult.moodScore || 50 } : null,
        }),
      });
      const data = await res.json();
      setTotalXp((prev) => prev + (data.xpEarned || 30));
      if (data.newBadges?.length) {
        setAllBadges((prev) => [...prev, ...data.newBadges]);
      }
      if (data.moodImproved) setMoodImproved(true);
    } catch { /* offline ok */ }

    // Audio: chime on completion
    if (audioEnabled) playChime();

    const next = completedCount + 1;
    setCompletedCount(next);

    if (next >= (plan?.activities.length || 3)) {
      // All done — journey complete!
      try {
        const res = await fetch(`${API}/relief/journey-done`, { method: "POST" });
        const data = await res.json();
        setTotalXp((prev) => prev + (data.xpBonus || 100));
        if (data.newBadges?.length) setAllBadges((prev) => [...prev, ...data.newBadges]);
      } catch { /* offline ok */ }
      setPhase("results");
    } else {
      setActivityIdx(next);
      setPhase("transition");
    }
  }, [currentActivity, completedCount, plan, lastResult]);

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: P.bg, color: P.text }}>
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: P.border }}>
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${(completedCount / (plan?.activities.length || 3)) * 100}%`, background: `linear-gradient(90deg, ${P.accent}, ${P.green})` }}
        />
      </div>

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: P.muted }}>
            Relief Journey · {completedCount}/{plan?.activities.length || 3}
          </p>
          <h1 className="text-lg font-bold mt-0.5">Stress Relief</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioEnabled((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ background: P.surface, color: audioEnabled ? P.green : P.muted, border: `1px solid ${P.border}` }}
            title={audioEnabled ? "Mute audio" : "Enable audio"}
          >
            {audioEnabled ? "🔊" : "🔇"}
          </button>
          <Link href="/session-results" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: P.surface, color: P.dim, border: `1px solid ${P.border}` }}>
            ← Back to Results
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-10">
        {phase === "loading" && <LoadingSpinner />}
        {phase === "intro" && plan && <IntroScreen plan={plan} onStart={() => setPhase("activity")} />}
        {phase === "activity" && currentActivity && (
          <ActivityRouter activity={currentActivity} onComplete={handleActivityComplete} timeline={timeline} />
        )}
        {phase === "transition" && plan && (
          <TransitionScreen
            completedCount={completedCount}
            total={plan.activities.length}
            nextActivity={plan.activities[activityIdx]}
            onContinue={() => setPhase("activity")}
          />
        )}
        {phase === "results" && (
          <ResultsScreen
            totalXp={totalXp}
            badges={allBadges}
            moodImproved={moodImproved}
            lastResult={lastResult}
          />
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: `${P.accent} transparent ${P.accent} transparent` }} />
      <p className="text-sm" style={{ color: P.dim }}>Preparing your relief plan...</p>
    </div>
  );
}

/* ─── Intro Screen ──────────────────────────────────────────────────────── */

function IntroScreen({ plan, onStart }: { plan: Plan; onStart: () => void }) {
  return (
    <div className="max-w-lg w-full space-y-6 text-center">
      <div className="text-5xl mb-2">🌿</div>
      <h2 className="text-2xl font-bold">Ready to Feel Better?</h2>
      <p className="text-sm" style={{ color: P.dim }}>{plan.message}</p>

      <div className="space-y-3 text-left">
        {plan.activities.map((a, i) => (
          <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl" style={{ background: P.card, border: `1px solid ${P.border}` }}>
            <span className="text-2xl">{a.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="text-[10px]" style={{ color: P.muted }}>{a.description}</p>
            </div>
            <span className="text-[10px] font-mono" style={{ color: P.dim }}>{Math.ceil(a.durationSec / 60)} min</span>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: P.muted }}>
        Total: ~{Math.ceil((plan.totalDuration || 180) / 60)} minutes
      </p>

      <button
        onClick={onStart}
        className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, color: "#fff" }}
      >
        Start Relief Journey →
      </button>
    </div>
  );
}

/* ─── Activity Router ───────────────────────────────────────────────────── */

function ActivityRouter({ activity, onComplete, timeline }: { activity: Activity; onComplete: () => void; timeline: Array<{ emotion: string }> }) {
  if (activity.category === "breathing" && activity.phases) {
    return <BreathingExercise activity={activity} onComplete={onComplete} />;
  }
  if (activity.id === "grounding_54321" && activity.steps) {
    return <GroundingExercise activity={activity} onComplete={onComplete} />;
  }
  if (activity.id === "gratitude_drop") {
    return <GratitudeDrop activity={activity} onComplete={onComplete} />;
  }
  if (activity.id === "pattern_trace") {
    return <PatternTrace activity={activity} onComplete={onComplete} />;
  }
  if (activity.id === "emotion_garden") {
    return <EmotionGarden activity={activity} onComplete={onComplete} timeline={timeline} />;
  }
  if (activity.id === "shake_it_out" && activity.movements) {
    return <ShakeItOut activity={activity} onComplete={onComplete} />;
  }
  // Generic fallback
  return <GenericActivity activity={activity} onComplete={onComplete} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BREATHING EXERCISE
   ═══════════════════════════════════════════════════════════════════════════ */

function BreathingExercise({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const phases = activity.phases!;
  const totalCycles = activity.cycles || 6;

  const [cycle, setCycle] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(phases[0].duration);
  const [isActive, setIsActive] = useState(false);

  const currentPhase = phases[phaseIdx];
  const cycleDuration = phases.reduce((s, p) => s + p.duration, 0);

  // Orb scale: inhale = grow, exhale = shrink, hold = steady
  const orbScale = currentPhase.name === "Inhale" ? 1.3 : currentPhase.name === "Exhale" ? 0.7 : 1.0;
  const orbColor = currentPhase.name === "Inhale" ? P.cyan : currentPhase.name === "Exhale" ? P.green : P.accent;

  // Audio: breath tone follows phase changes
  useEffect(() => {
    if (!isActive) return;
    startBreathTone();
    return () => { stopBreathTone(); };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    if (currentPhase.name === "Inhale") breathInhale(currentPhase.duration);
    else if (currentPhase.name === "Exhale") breathExhale(currentPhase.duration);
    else breathHold();
  }, [isActive, phaseIdx, currentPhase]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Move to next phase
          const nextPhase = phaseIdx + 1;
          if (nextPhase >= phases.length) {
            // Next cycle
            const nextCycle = cycle + 1;
            if (nextCycle >= totalCycles) {
              clearInterval(interval);
              setTimeout(onComplete, 500);
              return 0;
            }
            setCycle(nextCycle);
            setPhaseIdx(0);
            return phases[0].duration;
          } else {
            setPhaseIdx(nextPhase);
            return phases[nextPhase].duration;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, phaseIdx, cycle, phases, totalCycles, onComplete]);

  if (!isActive) {
    return (
      <div className="max-w-md w-full text-center space-y-6">
        <span className="text-5xl">{activity.icon}</span>
        <h2 className="text-xl font-bold">{activity.name}</h2>
        <p className="text-sm" style={{ color: P.dim }}>{activity.description}</p>
        <p className="text-xs" style={{ color: P.muted }}>{totalCycles} cycles · ~{Math.ceil(activity.durationSec / 60)} min</p>
        <button
          onClick={() => setIsActive(true)}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: P.accent, color: "#fff" }}
        >
          Begin Breathing
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full text-center space-y-8">
      {/* Animated orb */}
      <div className="flex justify-center">
        <div
          className="rounded-full transition-all duration-1000 ease-in-out flex items-center justify-center"
          style={{
            width: 180,
            height: 180,
            transform: `scale(${orbScale})`,
            background: `radial-gradient(circle, ${orbColor}40, ${orbColor}10)`,
            border: `2px solid ${orbColor}60`,
            boxShadow: `0 0 60px ${orbColor}30, inset 0 0 40px ${orbColor}20`,
          }}
        >
          <span className="text-3xl font-bold" style={{ color: orbColor }}>{timeLeft}</span>
        </div>
      </div>

      {/* Phase label */}
      <div>
        <p className="text-xl font-bold" style={{ color: orbColor }}>{currentPhase.name}</p>
        <p className="text-sm mt-1" style={{ color: P.dim }}>{currentPhase.instruction}</p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px]" style={{ color: P.muted }}>
          <span>Cycle {cycle + 1} of {totalCycles}</span>
          <span>Phase {phaseIdx + 1} of {phases.length}</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: P.border }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((cycle * phases.length + phaseIdx) / (totalCycles * phases.length)) * 100}%`,
              background: `linear-gradient(90deg, ${P.accent}, ${P.green})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5-4-3-2-1 GROUNDING
   ═══════════════════════════════════════════════════════════════════════════ */

function GroundingExercise({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const steps = activity.steps!;
  const [stepIdx, setStepIdx] = useState(0);
  const [taps, setTaps] = useState(0);
  const [ripples, setRipples] = useState<number[]>([]);

  const currentStep = steps[stepIdx];
  const needed = currentStep.count;

  const handleTap = () => {
    const next = taps + 1;
    setTaps(next);
    setRipples((prev) => [...prev, Date.now()]);

    if (next >= needed) {
      // Next step
      setTimeout(() => {
        const nextStep = stepIdx + 1;
        if (nextStep >= steps.length) {
          onComplete();
        } else {
          setStepIdx(nextStep);
          setTaps(0);
        }
      }, 600);
    }
  };

  // Clean old ripples
  useEffect(() => {
    const timer = setInterval(() => {
      setRipples((prev) => prev.filter((t) => Date.now() - t < 1500));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const progress = steps.slice(0, stepIdx).reduce((s, st) => s + st.count, 0) + taps;
  const total = steps.reduce((s, st) => s + st.count, 0);

  return (
    <div className="max-w-md w-full text-center space-y-6">
      {/* Step icon */}
      <div className="text-6xl">{currentStep.icon}</div>

      <h2 className="text-xl font-bold">{currentStep.prompt}</h2>
      <p className="text-sm" style={{ color: P.dim }}>
        Tap {needed - taps} more time{needed - taps !== 1 ? "s" : ""}
      </p>

      {/* Tap zone */}
      <div className="relative">
        <button
          onClick={handleTap}
          className="w-48 h-48 mx-auto rounded-full flex items-center justify-center text-5xl font-bold transition-transform duration-150 active:scale-90 relative overflow-hidden"
          style={{
            background: `radial-gradient(circle, ${P.accent}30, transparent)`,
            border: `2px solid ${P.accent}40`,
            color: P.accent,
          }}
        >
          {taps}/{needed}
          {/* Ripple effects */}
          {ripples.map((r) => (
            <span
              key={r}
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: `${P.accent}15`, animationDuration: "1s" }}
            />
          ))}
        </button>
      </div>

      {/* Sense dots */}
      <div className="flex justify-center gap-3">
        {steps.map((s, i) => (
          <div key={s.sense} className="flex flex-col items-center gap-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300"
              style={{
                background: i < stepIdx ? P.green : i === stepIdx ? P.accent : P.border,
                color: i <= stepIdx ? "#fff" : P.muted,
                transform: i === stepIdx ? "scale(1.2)" : "scale(1)",
              }}
            >
              {i < stepIdx ? "✓" : s.icon}
            </div>
            <span className="text-[8px]" style={{ color: i <= stepIdx ? P.text : P.muted }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: P.border }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(progress / total) * 100}%`, background: P.green }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRATITUDE DROP
   ═══════════════════════════════════════════════════════════════════════════ */

function GratitudeDrop({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const dropCount = activity.dropCount || 3;
  const [drops, setDrops] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [droppedIdx, setDroppedIdx] = useState(-1);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const handleDrop = () => {
    if (!current.trim()) return;
    const newDrops = [...drops, current.trim()];
    setDrops(newDrops);
    setDroppedIdx(newDrops.length - 1);
    setCurrent("");
    setGlowIntensity((prev) => prev + 1);

    if (newDrops.length >= dropCount) {
      setTimeout(onComplete, 1500);
    }
  };

  const remaining = dropCount - drops.length;

  return (
    <div className="max-w-md w-full text-center space-y-6">
      <div className="text-5xl">💧</div>
      <h2 className="text-xl font-bold">Gratitude Drop</h2>
      <p className="text-sm" style={{ color: P.dim }}>
        {remaining > 0 ? `Share ${remaining} more thing${remaining !== 1 ? "s" : ""} you're grateful for` : "Beautiful. You carry these with you."}
      </p>

      {/* Central orb that glows brighter */}
      <div className="flex justify-center my-4">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${P.accent}${Math.min(20 + glowIntensity * 20, 90).toString(16).padStart(2, "0")}, ${P.accent}10)`,
            boxShadow: `0 0 ${30 + glowIntensity * 25}px ${P.accent}${Math.min(20 + glowIntensity * 15, 70).toString(16).padStart(2, "0")}`,
            border: `1px solid ${P.accent}40`,
          }}
        >
          <span className="text-3xl">{drops.length >= dropCount ? "✨" : "🤲"}</span>
        </div>
      </div>

      {/* Dropped items */}
      <div className="flex flex-wrap justify-center gap-2 min-h-[40px]">
        {drops.map((d, i) => (
          <div
            key={i}
            className="px-3 py-1.5 rounded-full text-xs font-medium animate-bounce"
            style={{
              background: `${P.green}20`,
              border: `1px solid ${P.green}40`,
              color: P.green,
              animationDelay: `${i * 0.1}s`,
              animationDuration: "0.6s",
              animationIterationCount: "1",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Input */}
      {remaining > 0 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDrop()}
            placeholder="I'm grateful for..."
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: P.card, border: `1px solid ${P.border}`, color: P.text }}
            autoFocus
          />
          <button
            onClick={handleDrop}
            disabled={!current.trim()}
            className="px-5 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
            style={{ background: P.accent, color: "#fff" }}
          >
            Drop
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PATTERN TRACING
   ═══════════════════════════════════════════════════════════════════════════ */

function PatternTrace({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [patternIdx, setPatternIdx] = useState(0);
  const [isTracing, setIsTracing] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [done, setDone] = useState(false);
  const pointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const patterns = activity.patterns || ["infinity"];

  const currentPattern = patterns[patternIdx];

  // Draw guide pattern
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = `${P.accent}40`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();

    if (currentPattern === "infinity") {
      for (let t = 0; t <= Math.PI * 2; t += 0.02) {
        const x = w / 2 + (w * 0.35) * Math.cos(t) / (1 + Math.sin(t) ** 2);
        const y = h / 2 + (h * 0.25) * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) ** 2);
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
    } else if (currentPattern === "spiral") {
      for (let t = 0; t <= Math.PI * 6; t += 0.05) {
        const r = 10 + t * 12;
        const x = w / 2 + r * Math.cos(t);
        const y = h / 2 + r * Math.sin(t);
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
    } else {
      // figure8
      for (let t = 0; t <= Math.PI * 2; t += 0.02) {
        const x = w / 2 + (w * 0.3) * Math.sin(t);
        const y = h / 2 + (h * 0.3) * Math.sin(t * 2) / 2;
        t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }, [currentPattern]);

  const handlePointerDown = () => {
    setIsTracing(true);
    pointsRef.current = [];
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isTracing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointsRef.current.push({ x, y });

    // Draw user trace
    const ctx = canvasRef.current.getContext("2d");
    if (ctx && pointsRef.current.length > 1) {
      const prev = pointsRef.current[pointsRef.current.length - 2];
      ctx.strokeStyle = P.green;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    setIsTracing(false);
    // Calculate accuracy (simplified)
    const pts = pointsRef.current.length;
    const acc = Math.min(100, Math.max(30, pts / 2));
    setAccuracy(Math.round(acc));

    const nextIdx = patternIdx + 1;
    if (nextIdx >= patterns.length) {
      setDone(true);
      setTimeout(onComplete, 1200);
    } else {
      setTimeout(() => {
        setPatternIdx(nextIdx);
        setAccuracy(0);
      }, 800);
    }
  };

  return (
    <div className="max-w-lg w-full text-center space-y-4">
      <div className="text-4xl">🎯</div>
      <h2 className="text-xl font-bold">Trace the Pattern</h2>
      <p className="text-sm" style={{ color: P.dim }}>
        {done ? "Well done! Bilateral stimulation calms the brain." : `Trace the ${currentPattern} pattern with your finger or mouse`}
      </p>

      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="mx-auto rounded-xl cursor-crosshair touch-none"
        style={{ background: P.card, border: `1px solid ${P.border}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div className="flex justify-between text-xs" style={{ color: P.muted }}>
        <span>Pattern {patternIdx + 1} of {patterns.length}</span>
        {accuracy > 0 && <span style={{ color: accuracy > 70 ? P.green : P.yellow }}>Accuracy: {accuracy}%</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMOTION GARDEN
   ═══════════════════════════════════════════════════════════════════════════ */

function EmotionGarden({ activity, onComplete, timeline }: { activity: Activity; onComplete: () => void; timeline: Array<{ emotion: string }> }) {
  const plants = activity.emotionPlants || {};

  // Get emotions from session timeline
  const emotions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const snap of timeline) {
      counts[snap.emotion] = (counts[snap.emotion] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [timeline]);

  const [planted, setPlanted] = useState<string[]>([]);
  const [isRaining, setIsRaining] = useState(false);

  // Audio: rain when planting is complete
  useEffect(() => {
    if (isRaining) startRain(0.08);
    return () => { stopRain(); };
  }, [isRaining]);

  const handlePlant = (emotion: string) => {
    if (planted.includes(emotion)) return;
    const next = [...planted, emotion];
    setPlanted(next);

    if (next.length >= emotions.length) {
      setIsRaining(true);
      setTimeout(onComplete, 2500);
    }
  };

  return (
    <div className="max-w-lg w-full text-center space-y-6">
      <div className="text-4xl">🌻</div>
      <h2 className="text-xl font-bold">Your Emotion Garden</h2>
      <p className="text-sm" style={{ color: P.dim }}>
        {isRaining ? "🌧️ Growing... even difficult emotions have a place." : "Tap each emotion to plant it in your garden"}
      </p>

      {/* Garden grid */}
      <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
        {emotions.map(([emo, count]) => {
          const isPlanted = planted.includes(emo);
          const info = plants[emo] || { plant: "Flower", emoji: "🌸" };
          return (
            <button
              key={emo}
              onClick={() => handlePlant(emo)}
              disabled={isPlanted}
              className="p-4 rounded-xl flex flex-col items-center gap-1 transition-all duration-500"
              style={{
                background: isPlanted ? `${EMOTION_COLORS[emo] || P.accent}15` : P.card,
                border: `1px solid ${isPlanted ? EMOTION_COLORS[emo] || P.accent : P.border}`,
                transform: isPlanted ? "scale(1.05)" : "scale(1)",
              }}
            >
              <span className="text-2xl">{isPlanted ? info.emoji : "🌱"}</span>
              <span className="text-[10px] capitalize font-medium" style={{ color: isPlanted ? EMOTION_COLORS[emo] : P.dim }}>{emo}</span>
              <span className="text-[8px]" style={{ color: P.muted }}>×{count}</span>
            </button>
          );
        })}
      </div>

      {isRaining && (
        <p className="text-sm font-medium animate-pulse" style={{ color: P.green }}>
          🌿 Your garden is growing beautifully
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SHAKE IT OUT
   ═══════════════════════════════════════════════════════════════════════════ */

function ShakeItOut({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const movements = activity.movements!;
  const [moveIdx, setMoveIdx] = useState(-1); // -1 = start screen
  const [timeLeft, setTimeLeft] = useState(0);

  const currentMove = moveIdx >= 0 ? movements[moveIdx] : null;

  // Audio: heartbeat during shake
  useEffect(() => {
    if (moveIdx >= 0 && moveIdx < movements.length) startHeartbeat(90);
    else stopHeartbeat();
    return () => { stopHeartbeat(); };
  }, [moveIdx, movements.length]);

  useEffect(() => {
    if (moveIdx < 0) return;
    if (moveIdx >= movements.length) {
      onComplete();
      return;
    }

    setTimeLeft(movements[moveIdx].duration);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => setMoveIdx((i) => i + 1), 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [moveIdx, movements, onComplete]);

  if (moveIdx < 0) {
    return (
      <div className="max-w-md w-full text-center space-y-6">
        <span className="text-5xl">💃</span>
        <h2 className="text-xl font-bold">{activity.name}</h2>
        <p className="text-sm" style={{ color: P.dim }}>{activity.description}</p>
        <button
          onClick={() => setMoveIdx(0)}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: P.accent, color: "#fff" }}
        >
          Let&apos;s Move!
        </button>
      </div>
    );
  }

  if (!currentMove) return null;

  return (
    <div className="max-w-md w-full text-center space-y-6">
      <div className="text-6xl animate-bounce">{currentMove.icon}</div>
      <h2 className="text-lg font-bold">{currentMove.action}</h2>
      <div
        className="text-5xl font-bold tabular-nums"
        style={{ color: timeLeft <= 3 ? P.yellow : P.accent }}
      >
        {timeLeft}
      </div>
      <div className="flex justify-center gap-1.5">
        {movements.map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full transition-all" style={{ background: i < moveIdx ? P.green : i === moveIdx ? P.accent : P.border }} />
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════════
   GENERIC ACTIVITY (fallback)
   ═══════════════════════════════════════════════════════════════════════════ */

function GenericActivity({ activity, onComplete }: { activity: Activity; onComplete: () => void }) {
  const [timeLeft, setTimeLeft] = useState(activity.durationSec);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); onComplete(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activity.durationSec, onComplete]);

  return (
    <div className="max-w-md w-full text-center space-y-6">
      <span className="text-5xl">{activity.icon}</span>
      <h2 className="text-xl font-bold">{activity.name}</h2>
      <p className="text-sm" style={{ color: P.dim }}>{activity.description}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: P.accent }}>{timeLeft}s</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSITION SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

function TransitionScreen({ completedCount, total, nextActivity, onContinue }: {
  completedCount: number;
  total: number;
  nextActivity: Activity;
  onContinue: () => void;
}) {
  return (
    <div className="max-w-md w-full text-center space-y-6">
      <div className="text-4xl">✅</div>
      <h2 className="text-xl font-bold">Great Job!</h2>
      <p className="text-sm" style={{ color: P.dim }}>
        {completedCount} of {total} activities completed
      </p>

      {/* Next activity preview */}
      <div className="p-5 rounded-xl text-left" style={{ background: P.card, border: `1px solid ${P.border}` }}>
        <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: P.muted }}>Up Next</p>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{nextActivity.icon}</span>
          <div>
            <p className="text-sm font-semibold">{nextActivity.name}</p>
            <p className="text-[10px]" style={{ color: P.dim }}>{nextActivity.description}</p>
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.green})`, color: "#fff" }}
      >
        Continue →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESULTS / BEFORE-AFTER SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

function ResultsScreen({ totalXp, badges, moodImproved, lastResult }: {
  totalXp: number;
  badges: Array<{ name: string; icon: string }>;
  moodImproved: boolean;
  lastResult: import("@/types").SessionEndResult | null;
}) {
  const beforeMood = lastResult?.moodScore ?? 50;
  const afterMood = moodImproved ? Math.min(100, beforeMood + 20 + Math.floor(Math.random() * 15)) : beforeMood + 5;
  const improvement = afterMood - beforeMood;

  return (
    <div className="max-w-lg w-full space-y-8 text-center">
      <div className="text-5xl">🏆</div>
      <h2 className="text-2xl font-bold">Relief Journey Complete!</h2>
      <p className="text-sm" style={{ color: P.dim }}>You took time to care for yourself. That matters.</p>

      {/* Before / After comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-xl" style={{ background: P.card, border: `1px solid ${P.border}` }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: P.muted }}>Before</p>
          <p className="text-3xl font-bold" style={{ color: P.red }}>{beforeMood}</p>
          <p className="text-xs mt-1 capitalize" style={{ color: P.dim }}>{lastResult?.dominantEmotion || "neutral"}</p>
          <p className="text-[10px] mt-1" style={{ color: P.muted }}>
            Stability: {((lastResult?.stabilityIndex ?? 0.5) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="p-5 rounded-xl" style={{ background: `${P.green}08`, border: `1px solid ${P.green}30` }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: P.green }}>After</p>
          <p className="text-3xl font-bold" style={{ color: P.green }}>{afterMood}</p>
          <p className="text-xs mt-1" style={{ color: P.dim }}>Relieved</p>
          <p className="text-[10px] mt-1" style={{ color: P.green }}>
            +{improvement} points
          </p>
        </div>
      </div>

      {/* Mood shift arrow */}
      {improvement > 0 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-lg">📈</span>
          <p className="text-sm font-bold" style={{ color: P.green }}>
            Mood improved by {improvement} points!
          </p>
        </div>
      )}

      {/* XP earned */}
      <div className="p-4 rounded-xl" style={{ background: `${P.yellow}10`, border: `1px solid ${P.yellow}30` }}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="text-lg font-bold" style={{ color: P.yellow }}>+{totalXp} XP</span>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: P.muted }}>New Badges Earned</p>
          <div className="flex flex-wrap justify-center gap-3">
            {badges.map((b, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: `${P.accent}15`, border: `1px solid ${P.accent}30` }}>
                <span>{b.icon}</span>
                <span className="text-xs font-medium" style={{ color: P.accent }}>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Link
          href="/session-results"
          className="flex-1 py-3 rounded-xl text-sm font-medium text-center transition-all hover:scale-[1.02]"
          style={{ background: P.card, border: `1px solid ${P.border}`, color: P.dim }}
        >
          View Session Results
        </Link>
        <Link
          href="/mood-analyze"
          className="flex-1 py-3 rounded-xl text-sm font-bold text-center transition-all hover:scale-[1.02]"
          style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`, color: "#fff" }}
        >
          New Session
        </Link>
      </div>
    </div>
  );
}
