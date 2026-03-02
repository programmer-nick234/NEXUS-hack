"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { gsap } from "gsap";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const P = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceLight: "#334155",
  border: "#475569",
  orange: "#FF5A1F",
  accent: "#818CF8",
  green: "#34D399",
  red: "#F87171",
  yellow: "#FBBF24",
  blue: "#60A5FA",
  purple: "#A78BFA",
  cyan: "#22D3EE",
  text: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
};

const EMOTION_COLORS: Record<string, string> = {
  happy: P.yellow,
  sad: P.blue,
  angry: P.red,
  neutral: P.dim,
  surprised: P.purple,
  fear: P.yellow,
  disgust: P.green,
  anxious: P.cyan,
  regulated: P.green,
};

interface Analytics {
  totalSessions: number;
  avgMoodScore: number;
  avgStability: number;
  totalMinutes: number;
  moodTrend: { date: string; moodScore: number; stability: number }[];
  emotionBreakdown: Record<string, number>;
}

interface SessionItem {
  _id: string;
  moodScore: number | null;
  stabilityIndex: number | null;
  dominantEmotion: string | null;
  durationSec: number;
  totalSnapshots: number;
  endedAt: string;
}

interface GamStats {
  xp: number;
  level: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  levelProgress: { current: number; xpForNext: number; progress: number };
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

/* ── Helper ────────────────────────────────────────────────────────────── */
function formatDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.round(sec / 60)}m`;
}

function moodColor(score: number) {
  if (score >= 70) return P.green;
  if (score >= 40) return P.yellow;
  return P.red;
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Stat Card ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, icon, idx }: {
  label: string; value: string | number; sub?: string; color: string; icon: string; idx: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, delay: idx * 0.08, ease: "power3.out" });
  }, [idx]);

  return (
    <div ref={ref} className="rounded-2xl p-5 opacity-0" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.dim }}>{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-3xl font-black" style={{ color }}>{value}</div>
      {sub && <p className="text-xs mt-1" style={{ color: P.muted }}>{sub}</p>}
    </div>
  );
}

/* ── Mini Trend Chart (SVG) ──────────────────────────────────────────── */
function MiniTrend({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 200, h = 50;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h * 0.8 - h * 0.1,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pathD + ` L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) =>
        i === pts.length - 1 ? <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} /> : null
      )}
    </svg>
  );
}

/* ── Emotion Breakdown Bar ─────────────────────────────────────────────── */
function EmotionBar({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {sorted.map(([emo, count]) => {
        const pct = Math.round((count / total) * 100);
        const color = EMOTION_COLORS[emo] || P.dim;
        return (
          <div key={emo}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium capitalize" style={{ color: P.text }}>{emo}</span>
              <span className="text-xs font-mono" style={{ color: P.muted }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: `${P.surfaceLight}80` }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Badge Grid ──────────────────────────────────────────────────────── */
function BadgeGrid({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {earned.map((b) => (
        <div key={b.id} className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-105"
          style={{ background: `${P.surfaceLight}50` }} title={b.description}>
          <span className="text-2xl">{b.icon}</span>
          <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: P.text }}>{b.name}</span>
        </div>
      ))}
      {locked.slice(0, 6).map((b) => (
        <div key={b.id} className="flex flex-col items-center gap-1 p-2 rounded-xl opacity-30"
          style={{ background: `${P.surfaceLight}30` }} title={`${b.name}: ${b.description}`}>
          <span className="text-2xl grayscale">🔒</span>
          <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: P.muted }}>???</span>
        </div>
      ))}
    </div>
  );
}

/* ── XP Progress Bar ── */
function XPBar({ stats }: { stats: GamStats }) {
  const { level, levelProgress } = stats;
  const pct = Math.min(levelProgress?.progress ?? 0, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ color: P.orange }}>Lv.{level}</span>
          <span className="text-xs font-medium" style={{ color: P.dim }}>{stats.xp} XP</span>
        </div>
        <span className="text-xs font-mono" style={{ color: P.muted }}>{levelProgress?.current ?? 0} / {levelProgress?.xpForNext ?? 100}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: `${P.surfaceLight}80` }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${P.orange}, #FF8A65)` }} />
      </div>
    </div>
  );
}

/* ── Session list item ───────────────────────────────────────────────── */
function SessionRow({ session }: { session: SessionItem }) {
  const mood = session.moodScore ?? 0;
  const emo = session.dominantEmotion || "neutral";
  return (
    <Link href={`/session-results`}
      className="flex items-center gap-4 p-3 rounded-xl transition-all hover:-translate-y-0.5"
      style={{ background: `${P.surfaceLight}30`, border: `1px solid ${P.border}20` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
        style={{ background: `${moodColor(mood)}20`, color: moodColor(mood) }}>
        {Math.round(mood)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize" style={{ color: P.text }}>{emo}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${EMOTION_COLORS[emo] || P.dim}20`, color: EMOTION_COLORS[emo] || P.dim }}>
            {formatDuration(session.durationSec)}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: P.muted }}>{session.endedAt ? timeAgo(session.endedAt) : "—"}</span>
      </div>
      <div className="text-xs font-mono" style={{ color: P.dim }}>
        {session.totalSnapshots} snaps
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [gamStats, setGamStats] = useState<GamStats | null>(null);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, sessionsRes, gamRes, badgesRes] = await Promise.allSettled([
        fetch(`${API}/analytics/overview`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/sessions/history?limit=10`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/gamification/stats`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${API}/gamification/badges/all`, { credentials: "include" }).then((r) => r.json()),
      ]);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value);
      if (sessionsRes.status === "fulfilled") setSessions(sessionsRes.value.sessions || []);
      if (gamRes.status === "fulfilled" && !gamRes.value.detail) setGamStats(gamRes.value);
      if (badgesRes.status === "fulfilled" && !badgesRes.value.detail) setAllBadges(badgesRes.value.badges || []);
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const a = analytics;
  const trendScores = a?.moodTrend?.map((t) => t.moodScore) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black" style={{ color: P.text }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: P.dim }}>Your emotional wellness at a glance</p>
        </div>
        <Link href="/mood-analyze"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
          style={{ background: P.orange, color: P.bg }}>
          📹 New Session
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="text-sm animate-pulse" style={{ color: P.dim }}>Loading your data...</div>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ───────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard idx={0} label="Sessions" value={a?.totalSessions ?? 0} icon="📹" color={P.accent} sub="Total completed" />
            <StatCard idx={1} label="Avg Mood" value={a?.avgMoodScore ?? 0} icon="😊" color={moodColor(a?.avgMoodScore ?? 0)} sub="out of 100" />
            <StatCard idx={2} label="Stability" value={`${Math.round((a?.avgStability ?? 0) * 100)}%`} icon="⚖️" color={P.cyan} sub="Average index" />
            <StatCard idx={3} label="Total Time" value={`${a?.totalMinutes ?? 0}m`} icon="⏱️" color={P.green} sub="Minutes analyzed" />
          </div>

          {/* ── XP + Streak Row ──────────────────────────── */}
          {gamStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 rounded-2xl p-5" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                <h3 className="text-sm font-semibold mb-4" style={{ color: P.dim }}>Level Progress</h3>
                <XPBar stats={gamStats} />
              </div>
              <div className="rounded-2xl p-5 flex flex-col items-center justify-center" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                <span className="text-4xl mb-2">🔥</span>
                <span className="text-3xl font-black" style={{ color: P.orange }}>{gamStats.currentStreak}</span>
                <span className="text-xs font-semibold mt-1" style={{ color: P.dim }}>Day Streak</span>
                <span className="text-[10px] mt-0.5" style={{ color: P.muted }}>Best: {gamStats.longestStreak}</span>
              </div>
            </div>
          )}

          {/* ── Mood Trend + Emotion Breakdown ────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: P.dim }}>Mood Trend <span className="text-[10px] font-normal" style={{ color: P.muted }}>(last 10 sessions)</span></h3>
              {trendScores.length >= 2 ? (
                <MiniTrend data={trendScores} color={P.green} />
              ) : (
                <div className="h-12 flex items-center justify-center text-xs" style={{ color: P.muted }}>
                  Complete more sessions to see trends
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: P.dim }}>Emotion Breakdown</h3>
              {a?.emotionBreakdown && Object.keys(a.emotionBreakdown).length > 0 ? (
                <EmotionBar breakdown={a.emotionBreakdown} />
              ) : (
                <div className="h-12 flex items-center justify-center text-xs" style={{ color: P.muted }}>
                  No data yet
                </div>
              )}
            </div>
          </div>

          {/* ── Badges ────────────────────────────────── */}
          {allBadges.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: P.dim }}>
                  Badges <span className="text-[10px] font-normal" style={{ color: P.muted }}>
                    ({allBadges.filter((b) => b.earned).length}/{allBadges.length} earned)
                  </span>
                </h3>
              </div>
              <BadgeGrid badges={allBadges} />
            </div>
          )}

          {/* ── Recent Sessions ──────────────────────── */}
          <div className="rounded-2xl p-5" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: P.dim }}>Recent Sessions</h3>
              <Link href="/session-results" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: P.orange }}>
                View All →
              </Link>
            </div>
            {sessions.length > 0 ? (
              <div className="space-y-2">
                {sessions.slice(0, 5).map((s) => <SessionRow key={s._id} session={s} />)}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-lg mb-2">🎯</p>
                <p className="text-sm" style={{ color: P.dim }}>No sessions yet. Start your first one!</p>
                <Link href="/mood-analyze"
                  className="inline-block mt-3 px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                  style={{ background: P.orange, color: P.bg }}>
                  Start Session
                </Link>
              </div>
            )}
          </div>

          {/* ── Quick Actions ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-8">
            {[
              { href: "/mood-analyze", icon: "📹", title: "New Session", desc: "Start real-time emotion analysis", bg: P.orange },
              { href: "/relief", icon: "🌿", title: "Relief Journey", desc: "Stress-relief activities for you", bg: P.green },
              { href: "/session-results", icon: "📊", title: "Detailed Results", desc: "Deep-dive into your last session", bg: P.accent },
            ].map((action) => (
              <Link key={action.href} href={action.href}
                className="rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg group"
                style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 transition-transform group-hover:scale-110"
                  style={{ background: `${action.bg}15` }}>
                  {action.icon}
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: P.text }}>{action.title}</h3>
                <p className="text-xs" style={{ color: P.muted }}>{action.desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
