"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSessionStore, useGamificationStore } from "@/store";
import Link from "next/link";
import EnergyBorder from "@/components/ui/EnergyBorder";
import type { EmotionSnapshot, SessionEndResult, GamificationStats, Badge } from "@/types";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const PALETTE = {
  bg: "#050A18",
  card: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.08)",
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
};

const EMOTION_COLORS: Record<string, string> = {
  happy: "#10B981",
  neutral: "#94A3B8",
  sad: "#3B82F6",
  angry: "#EF4444",
  fear: "#A855F7",
  surprised: "#F59E0B",
  disgust: "#84CC16",
};

const EMOJI_MAP: Record<string, string> = {
  happy: "😊", sad: "😢", angry: "😡", neutral: "😐",
  surprised: "😮", fear: "😨", disgust: "🤢",
};

const EMOTION_LABELS: Record<string, string> = {
  happy: "Happy", sad: "Sad", angry: "Angry", neutral: "Neutral",
  surprised: "Surprised", fear: "Fearful", disgust: "Disgusted",
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Animated circular gauge for mood score */
function MoodGauge({ score, size = 180 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animated / 100) * circ;
  const color = score >= 70 ? PALETTE.green : score >= 40 ? PALETTE.yellow : PALETTE.red;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-[1500ms] ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-black" style={{ color }}>{animated}</span>
        <span className="text-[10px] uppercase tracking-widest" style={{ color: PALETTE.muted }}>
          Mood Score
        </span>
      </div>
    </div>
  );
}

/** Stability meter — horizontal bar */
function StabilityMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? PALETTE.green : pct >= 40 ? PALETTE.yellow : PALETTE.red;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: PALETTE.dim }}>Emotional Stability</span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full transition-all duration-[1200ms] ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}90, ${color})` }}
        />
      </div>
    </div>
  );
}

/** Emotion timeline — shows emotion over time as colored blocks */
function EmotionTimeline({ timeline }: { timeline: EmotionSnapshot[] }) {
  if (timeline.length === 0) {
    return <p className="text-sm" style={{ color: PALETTE.muted }}>No emotion data captured</p>;
  }

  // Sample at most ~60 bars for visual clarity
  const step = Math.max(1, Math.floor(timeline.length / 60));
  const sampled = timeline.filter((_, i) => i % step === 0);

  return (
    <div className="space-y-3">
      {/* Timeline bars */}
      <div className="flex items-end gap-px h-20">
        {sampled.map((snap, i) => {
          const color = EMOTION_COLORS[snap.emotion] || PALETTE.dim;
          const h = Math.max(15, snap.confidence * 100);
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all duration-300 hover:opacity-80 cursor-default group relative"
              style={{ height: `${h}%`, backgroundColor: color, minWidth: 2 }}
              title={`${snap.emotion} (${(snap.confidence * 100).toFixed(0)}%) — ${new Date(snap.ts).toLocaleTimeString()}`}
            />
          );
        })}
      </div>
      {/* Time labels */}
      <div className="flex justify-between text-[10px]" style={{ color: PALETTE.muted }}>
        <span>{new Date(timeline[0].ts).toLocaleTimeString()}</span>
        <span>{new Date(timeline[timeline.length - 1].ts).toLocaleTimeString()}</span>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(EMOTION_COLORS).map(([emo, color]) => (
          <div key={emo} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-[10px] capitalize" style={{ color: PALETTE.dim }}>{emo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Emotion distribution — horizontal bars sorted by frequency */
function EmotionDistribution({ timeline }: { timeline: EmotionSnapshot[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of timeline) {
      c[s.emotion] = (c[s.emotion] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [timeline]);

  if (counts.length === 0) return null;
  const maxCount = counts[0][1];

  return (
    <div className="space-y-3">
      {counts.map(([emo, count]) => {
        const pct = (count / timeline.length) * 100;
        const color = EMOTION_COLORS[emo] || PALETTE.dim;
        return (
          <div key={emo} className="flex items-center gap-3">
            <span className="text-xl w-8 text-center">{EMOJI_MAP[emo] || "❓"}</span>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium capitalize" style={{ color: PALETTE.text }}>
                  {EMOTION_LABELS[emo] || emo}
                </span>
                <span className="text-xs font-bold" style={{ color }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: `linear-gradient(90deg, ${color}80, ${color})`,
                  }}
                />
              </div>
            </div>
            <span className="text-xs font-mono w-10 text-right" style={{ color: PALETTE.muted }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Confidence trend — sparkline of confidence values */
function ConfidenceTrend({ timeline }: { timeline: EmotionSnapshot[] }) {
  if (timeline.length < 2) return null;

  const step = Math.max(1, Math.floor(timeline.length / 40));
  const sampled = timeline.filter((_, i) => i % step === 0);
  const max = 1;

  return (
    <div className="flex items-end gap-px h-16">
      {sampled.map((snap, i) => {
        const h = Math.max(8, (snap.confidence / max) * 100);
        return (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${h}%`,
              background: `linear-gradient(to top, ${PALETTE.accent}60, ${PALETTE.accent})`,
              minWidth: 2,
            }}
            title={`${(snap.confidence * 100).toFixed(0)}%`}
          />
        );
      })}
    </div>
  );
}

/** Donut ring for emotion share */
function EmotionDonut({ timeline, size = 160 }: { timeline: EmotionSnapshot[]; size?: number }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of timeline) {
      c[s.emotion] = (c[s.emotion] || 0) + 1;
    }
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [timeline]);

  if (counts.length === 0) return null;

  const total = timeline.length;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  let accum = 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={12} />
        {counts.map(([emo, count]) => {
          const pct = count / total;
          const dashLen = pct * circ;
          const gap = circ - dashLen;
          const offset = accum * circ;
          accum += pct;
          return (
            <circle
              key={emo}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={EMOTION_COLORS[emo] || PALETTE.dim}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={`${dashLen} ${gap}`}
              strokeDashoffset={-offset}
            />
          );
        })}
      </svg>
      <div className="absolute text-center">
        <span className="text-3xl">{EMOJI_MAP[counts[0][0]] || "😐"}</span>
      </div>
    </div>
  );
}

/** Glass card wrapper */
function GlassCard({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-sm p-6 ${className}`}
      style={{
        background: PALETTE.card,
        borderColor: PALETTE.cardBorder,
        boxShadow: glow ? `0 0 40px ${glow}15, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {children}
    </div>
  );
}

/** Stat pill */
function StatPill({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-lg font-bold" style={{ color }}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>{label}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS ENGINE — derives highlights from session data
   ═══════════════════════════════════════════════════════════════════════════ */

interface SessionInsight {
  icon: string;
  title: string;
  description: string;
  color: string;
}

function deriveInsights(result: SessionEndResult, timeline: EmotionSnapshot[]): SessionInsight[] {
  const insights: SessionInsight[] = [];
  const score = result.moodScore ?? 60;
  const stability = result.stabilityIndex ?? 0.5;
  const dominant = result.dominantEmotion || "neutral";

  // Mood score insight
  if (score >= 80) {
    insights.push({ icon: "🌟", title: "Excellent Mood", description: "Your emotional state was predominantly positive this session.", color: PALETTE.green });
  } else if (score >= 60) {
    insights.push({ icon: "👍", title: "Good Session", description: "You maintained a generally balanced emotional state.", color: PALETTE.blue });
  } else if (score >= 40) {
    insights.push({ icon: "💭", title: "Mixed Emotions", description: "You experienced a range of emotions. Try breathing exercises next time.", color: PALETTE.yellow });
  } else {
    insights.push({ icon: "🫂", title: "Tough Session", description: "Consider guided meditation or the 4-7-8 breathing technique to regulate.", color: PALETTE.red });
  }

  // Stability insight
  if (stability >= 0.8) {
    insights.push({ icon: "🧘", title: "Rock Steady", description: "Your emotions remained remarkably consistent throughout.", color: PALETTE.cyan });
  } else if (stability < 0.4) {
    insights.push({ icon: "🌊", title: "Emotional Waves", description: "High variability detected. Grounding exercises may help stabilise.", color: PALETTE.purple });
  }

  // Emotion-specific
  if (dominant === "happy") {
    insights.push({ icon: "☀️", title: "Positivity Dominant", description: "Happiness was your strongest emotion. Keep it up!", color: PALETTE.green });
  } else if (dominant === "sad") {
    insights.push({ icon: "💙", title: "Sadness Detected", description: "Consider connecting with someone or trying a mood-lifting activity.", color: PALETTE.blue });
  } else if (dominant === "angry") {
    insights.push({ icon: "🔥", title: "Anger Present", description: "Progressive muscle relaxation can help release tension.", color: PALETTE.red });
  } else if (dominant === "fear") {
    insights.push({ icon: "🛡️", title: "Anxiety Signals", description: "Box breathing (4-4-4-4) is effective for calming anxiety.", color: PALETTE.purple });
  }

  // Duration insight
  if ((result.durationSec || 0) > 300) {
    insights.push({ icon: "⏱️", title: "Extended Session", description: `${Math.round((result.durationSec || 0) / 60)} minutes of mindful tracking — great commitment!`, color: PALETTE.accent });
  }

  // Snapshot count
  if (timeline.length > 30) {
    insights.push({ icon: "📸", title: "Rich Data", description: `${timeline.length} emotion samples captured for high-accuracy analysis.`, color: PALETTE.cyan });
  }

  return insights;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SessionResultsPage() {
  const { lastResult, timeline, analytics, sessions, fetchAnalytics, fetchHistory } = useSessionStore();
  const { stats, allBadges, fetchStats, fetchAllBadges } = useGamificationStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([fetchAnalytics(), fetchHistory(), fetchStats(), fetchAllBadges()]).then(() =>
      setLoaded(true)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = lastResult;
  const insights = useMemo(
    () => (result ? deriveInsights(result, timeline) : []),
    [result, timeline]
  );

  // Compute per-session stats
  const avgConfidence = useMemo(() => {
    if (timeline.length === 0) return 0;
    return Math.round((timeline.reduce((a, s) => a + s.confidence, 0) / timeline.length) * 100);
  }, [timeline]);

  const emotionSwitches = useMemo(() => {
    return timeline.reduce((acc, snap, i) => {
      if (i > 0 && snap.emotion !== timeline[i - 1].emotion) return acc + 1;
      return acc;
    }, 0);
  }, [timeline]);

  const peakEmotion = useMemo(() => {
    if (timeline.length === 0) return null;
    return timeline.reduce((best, snap) =>
      snap.confidence > best.confidence ? snap : best
      , timeline[0]);
  }, [timeline]);

  /* ── Empty state ─────────────────────────────────────────────────────── */
  if (!result) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: PALETTE.bg }}
      >
        <div className="text-center space-y-4">
          <div className="text-6xl">📊</div>
          <h1 className="text-2xl font-bold" style={{ color: PALETTE.text }}>No Session Data</h1>
          <p className="text-sm" style={{ color: PALETTE.muted }}>
            Complete a mood session to view your analytics dashboard.
          </p>
          <Link
            href="/mood-analyze"
            className="inline-block mt-4 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: PALETTE.accent, color: "#fff" }}
          >
            Start Session
          </Link>
        </div>
      </div>
    );
  }

  const a = analytics || {
    totalSessions: 0, avgMoodScore: 0, avgStability: 0,
    totalMinutes: 0, moodTrend: [], emotionBreakdown: {},
  };

  const moodScoreColor =
    (result.moodScore ?? 0) >= 70 ? PALETTE.green
      : (result.moodScore ?? 0) >= 40 ? PALETTE.yellow
        : PALETTE.red;

  return (
    <div className="min-h-screen" style={{ background: PALETTE.bg }}>
      {/* ── Background effects ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[160px] opacity-[0.07]"
          style={{ background: moodScoreColor }}
        />
        <div
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-[0.05]"
          style={{ background: PALETTE.accent }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ═══ HEADER ═════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] font-bold mb-1" style={{ color: PALETTE.accent }}>
              Session Complete
            </p>
            <h1 className="text-3xl sm:text-4xl font-black" style={{ color: PALETTE.text }}>
              Performance Analytics
            </h1>
            <p className="text-sm mt-1" style={{ color: PALETTE.muted }}>
              {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/relief"
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${PALETTE.green}, ${PALETTE.cyan})`, color: "#fff" }}
            >
              🌿 Start Relief
            </Link>
            <Link
              href="/mood-analyze"
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
              style={{ background: PALETTE.accent, color: "#fff" }}
            >
              New Session
            </Link>
          </div>
        </div>

        {/* ═══ HERO — Mood Score + Key Stats ══════════════════════════════ */}
        <EnergyBorder alwaysOn className="rounded-2xl" thickness={2} color={moodScoreColor} glowIntensity={1.2}>
          <GlassCard glow={moodScoreColor} className="!p-8">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
              {/* Left: Gauge */}
              <div className="flex flex-col items-center gap-4">
                <MoodGauge score={result.moodScore ?? 0} size={200} />
                <div className="flex items-center gap-2">
                  <span className="text-4xl">{EMOJI_MAP[result.dominantEmotion || "neutral"] || "😐"}</span>
                  <div>
                    <p className="text-lg font-bold capitalize" style={{ color: EMOTION_COLORS[result.dominantEmotion || "neutral"] || PALETTE.text }}>
                      {EMOTION_LABELS[result.dominantEmotion || "neutral"] || result.dominantEmotion}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Dominant Emotion</p>
                  </div>
                </div>
              </div>

              {/* Right: Stats grid */}
              <div className="space-y-5">
                <StabilityMeter value={result.stabilityIndex ?? 0} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatPill
                    icon="⏱️"
                    label="Duration"
                    value={result.durationSec ? `${Math.floor(result.durationSec / 60)}m ${Math.round(result.durationSec % 60)}s` : "0s"}
                    color={PALETTE.blue}
                  />
                  <StatPill
                    icon="📸"
                    label="Snapshots"
                    value={String(result.totalSnapshots)}
                    color={PALETTE.cyan}
                  />
                  <StatPill
                    icon="🎯"
                    label="Avg Confidence"
                    value={`${avgConfidence}%`}
                    color={PALETTE.accent}
                  />
                  <StatPill
                    icon="🔄"
                    label="Mood Switches"
                    value={String(emotionSwitches)}
                    color={PALETTE.yellow}
                  />
                </div>

                {/* XP & Badges (if authenticated) */}
                {result.sessionXp != null && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: `${PALETTE.accent}15`, border: `1px solid ${PALETTE.accent}30` }}>
                      <span className="text-lg">⚡</span>
                      <span className="text-lg font-bold" style={{ color: PALETTE.accent }}>+{result.sessionXp} XP</span>
                    </div>
                    {result.level != null && (
                      <span className="text-sm font-medium" style={{ color: PALETTE.dim }}>Level {result.level}</span>
                    )}
                    {result.newBadges && result.newBadges.length > 0 && (
                      <div className="flex gap-2">
                        {result.newBadges.map((b) => (
                          <div key={b.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: `${PALETTE.yellow}15`, border: `1px solid ${PALETTE.yellow}30` }}>
                            <span className="text-xl">{b.icon}</span>
                            <span className="text-xs font-medium" style={{ color: PALETTE.yellow }}>{b.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </EnergyBorder>

        {/* ═══ EMOTION TIMELINE ═══════════════════════════════════════════ */}
        <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.5} color={PALETTE.accent}>
          <GlassCard>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: PALETTE.text }}>Emotion Timeline</h2>
                <p className="text-xs mt-0.5" style={{ color: PALETTE.muted }}>How your emotions evolved during the session</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: `${PALETTE.accent}15`, color: PALETTE.accent }}>
                {timeline.length} samples
              </span>
            </div>
            <EmotionTimeline timeline={timeline} />
          </GlassCard>
        </EnergyBorder>

        {/* ═══ TWO-COL: Distribution + Donut ══════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.2} color={PALETTE.dim}>
            <GlassCard>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: PALETTE.text }}>
                Emotion Breakdown
              </h2>
              <EmotionDistribution timeline={timeline} />
              {timeline.length === 0 && (
                <p className="text-sm" style={{ color: PALETTE.muted }}>No data available</p>
              )}
            </GlassCard>
          </EnergyBorder>

          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.2} color={PALETTE.dim}>
            <GlassCard className="flex flex-col items-center justify-center gap-4">
              <h2 className="text-sm font-bold uppercase tracking-wider self-start" style={{ color: PALETTE.text }}>
                Emotion Share
              </h2>
              {timeline.length > 0 ? (
                <>
                  <EmotionDonut timeline={timeline} size={180} />
                  {peakEmotion && (
                    <div className="text-center">
                      <p className="text-xs" style={{ color: PALETTE.muted }}>Peak confidence moment</p>
                      <p className="text-sm font-bold capitalize" style={{ color: EMOTION_COLORS[peakEmotion.emotion] || PALETTE.text }}>
                        {peakEmotion.emotion} — {(peakEmotion.confidence * 100).toFixed(0)}%
                      </p>
                      <p className="text-[10px]" style={{ color: PALETTE.muted }}>
                        at {new Date(peakEmotion.ts).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: PALETTE.muted }}>No data available</p>
              )}
            </GlassCard>
          </EnergyBorder>
        </div>

        {/* ═══ CONFIDENCE TREND ═══════════════════════════════════════════ */}
        {timeline.length > 2 && (
          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.2} color={PALETTE.cyan}>
            <GlassCard>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: PALETTE.text }}>
                Detection Confidence Over Time
              </h2>
              <p className="text-xs mb-4" style={{ color: PALETTE.muted }}>
                How confidently the AI detected your emotions
              </p>
              <ConfidenceTrend timeline={timeline} />
            </GlassCard>
          </EnergyBorder>
        )}

        {/* ═══ AI INSIGHTS ════════════════════════════════════════════════ */}
        {insights.length > 0 && (
          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.5} color={PALETTE.accent} glowIntensity={1.1}>
            <GlassCard glow={PALETTE.accent}>
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xl">🧠</span>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: PALETTE.text }}>
                  AI Insights & Recommendations
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    className="flex gap-3 rounded-xl p-4"
                    style={{ background: `${ins.color}08`, border: `1px solid ${ins.color}20` }}
                  >
                    <span className="text-2xl shrink-0">{ins.icon}</span>
                    <div>
                      <p className="text-sm font-bold" style={{ color: ins.color }}>{ins.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: PALETTE.dim }}>{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </EnergyBorder>
        )}

        {/* ═══ HISTORICAL COMPARISON ══════════════════════════════════════ */}
        {loaded && a.totalSessions > 1 && (
          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.2} color={PALETTE.accent}>
            <GlassCard>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-5" style={{ color: PALETTE.text }}>
                Historical Comparison
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.accent }}>{a.totalSessions}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Total Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.green }}>{a.avgMoodScore}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Avg Mood Score</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.purple }}>{a.avgStability}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Avg Stability</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.cyan }}>{a.totalMinutes}m</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Total Minutes</p>
                </div>
              </div>

              {/* Mood trend */}
              {a.moodTrend.length > 0 && (
                <>
                  <p className="text-xs font-medium mb-3" style={{ color: PALETTE.dim }}>
                    Mood Trend (last {a.moodTrend.length} sessions)
                  </p>
                  <div className="flex items-end gap-1 h-24">
                    {a.moodTrend.map((p, i) => {
                      const h = Math.max(8, (p.moodScore / 100) * 100);
                      const isLatest = i === a.moodTrend.length - 1;
                      const color = isLatest ? PALETTE.accent : p.moodScore >= 70 ? PALETTE.green : p.moodScore >= 40 ? PALETTE.yellow : PALETTE.red;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t transition-all duration-500 ${isLatest ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-transparent" : ""}`}
                            style={{
                              height: `${h}%`,
                              backgroundColor: color,
                              minHeight: 4,
                            }}
                            title={`Score: ${p.moodScore}`}
                          />
                          <span className="text-[9px] truncate w-full text-center" style={{ color: PALETTE.muted }}>
                            {new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </GlassCard>
          </EnergyBorder>
        )}

        {/* ═══ GAMIFICATION (if logged in) ════════════════════════════════ */}
        {stats && (
          <EnergyBorder alwaysOn className="rounded-2xl" thickness={1.5} color={PALETTE.purple} glowIntensity={1.2}>
            <GlassCard glow={PALETTE.purple}>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-5" style={{ color: PALETTE.text }}>
                Your Progress
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.accent }}>{stats.xp}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Total XP</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.purple }}>Lv. {stats.level}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Level</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.yellow }}>🔥 {stats.currentStreak}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Day Streak</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" style={{ color: PALETTE.green }}>{stats.totalSessions}</p>
                  <p className="text-[10px] uppercase tracking-wider" style={{ color: PALETTE.muted }}>Sessions</p>
                </div>
              </div>

              {/* XP progress bar */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: PALETTE.dim }}>Level {stats.level} → {stats.level + 1}</span>
                  <span className="text-xs font-bold" style={{ color: PALETTE.accent }}>{stats.levelProgress.percent}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                    style={{ width: `${stats.levelProgress.percent}%` }}
                  />
                </div>
                <p className="text-[10px] mt-1" style={{ color: PALETTE.muted }}>
                  {stats.levelProgress.current} / {stats.levelProgress.required} XP
                </p>
              </div>

              {/* Badges row */}
              {allBadges.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium mb-3" style={{ color: PALETTE.dim }}>Achievements</p>
                  <div className="flex flex-wrap gap-3">
                    {allBadges.map((b) => (
                      <div
                        key={b.id}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all ${b.earned ? "opacity-100" : "opacity-30"}`}
                        style={{
                          background: b.earned ? `${PALETTE.accent}10` : "rgba(255,255,255,0.02)",
                          border: `1px solid ${b.earned ? PALETTE.accent + "30" : "rgba(255,255,255,0.05)"}`,
                        }}
                      >
                        <span className="text-xl">{b.icon}</span>
                        <div>
                          <p className="text-[11px] font-medium" style={{ color: b.earned ? PALETTE.text : PALETTE.muted }}>{b.name}</p>
                          <p className="text-[9px]" style={{ color: PALETTE.muted }}>{b.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          </EnergyBorder>
        )}

        {/* ═══ RECENT SESSIONS ════════════════════════════════════════════ */}
        {loaded && sessions.length > 0 && (
          <GlassCard>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: PALETTE.text }}>
              Recent Sessions
            </h2>
            <div className="space-y-2">
              {sessions.slice(0, 6).map((s) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ border: `1px solid ${PALETTE.cardBorder}` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{EMOJI_MAP[s.dominantEmotion || "neutral"] || "😐"}</span>
                    <div>
                      <p className="text-sm font-medium capitalize" style={{ color: PALETTE.text }}>
                        {s.dominantEmotion || "neutral"}
                      </p>
                      <p className="text-[10px]" style={{ color: PALETTE.muted }}>
                        {s.endedAt
                          ? new Date(s.endedAt).toLocaleDateString(undefined, {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })
                          : "In progress"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5 text-xs" style={{ color: PALETTE.dim }}>
                    <div className="text-center">
                      <p className="font-bold" style={{ color: s.moodScore != null ? (s.moodScore >= 70 ? PALETTE.green : s.moodScore >= 40 ? PALETTE.yellow : PALETTE.red) : PALETTE.muted }}>
                        {s.moodScore ?? "–"}
                      </p>
                      <p className="text-[9px]" style={{ color: PALETTE.muted }}>Score</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{s.stabilityIndex ?? "–"}</p>
                      <p className="text-[9px]" style={{ color: PALETTE.muted }}>Stability</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{Math.round(s.durationSec / 60)}m</p>
                      <p className="text-[9px]" style={{ color: PALETTE.muted }}>Duration</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        {/* ═══ FOOTER ═════════════════════════════════════════════════════ */}
        <div className="flex justify-center gap-4 pb-8">
          <Link
            href="/relief"
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${PALETTE.green}, ${PALETTE.cyan})`, color: "#fff" }}
          >
            🌿 Start Relief Journey
          </Link>
          <Link
            href="/mood-analyze"
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
            style={{ background: PALETTE.accent, color: "#fff" }}
          >
            Start New Session
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 border"
            style={{ borderColor: PALETTE.cardBorder, color: PALETTE.text }}
          >
            Back to Home
          </Link>
        </div>

        {/* System tag */}
        <p className="text-center text-[8px] pb-4 font-mono" style={{ color: PALETTE.muted + "40" }}>
          NEXUS_ANALYTICS_v2.0 // EMOTION_INTELLIGENCE_ENGINE
        </p>
      </div>
    </div>
  );
}
