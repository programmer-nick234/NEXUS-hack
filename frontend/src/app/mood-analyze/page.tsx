"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import axios from "axios";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type FaceEmotion = "happy" | "sad" | "angry" | "neutral" | "surprised" | "fear" | "disgust";

interface InterventionParams {
  breathSpeed: number;
  color: string;
  particleSpeed: number;
}

interface AnalysisResult {
  emotionalState: string;
  intensity: number;
  anxietyScore: number;
  interventionType: string;
  parameters: InterventionParams;
}

interface ReportEntry {
  time: string;
  emotion: string;
  anxiety: number;
  state: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & PALETTE
   ═══════════════════════════════════════════════════════════════════════════ */

const API_EMOTION = "http://localhost:8000/api/v1/face/detect-emotion";
const API_ANALYZE = "http://localhost:8000/api/v1/anxiety/analyze-state";

const PALETTE = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceLight: "#334155",
  border: "#475569",
  accent: "#818CF8",
  text: "#F8FAFC",
  textDim: "#94A3B8",
  textMuted: "#64748B",
  green: "#34D399",
  red: "#F87171",
  yellow: "#FBBF24",
  blue: "#60A5FA",
  purple: "#A78BFA",
};

const EMOTION_COLORS: Record<string, string> = {
  happy: "#FBBF24",
  sad: "#60A5FA",
  angry: "#F87171",
  neutral: "#F8FAFC",
  surprised: "#A78BFA",
  fear: "#F59E0B",
  disgust: "#34D399",
  overstimulated: "#F87171",
  anxious: "#60A5FA",
  regulated: "#34D399",
  impulsive: "#F59E0B",
};

const EMOJI_MAP: Record<string, string> = {
  happy: "😊", sad: "😢", angry: "😡", neutral: "😐",
  surprised: "😮", fear: "😨", disgust: "🤢",
  overstimulated: "🔥", anxious: "😟", regulated: "🧘", impulsive: "⚡",
};

/* ═══════════════════════════════════════════════════════════════════════════
   THREE.JS COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function ParticleField({ speed, color }: { speed: number; color: string }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 1500;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 8;
      p[i * 3 + 1] = (Math.random() - 0.5) * 8;
      p[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return p;
  }, []);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.04 * speed;
    ref.current.rotation.x = t * 0.02 * speed;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color={color} size={0.015} sizeAttenuation depthWrite={false} opacity={0.35} />
    </Points>
  );
}

function BreathingOrb({ color, breathSpeed, vibrate }: { color: string; breathSpeed: number; vibrate: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    const scale = 1 + Math.sin(t / breathSpeed) * 0.1;
    ref.current.scale.set(scale, scale, scale);
    if (vibrate) {
      ref.current.position.x = Math.sin(t * 40) * 0.015;
      ref.current.position.y = Math.cos(t * 40) * 0.015;
    } else {
      ref.current.position.set(0, 0, 0);
    }
  });

  return (
    <Sphere ref={ref} args={[1, 64, 64]}>
      <MeshDistortMaterial color={color} speed={2} distort={0.35} radius={1} />
    </Sphere>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function PulseRing({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="w-48 h-48 rounded-full animate-ping opacity-20"
        style={{ borderColor: color, borderWidth: 2, borderStyle: "solid" }}
      />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MoodAnalyzePage() {
  // ── Face emotion state ─────────────────────────────────────────────────
  const [faceEmotion, setFaceEmotion] = useState<string>("neutral");
  const [confidence, setConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(true);

  // ── Gesture / anxiety state ────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [gestureActive, setGestureActive] = useState(false);

  // ── Report history ─────────────────────────────────────────────────────
  const [report, setReport] = useState<ReportEntry[]>([]);

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const centerLabelRef = useRef<HTMLDivElement>(null);
  const gestureZoneRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({
    startTime: 0,
    points: [] as { x: number; y: number; t: number }[],
    isDown: false,
  });

  // ── Derived visuals ────────────────────────────────────────────────────
  const activeColor = analysis?.parameters.color ?? EMOTION_COLORS[faceEmotion] ?? PALETTE.accent;
  const breathSpeed = analysis?.parameters.breathSpeed ?? 4;
  const particleSpeed = analysis?.parameters.particleSpeed ?? 1;
  const isVibrate = analysis?.emotionalState === "overstimulated";

  // ── Webcam ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { /* camera denied or unavailable */ }
    })();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // ── Backend polling (face emotion) ─────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await axios.get(API_EMOTION);
        if (r.data.success) {
          setFaceEmotion(r.data.emotion.toLowerCase());
          setConfidence(r.data.confidence);
          setIsDetecting(true);
        }
      } catch {
        setIsDetecting(false);
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // ── GSAP emoji bounce on change ────────────────────────────────────────
  useEffect(() => {
    if (emojiRef.current) {
      gsap.fromTo(emojiRef.current, { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.5, ease: "elastic.out(1,0.4)" });
    }
  }, [faceEmotion, analysis]);

  // ── GSAP center label fade ─────────────────────────────────────────────
  useEffect(() => {
    if (centerLabelRef.current) {
      gsap.fromTo(centerLabelRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 });
    }
  }, [faceEmotion, analysis]);

  // ── Gesture handlers ───────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    gesture.current = { startTime: Date.now(), points: [{ x: e.clientX, y: e.clientY, t: Date.now() }], isDown: true };
    setGestureActive(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!gesture.current.isDown) return;
    gesture.current.points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
  }, []);

  const onPointerUp = useCallback(async () => {
    if (!gesture.current.isDown) return;
    gesture.current.isDown = false;
    setGestureActive(false);

    const { startTime, points } = gesture.current;
    if (points.length < 2) return;

    const duration = Date.now() - startTime;
    let totalDist = 0, dirChanges = 0, prevAngle: number | null = null;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      if (prevAngle !== null && Math.abs(angle - prevAngle) > Math.PI / 4) dirChanges++;
      prevAngle = angle;
    }

    const avgSpeed = totalDist / (duration / 1000);
    const speeds: number[] = [];
    for (let i = 1; i < points.length; i++) {
      const d = Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
      const dt = (points[i].t - points[i - 1].t) / 1000;
      if (dt > 0) speeds.push(d / dt);
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / (speeds.length || 1);
    const rawVar = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / (speeds.length || 1);
    const variance = Math.min(rawVar / 100000, 1);

    const holdDuration = duration > 1500 && totalDist < 50 ? duration : Math.min(duration * 0.3, 500);

    try {
      const r = await axios.post(API_ANALYZE, {
        duration, avgSpeed: Math.round(avgSpeed), directionChanges: dirChanges,
        variance: Math.round(variance * 100) / 100, holdDuration: Math.round(holdDuration),
      });
      setAnalysis(r.data);

      setReport((prev) => [
        {
          time: new Date().toLocaleTimeString(),
          emotion: faceEmotion,
          anxiety: r.data.anxietyScore,
          state: r.data.emotionalState,
        },
        ...prev.slice(0, 9),
      ]);
    } catch { /* backend unavailable */ }
  }, [faceEmotion]);

  // ── Display state label ────────────────────────────────────────────────
  const displayState = analysis?.emotionalState ?? faceEmotion;
  const displayEmoji = EMOJI_MAP[displayState] ?? EMOJI_MAP[faceEmotion] ?? "😐";

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none font-sans" style={{ background: PALETTE.bg }}>
      {/* ── Ambient glow overlay ── */}
      <div className="absolute inset-0 pointer-events-none transition-colors duration-700 opacity-10" style={{ backgroundColor: activeColor }} />

      {/* ═══════ GRID ═════════════════════════════════════════════════════ */}
      <div className="relative z-10 grid grid-cols-[320px_1fr_340px] grid-rows-[1fr_1fr] h-full gap-0">

        {/* ─── TOP-LEFT: Webcam Preview ───────────────────────────────── */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>OpenCV Detection</p>
          <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: PALETTE.border, background: "#000" }}>
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-video object-cover opacity-70" />
            {/* Live badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ background: "rgba(0,0,0,0.6)", color: isDetecting ? PALETTE.green : PALETTE.red }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isDetecting ? PALETTE.green : PALETTE.red }} />
              {isDetecting ? "LIVE" : "OFFLINE"}
            </div>
            {/* Emotion overlay */}
            <div className="absolute bottom-0 inset-x-0 px-3 py-2" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
              <p className="text-lg font-bold capitalize" style={{ color: EMOTION_COLORS[faceEmotion] ?? PALETTE.text }}>{faceEmotion}</p>
              <p className="text-[10px]" style={{ color: PALETTE.textDim }}>{(confidence * 100).toFixed(0)}% confidence</p>
            </div>
          </div>
          {/* Emotion breakdown bars */}
          <div className="space-y-1.5 mt-1">
            {["happy", "sad", "angry", "neutral", "surprised"].map((e) => (
              <div key={e} className="flex items-center gap-2">
                <span className="text-[9px] uppercase w-14 text-right font-medium" style={{ color: PALETTE.textMuted }}>{e}</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: faceEmotion === e ? `${Math.max(confidence * 100, 20)}%` : "5%", background: EMOTION_COLORS[e] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── CENTER: 3D Orb ─────────────────────────────────────────── */}
        <div className="row-span-2 relative flex items-center justify-center">
          {/* Three.js canvas */}
          <Canvas camera={{ position: [0, 0, 3.5] }} className="!absolute inset-0">
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1.2} color={activeColor} />
            <ParticleField speed={particleSpeed} color={activeColor} />
            <BreathingOrb color={activeColor} breathSpeed={breathSpeed} vibrate={isVibrate} />
          </Canvas>

          {/* Pulse ring */}
          <PulseRing color={activeColor} />

          {/* Center text overlay */}
          <div ref={centerLabelRef} className="absolute z-20 flex flex-col items-center gap-2 pointer-events-none">
            <div ref={emojiRef} className="text-7xl drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">{displayEmoji}</div>
            <h1 className="text-3xl font-extrabold capitalize tracking-tight" style={{ color: PALETTE.text }}>{displayState}</h1>
            {analysis && (
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: activeColor }}>
                {analysis.interventionType} · {(analysis.intensity * 100).toFixed(0)}%
              </p>
            )}
            {gestureActive && <ThinkingDots />}
          </div>

          {/* Bottom instruction */}
          <p className="absolute bottom-6 text-[10px] font-bold tracking-[0.3em] uppercase z-20" style={{ color: PALETTE.textMuted }}>
            Swipe naturally to analyze
          </p>
        </div>

        {/* ─── TOP-RIGHT: Emotion Visualization ───────────────────────── */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>Emotional Output</p>

          <div className="rounded-2xl p-4 flex flex-col items-center gap-3" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
            <div className="text-6xl">{displayEmoji}</div>
            <p className="text-xl font-bold capitalize" style={{ color: activeColor }}>{displayState}</p>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(analysis?.intensity ?? confidence) * 100}%`, background: activeColor }} />
            </div>
            <p className="text-[10px]" style={{ color: PALETTE.textDim }}>Intensity: {((analysis?.intensity ?? confidence) * 100).toFixed(0)}%</p>
          </div>

          {/* Intervention card */}
          {analysis && (
            <div className="rounded-2xl p-4 space-y-2" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: PALETTE.textMuted }}>Intervention</p>
              <p className="text-sm font-semibold capitalize" style={{ color: activeColor }}>{analysis.interventionType}</p>
              <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: PALETTE.textDim }}>
                <span>Breath: {analysis.parameters.breathSpeed}s</span>
                <span>Particles: {analysis.parameters.particleSpeed}</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── BOTTOM-LEFT: Gesture Zone ──────────────────────────────── */}
        <div
          ref={gestureZoneRef}
          className="p-5 flex flex-col justify-end"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div
            className="rounded-2xl p-4 flex flex-col gap-3 cursor-grab active:cursor-grabbing transition-shadow duration-300"
            style={{
              background: gestureActive ? `${activeColor}10` : PALETTE.surface,
              border: `1px solid ${gestureActive ? activeColor : PALETTE.border}`,
              boxShadow: gestureActive ? `0 0 30px ${activeColor}30` : "none",
            }}
          >
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>Gesture Zone</p>
            <div className="h-24 rounded-xl flex items-center justify-center" style={{ background: PALETTE.surfaceLight }}>
              {gestureActive ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-bold animate-pulse" style={{ color: activeColor }}>Capturing...</span>
                  <ThinkingDots />
                </div>
              ) : (
                <p className="text-xs" style={{ color: PALETTE.textMuted }}>Swipe or hold here</p>
              )}
            </div>
            {analysis && (
              <div className="flex justify-between text-[10px]" style={{ color: PALETTE.textDim }}>
                <span>Score: {(analysis.anxietyScore * 100).toFixed(0)}%</span>
                <span className="capitalize font-semibold" style={{ color: activeColor }}>{analysis.emotionalState}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM-RIGHT: Mini Report ──────────────────────────────── */}
        <div className="p-5 flex flex-col justify-end">
          <div className="rounded-2xl p-4 space-y-3 max-h-[280px] overflow-hidden" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>Session Report</p>

            {report.length === 0 ? (
              <p className="text-xs py-4 text-center" style={{ color: PALETTE.textMuted }}>Interact to generate insights</p>
            ) : (
              <div className="space-y-2">
                {report.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b" style={{ borderColor: PALETTE.surfaceLight }}>
                    <span className="w-12 shrink-0 font-mono" style={{ color: PALETTE.textMuted }}>{r.time.split(" ")[0]}</span>
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: EMOTION_COLORS[r.state] ?? PALETTE.accent }} />
                    <span className="capitalize font-medium flex-1" style={{ color: PALETTE.text }}>{r.state}</span>
                    <span className="font-mono" style={{ color: PALETTE.textDim }}>{(r.anxiety * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {report.length > 0 && (
              <div className="pt-2 border-t flex justify-between text-[10px]" style={{ borderColor: PALETTE.surfaceLight }}>
                <span style={{ color: PALETTE.textMuted }}>Avg anxiety</span>
                <span className="font-bold" style={{ color: activeColor }}>
                  {(report.reduce((a, r) => a + r.anxiety, 0) / report.length * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── System footer ─────────────────────────────────────────────── */}
      <div className="absolute bottom-2 left-5 text-[8px] font-mono z-30" style={{ color: PALETTE.textMuted + "40" }}>
        NEXUS_ALT_UI_v2.0 // EMOTION_GESTURE_SYNC
      </div>
      <div className="absolute bottom-2 right-5 text-[8px] font-mono z-30" style={{ color: PALETTE.textMuted + "40" }}>
        WILDCARD_2 // NO_INPUT_PROTOCOL
      </div>
    </main>
  );
}
