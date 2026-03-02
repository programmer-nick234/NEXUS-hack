"use client";

import { useEffect, useState } from "react";
import { useSessionStore, useGamificationStore } from "@/store";
import Link from "next/link";
import type { AnalyticsOverview, GamificationStats, Badge, SessionEndResult } from "@/types";

// ── Emoji map ────────────────────────────────────────────────────────────────
const EMOJI_MAP: Record<string, string> = {
  happy: "😊", sad: "😢", angry: "😡", neutral: "😐",
  surprised: "😮", fear: "😨", disgust: "🤢",
};

// ── Emotion colour map ───────────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
  happy: "#10B981",
  neutral: "#94A3B8",
  sad: "#3B82F6",
  angry: "#EF4444",
  fear: "#A855F7",
  surprised: "#F59E0B",
  disgust: "#84CC16",
};

// ── Tiny bar chart component ─────────────────────────────────────────────────
function MiniBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-gray-400 capitalize">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-xs text-gray-300 text-right">{value}</span>
    </div>
  );
}

// ── Mood trend sparkline (CSS only) ──────────────────────────────────────────
function MoodTrend({
  points,
}: {
  points: { date: string; moodScore: number; stability: number }[];
}) {
  if (points.length === 0) return <p className="text-gray-500 text-sm">No data yet</p>;
  const maxScore = Math.max(...points.map((p) => p.moodScore), 100);
  return (
    <div className="flex items-end gap-1 h-32">
      {points.map((p, i) => {
        const h = (p.moodScore / maxScore) * 100;
        const color =
          p.moodScore >= 70 ? "#10B981" : p.moodScore >= 40 ? "#F59E0B" : "#EF4444";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{ height: `${h}%`, backgroundColor: color, minHeight: 4 }}
              title={`${p.moodScore} — ${new Date(p.date).toLocaleDateString()}`}
            />
            <span className="text-[10px] text-gray-500 truncate w-full text-center">
              {new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent || "#E2E8F0" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Badge card ───────────────────────────────────────────────────────────────
function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <div
      className={`rounded-xl border p-4 text-center transition-all ${
        badge.earned
          ? "border-indigo-500/50 bg-indigo-500/10"
          : "border-white/5 bg-white/[0.02] opacity-40"
      }`}
    >
      <div className="text-3xl mb-2">{badge.icon}</div>
      <p className="text-sm font-medium text-gray-200">{badge.name}</p>
      <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
      {badge.earned && badge.earnedAt && (
        <p className="text-[10px] text-indigo-400 mt-2">
          {new Date(badge.earnedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ── XP bar ───────────────────────────────────────────────────────────────────
function XPBar({ stats }: { stats: GamificationStats }) {
  const lp = stats.levelProgress;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="text-lg font-bold text-indigo-400">Level {stats.level}</span>
          <span className="text-xs text-gray-500 ml-2">{stats.xp} XP</span>
        </div>
        <div className="text-xs text-gray-400">{lp.percent}%</div>
      </div>
      <div className="h-3 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
          style={{ width: `${lp.percent}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {lp.current} / {lp.required} XP to next level
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const {
    analytics,
    fetchAnalytics,
    sessions,
    fetchHistory,
    lastResult,
  } = useSessionStore();
  const {
    stats,
    allBadges,
    fetchStats,
    fetchAllBadges,
  } = useGamificationStore();

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([fetchAnalytics(), fetchHistory(), fetchStats(), fetchAllBadges()]).then(
      () => setLoaded(true)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse text-gray-500">Loading analytics…</div>
      </div>
    );
  }

  const a = analytics || {
    totalSessions: 0,
    avgMoodScore: 0,
    avgStability: 0,
    totalMinutes: 0,
    moodTrend: [],
    emotionBreakdown: {},
  };

  const maxEmotion = Math.max(...Object.values(a.emotionBreakdown), 1);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your emotional regulation journey at a glance
          </p>
        </div>
        <Link
          href="/mood-analyze"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-medium transition-colors"
        >
          New Session
        </Link>
      </div>

      {/* ── Latest Session Summary (shown when coming from a completed session) ── */}
      {lastResult && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Latest Session Performance</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <span className="text-4xl">{EMOJI_MAP[lastResult.dominantEmotion || "neutral"] || "😐"}</span>
              <p className="text-xs text-gray-400 mt-1 capitalize">{lastResult.dominantEmotion || "neutral"}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{lastResult.moodScore ?? 0}</p>
              <p className="text-xs text-gray-400">Mood Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{lastResult.stabilityIndex ?? 0}</p>
              <p className="text-xs text-gray-400">Stability</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{lastResult.durationSec ? `${Math.round(lastResult.durationSec / 60)}m ${Math.round(lastResult.durationSec % 60)}s` : "0s"}</p>
              <p className="text-xs text-gray-400">Duration</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400">{lastResult.totalSnapshots}</p>
              <p className="text-xs text-gray-400">Snapshots</p>
            </div>
          </div>
          {lastResult.sessionXp != null && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="text-sm font-bold text-indigo-400">+{lastResult.sessionXp} XP</span>
              {lastResult.level != null && <span className="text-xs text-gray-400">Level {lastResult.level}</span>}
              {lastResult.newBadges && lastResult.newBadges.length > 0 && (
                <div className="flex gap-1">
                  {lastResult.newBadges.map((b: any) => (
                    <span key={b.id} className="text-xl" title={b.name}>{b.icon}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Sessions"
          value={a.totalSessions}
          accent="#818CF8"
        />
        <StatCard
          label="Avg Mood Score"
          value={a.avgMoodScore}
          sub="out of 100"
          accent={a.avgMoodScore >= 70 ? "#10B981" : a.avgMoodScore >= 40 ? "#F59E0B" : "#EF4444"}
        />
        <StatCard
          label="Avg Stability"
          value={a.avgStability}
          sub="0 = volatile, 1 = stable"
          accent="#8B5CF6"
        />
        <StatCard
          label="Total Minutes"
          value={a.totalMinutes}
          accent="#06B6D4"
        />
      </div>

      {/* Gamification bar */}
      {stats && <XPBar stats={stats} />}

      {/* Streaks */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Current Streak" value={`${stats.currentStreak} days`} accent="#F59E0B" />
          <StatCard
            label="Longest Streak"
            value={`${stats.longestStreak} days`}
            accent="#F59E0B"
          />
          <StatCard label="Level" value={stats.level} accent="#818CF8" />
          <StatCard label="XP" value={stats.xp} accent="#818CF8" />
        </div>
      )}

      {/* Mood trend */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Mood Trend (last 10 sessions)</h2>
        <MoodTrend points={a.moodTrend} />
      </div>

      {/* Emotion breakdown */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Emotion Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(a.emotionBreakdown).length > 0 ? (
            Object.entries(a.emotionBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([emo, count]) => (
                <MiniBar
                  key={emo}
                  label={emo}
                  value={count}
                  max={maxEmotion}
                  color={EMOTION_COLORS[emo] || "#64748B"}
                />
              ))
          ) : (
            <p className="text-gray-500 text-sm">Complete a session to see breakdowns</p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Achievements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {allBadges.length > 0 ? (
            allBadges.map((b) => <BadgeCard key={b.id} badge={b} />)
          ) : (
            <p className="text-gray-500 text-sm col-span-full">
              Complete sessions to earn badges
            </p>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-sm font-medium text-gray-300 mb-4">Recent Sessions</h2>
        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.slice(0, 8).map((s) => (
              <div
                key={s._id}
                className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium capitalize">
                    {s.dominantEmotion || "neutral"}
                  </span>
                  <span className="text-xs text-gray-500 ml-3">
                    {s.endedAt
                      ? new Date(s.endedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "In progress"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Score: {s.moodScore ?? "–"}</span>
                  <span>Stability: {s.stabilityIndex ?? "–"}</span>
                  <span>{Math.round(s.durationSec / 60)}m</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No sessions recorded yet</p>
        )}
      </div>
    </div>
  );
}
