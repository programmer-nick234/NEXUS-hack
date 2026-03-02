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
  text: "#F8FAFC",
  dim: "#94A3B8",
  muted: "#64748B",
};

const EMOTION_COLORS: Record<string, string> = {
  happy: P.yellow, sad: P.blue, angry: P.red, neutral: P.dim,
  surprised: P.purple, fear: P.yellow, disgust: P.green,
  anxious: "#22D3EE", regulated: P.green,
};

function moodColor(score: number) {
  if (score >= 70) return P.green;
  if (score >= 40) return P.yellow;
  return P.red;
}

interface Reflection {
  title: string;
  paragraphs: string[];
  mood: number;
  stability: number;
  dominant: string;
  generatedAt: string;
  sessionId?: string;
}

export default function JournalPage() {
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [entries, setEntries] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch latest on mount
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`${API}/journal/latest`, { credentials: "include" });
      const data = await res.json();
      if (data.entry) setReflection(data.entry);
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/journal/entries?limit=20`, { credentials: "include" });
      const data = await res.json();
      setEntries(data.entries || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchLatest(), fetchHistory()]).then(() => setLoading(false));
  }, [fetchLatest, fetchHistory]);

  // Animate paragraphs on reflection load
  useEffect(() => {
    if (!contentRef.current || !reflection) return;
    const paras = contentRef.current.querySelectorAll(".reflection-para");
    gsap.fromTo(paras, { opacity: 0, y: 15 }, {
      opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power3.out", delay: 0.2,
    });
  }, [reflection]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/journal/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.error) {
        setReflection(data);
        fetchHistory();
      }
    } catch { /* silent */ }
    setGenerating(false);
  };

  const viewEntry = (entry: Reflection) => {
    setReflection(entry);
    setShowHistory(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ background: P.bg, color: P.text }}>
      {/* Nav */}
      <nav className="sticky top-0 z-40 px-6 h-14 flex items-center justify-between"
        style={{ background: `${P.surface}E6`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${P.border}40` }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-black transition-transform group-hover:scale-110"
              style={{ background: P.orange, color: P.bg }}>N</div>
          </Link>
          <span className="text-sm font-bold">Journal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(!showHistory)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ background: showHistory ? `${P.accent}20` : P.surfaceLight, color: showHistory ? P.accent : P.dim, border: `1px solid ${P.border}` }}>
            {showHistory ? "Hide History" : "📜 History"}
          </button>
          <Link href="/dashboard" className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: P.surfaceLight, color: P.dim, border: `1px solid ${P.border}` }}>
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="flex items-center justify-center h-60">
            <div className="text-sm animate-pulse" style={{ color: P.dim }}>Loading reflections...</div>
          </div>
        ) : showHistory ? (
          /* ── HISTORY VIEW ──────────────────────────── */
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Past Reflections</h2>
            {entries.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-3xl mb-3">📝</p>
                <p className="text-sm" style={{ color: P.dim }}>No journal entries yet. Generate your first reflection!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry, i) => (
                  <button key={i} onClick={() => viewEntry(entry)}
                    className="w-full text-left rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                    style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold" style={{ color: P.text }}>{entry.title}</span>
                      <span className="text-[10px]" style={{ color: P.muted }}>
                        {new Date(entry.generatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: `${moodColor(entry.mood)}20`, color: moodColor(entry.mood) }}>
                        Mood: {entry.mood}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: `${EMOTION_COLORS[entry.dominant] || P.dim}20`, color: EMOTION_COLORS[entry.dominant] || P.dim }}>
                        {entry.dominant}
                      </span>
                      <span className="text-xs" style={{ color: P.muted }}>Stability: {entry.stability}%</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── REFLECTION VIEW ───────────────────────── */
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: P.orange }}>AI Reflection</p>
                <h1 className="text-3xl font-black mt-1">{reflection?.title || "Your Reflection"}</h1>
              </div>
              <button onClick={handleGenerate} disabled={generating}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: P.orange, color: P.bg }}>
                {generating ? "✨ Generating..." : "✨ Generate New Reflection"}
              </button>
            </div>

            {reflection ? (
              <>
                {/* Mood/Stability/Emotion cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4 text-center" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                    <div className="text-2xl font-black" style={{ color: moodColor(reflection.mood) }}>{reflection.mood}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: P.muted }}>Mood</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                    <div className="text-2xl font-black" style={{ color: P.accent }}>{reflection.stability}%</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: P.muted }}>Stability</div>
                  </div>
                  <div className="rounded-2xl p-4 text-center" style={{ background: `${P.surface}90`, border: `1px solid ${P.border}40` }}>
                    <div className="text-2xl font-black capitalize" style={{ color: EMOTION_COLORS[reflection.dominant] || P.dim }}>
                      {reflection.dominant}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: P.muted }}>Dominant</div>
                  </div>
                </div>

                {/* Paragraphs */}
                <div ref={contentRef} className="space-y-5">
                  {reflection.paragraphs.map((para, i) => (
                    <p key={i} className="reflection-para text-base leading-relaxed opacity-0"
                      style={{ color: i === reflection.paragraphs.length - 1 ? P.green : P.dim }}
                      dangerouslySetInnerHTML={{
                        __html: para
                          .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${P.text}">$1</strong>`)
                          .replace(/💡/g, "💡")
                      }}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: `${P.border}40` }}>
                  <Link href="/mood-analyze"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{ background: P.orange, color: P.bg }}>
                    📹 New Session
                  </Link>
                  <Link href="/relief"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${P.green}, ${P.blue})`, color: "#fff" }}>
                    🌿 Relief Journey
                  </Link>
                  <Link href="/dashboard"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{ background: P.surfaceLight, color: P.dim, border: `1px solid ${P.border}` }}>
                    📊 Dashboard
                  </Link>
                </div>
              </>
            ) : (
              /* No reflection yet */
              <div className="py-16 text-center rounded-2xl" style={{ background: `${P.surface}50`, border: `1px solid ${P.border}40` }}>
                <p className="text-5xl mb-4">🪞</p>
                <h3 className="text-xl font-bold mb-2">No Reflection Yet</h3>
                <p className="text-sm mb-6" style={{ color: P.dim }}>
                  Complete a mood analysis session, then generate your first AI reflection.
                </p>
                <div className="flex justify-center gap-3">
                  <Link href="/mood-analyze"
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105"
                    style={{ background: P.orange, color: P.bg }}>
                    Start a Session First
                  </Link>
                  <button onClick={handleGenerate} disabled={generating}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50"
                    style={{ background: P.accent, color: "#fff" }}>
                    {generating ? "Generating..." : "Try Anyway"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
