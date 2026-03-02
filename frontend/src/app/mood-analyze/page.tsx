"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { useSessionStore, useGamificationStore } from "@/store";
import Link from "next/link";

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

interface HandGestureData {
  gesture: string;
  confidence: number;
  fingerCount: number;
  handRect: number[] | null;
  handCenter: number[] | null;
  isMoving: boolean;
  solidity?: number;
}

interface HeadPoseData {
  headPose: string;
  isNodding: boolean;
  isShaking: boolean;
  tilt: number;
  movement: number;
}

interface MicroExprData {
  microExpressionDetected: boolean;
  changeIntensity: number;
  recentVolatility: number;
}

interface GestureData {
  hand: HandGestureData;
  headPose: HeadPoseData;
  microExpression: MicroExprData;
  gestureEmotionModifiers: {
    emotionBoost: Record<string, number>;
    anxietyModifier: number;
    engagement: number;
  };
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

const API_BASE = "http://localhost:8000/api/v1";
const API_FACE_ANALYZE = `${API_BASE}/face/analyze`;
const API_ANXIETY = `${API_BASE}/anxiety/analyze-state`;

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

/**
 * Cinematic Smoke Animation — 2 000 particle system
 * ──────────────────────────────────────────────────
 * Three behavioural stages:
 *   1. **Idle Flow** — particles drift softly top-left → top-right
 *   2. **Emotion Wrapping** — when an emotion is detected the smoke is pulled
 *      toward the center orb and orbits it, color-synced to the emotion
 *   3. **Gesture Pulling** — when the user swipes in the Gesture Zone the
 *      smoke density shifts toward the bottom-left following the pointer
 *
 * On "End Session" the smoke explodes outward and fades to zero opacity.
 *
 * Uses AdditiveBlending so overlapping particles glow brighter during
 * high-intensity or high-anxiety moments.
 */
function CinematicSmoke({
  color,
  emotion,
  gestureActive,
  gesturePos,
  sessionEnded,
  intensity,
}: {
  color: string;
  emotion: string;
  gestureActive: boolean;
  gesturePos: { x: number; y: number };
  sessionEnded: boolean;
  intensity: number;
}) {
  const PARTICLE_COUNT = 2000;
  const ref = useRef<THREE.Points>(null!);

  // Persisted per-particle state: base position + velocity + life
  const { positions, velocities, basePositions, lifetimes, opacities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const base = new Float32Array(PARTICLE_COUNT * 3);
    const life = new Float32Array(PARTICLE_COUNT);
    const opa = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 8;
      const z = (Math.random() - 0.5) * 6;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      base[i * 3] = x;
      base[i * 3 + 1] = y;
      base[i * 3 + 2] = z;
      vel[i * 3] = (Math.random() - 0.3) * 0.02;     // mild rightward drift
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
      life[i] = Math.random();
      opa[i] = 0.25 + Math.random() * 0.25;
    }
    return { positions: pos, velocities: vel, basePositions: base, lifetimes: life, opacities: opa };
  }, []);

  // Track explosion state
  const explosionRef = useRef(false);
  const fadeRef = useRef(1.0);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const geo = ref.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    const isNeutral = emotion === "neutral";
    const emotionDetected = !isNeutral && emotion !== "";

    // Session ended → explosion
    if (sessionEnded && !explosionRef.current) {
      explosionRef.current = true;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const dx = arr[i * 3];
        const dy = arr[i * 3 + 1];
        const dz = arr[i * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        velocities[i * 3] = (dx / dist) * (0.15 + Math.random() * 0.2);
        velocities[i * 3 + 1] = (dy / dist) * (0.15 + Math.random() * 0.2);
        velocities[i * 3 + 2] = (dz / dist) * (0.1 + Math.random() * 0.15);
      }
    }

    if (explosionRef.current) {
      fadeRef.current = Math.max(fadeRef.current - 0.008, 0);
    }

    // Intensity modulates behaviour strength
    const intensity01 = Math.max(0.05, Math.min(1, intensity));

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;

      let x = arr[ix];
      let y = arr[iy];
      let z = arr[iz];

      if (explosionRef.current) {
        // Explosion: just apply velocity outward
        x += velocities[ix] * 1.5;
        y += velocities[iy] * 1.5;
        z += velocities[iz] * 1.5;
      } else if (gestureActive) {
        // ═══ STAGE 3: Gesture Pulling ═══
        // Pull smoke toward bottom-left gesture area
        const gx = (gesturePos.x - 0.5) * 6 - 2;   // map [0,1] → world space, biased left
        const gy = (0.5 - gesturePos.y) * 5 - 1.5;  // map [0,1] → world space, biased down
        const pullForce = 0.04 * intensity01;

        x += (gx - x) * pullForce + Math.sin(t * 3 + i) * 0.008;
        y += (gy - y) * pullForce + Math.cos(t * 2.5 + i * 0.7) * 0.006;
        z += (Math.sin(t + i * 0.3) * 0.3 - z) * 0.01;

        // Speed up nearby particles
        const dg = Math.sqrt((x - gx) ** 2 + (y - gy) ** 2);
        if (dg < 1.5) {
          x += Math.sin(t * 5 + i) * 0.015 * intensity01;
          y += Math.cos(t * 4 + i * 1.3) * 0.012 * intensity01;
        }
      } else if (emotionDetected) {
        // ═══ STAGE 2: Emotion Wrapping ═══
        // Pull toward center orb (0,0,0) and orbit around it
        const toCenter = 0.012 * intensity01;
        const orbitRadius = 2.0 + Math.sin(i * 0.1) * 0.8;
        const orbitSpeed = 0.3 + intensity01 * 0.4;
        const orbitAngle = t * orbitSpeed + (i / PARTICLE_COUNT) * Math.PI * 2;

        const targetX = Math.cos(orbitAngle + i * 0.01) * orbitRadius;
        const targetY = Math.sin(orbitAngle * 0.7 + i * 0.02) * orbitRadius * 0.6;
        const targetZ = Math.sin(orbitAngle * 0.5 + i * 0.015) * 1.5;

        x += (targetX - x) * toCenter;
        y += (targetY - y) * toCenter;
        z += (targetZ - z) * toCenter * 0.5;

        // Add turbulence based on emotion intensity
        x += Math.sin(t * 1.5 + i * 0.4) * 0.003 * intensity01;
        y += Math.cos(t * 1.2 + i * 0.3) * 0.003 * intensity01;
      } else {
        // ═══ STAGE 1: Idle Flow ═══
        // Gentle drift from top-left to top-right
        x += velocities[ix] + Math.sin(t * 0.5 + i * 0.1) * 0.002;
        y += velocities[iy] + Math.cos(t * 0.3 + i * 0.05) * 0.001;
        z += velocities[iz];

        // Wrap around
        if (x > 5) x = -5 + Math.random();
        if (x < -5) x = 5 - Math.random();
        if (y > 4) y = -4 + Math.random();
        if (y < -4) y = 4 - Math.random();
        if (z > 3) z = -3;
        if (z < -3) z = 3;
      }

      arr[ix] = x;
      arr[iy] = y;
      arr[iz] = z;
    }

    posAttr.needsUpdate = true;

    // Update material opacity for explosion fade
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = (0.3 + intensity01 * 0.2) * fadeRef.current;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        transparent
        color={color}
        size={0.025}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.35}
      />
    </points>
  );
}

/* Legacy simple field kept as optional ambient layer */
function ParticleField({ speed, color }: { speed: number; color: string }) {
  const ref = useRef<THREE.Points>(null!);
  const count = 800;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 12;
      p[i * 3 + 1] = (Math.random() - 0.5) * 12;
      p[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return p;
  }, []);

  useFrame((s) => {
    const t = s.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.02 * speed;
    ref.current.rotation.x = t * 0.01 * speed;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color={color} size={0.008} sizeAttenuation depthWrite={false} opacity={0.15} />
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
   HELPER – capture a JPEG blob from a <video> element via a hidden canvas
   ═══════════════════════════════════════════════════════════════════════════ */

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (video.readyState < 2) return resolve(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      0.85,                           // quality – better detail for OpenCV
    );
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MoodAnalyzePage() {
  // ── Session & gamification stores ──────────────────────────────────────
  const {
    sessionId,
    isActive: sessionActive,
    startSession,
    addEmotionSnapshot,
    endSession: endSessionStore,
    lastResult,
    suggestion,
    fetchSuggestion,
    reset: resetSession,
  } = useSessionStore();

  // ── Face emotion state ─────────────────────────────────────────────────
  const [faceEmotion, setFaceEmotion] = useState<string>("neutral");
  const [confidence, setConfidence] = useState(0);
  const [faceDistribution, setFaceDistribution] = useState<Record<string,number>>({});
  const [isDetecting, setIsDetecting] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // ── Advanced engine data ───────────────────────────────────────────────
  const [actionUnits, setActionUnits] = useState<Record<string,number>>({});
  const [gestureData, setGestureData] = useState<GestureData | null>(null);
  const [stability, setStability] = useState(0);

  // ── Gesture / anxiety state ────────────────────────────────────────────
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [gestureActive, setGestureActive] = useState(false);
  const [gesturePos, setGesturePos] = useState({ x: 0.5, y: 0.5 });
  const [smokeSessionEnded, setSmokeSessionEnded] = useState(false);

  // ── Report history ─────────────────────────────────────────────────────
  const [report, setReport] = useState<ReportEntry[]>([]);

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);      // hidden capture canvas
  const emojiRef = useRef<HTMLDivElement>(null);
  const centerLabelRef = useRef<HTMLDivElement>(null);
  const gestureZoneRef = useRef<HTMLDivElement>(null);
  const faceEmotionRef = useRef<string>("neutral");       // always-fresh for callbacks
  const faceConfRef = useRef<number>(0);
  const sessionEndedRef = useRef(false);                  // stop detection loop
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

  // ── Start browser webcam ───────────────────────────────────────────────
  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        /* camera denied or unavailable */
      }
    })();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Auto-start session on mount ────────────────────────────────────────
  useEffect(() => {
    startSession();
    // Don't resetSession on unmount — let endSession handle cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Frame capture → POST /face/analyze every 2 s ──────────────────────
  useEffect(() => {
    let active = true;

    async function loop() {
      while (active && !sessionEndedRef.current) {
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas) {
            const blob = await captureFrame(video, canvas);
            if (blob) {
              const fd = new FormData();
              fd.append("file", blob, "frame.jpg");

              const res = await fetch(API_FACE_ANALYZE, { method: "POST", body: fd });
              if (res.ok) {
                const data = await res.json();
                if (data.success !== false) {
                  const emo = (data.emotion as string).toLowerCase();
                  const dist = data.distribution || {};
                  setFaceEmotion(emo);
                  setConfidence(data.confidence ?? 0);
                  setFaceDistribution(dist);
                  faceEmotionRef.current = emo;
                  faceConfRef.current = data.confidence ?? 0;
                  setIsDetecting(true);

                  // Advanced engine data
                  if (data.actionUnits) setActionUnits(data.actionUnits);
                  if (data.gestures) setGestureData(data.gestures);
                  if (data.stability != null) setStability(data.stability);

                  // Push to session store
                  addEmotionSnapshot({ emotion: emo, confidence: data.confidence ?? 0, distribution: dist });

                  // Fetch AI suggestion every 6 seconds (3 frames)
                  if (Math.random() < 0.35) {
                    fetchSuggestion(emo, data.confidence ?? 0, analysis?.anxietyScore ?? 0);
                  }
                }
              } else {
                setIsDetecting(false);
              }
            }
          }
        } catch {
          setIsDetecting(false);
        }
        // wait 1.5 seconds before next capture
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    loop();
    return () => { active = false; };
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
    // Track relative position for cinematic smoke
    const rect = gestureZoneRef.current?.getBoundingClientRect();
    if (rect) {
      setGesturePos({
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      });
    }
  }, []);

  const onPointerUp = useCallback(async () => {
    if (!gesture.current.isDown) return;
    gesture.current.isDown = false;
    setGestureActive(false);

    const { startTime, points } = gesture.current;
    if (points.length < 2) return;

    const duration = Date.now() - startTime;
    let totalDist = 0;
    let dirChanges = 0;
    let prevAngle: number | null = null;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalDist += Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      if (prevAngle !== null && Math.abs(angle - prevAngle) > Math.PI / 4) dirChanges++;
      prevAngle = angle;
    }

    const avgSpeed = totalDist / (duration / 1000);

    // per-segment speeds for variance
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
      const res = await fetch(API_ANXIETY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration,
          avgSpeed: Math.round(avgSpeed),
          directionChanges: dirChanges,
          variance: Math.round(variance * 100) / 100,
          holdDuration: Math.round(holdDuration),
          // ── NEW: forward current face emotion so backend can fuse it ──
          faceEmotion: faceEmotionRef.current,
          faceConfidence: faceConfRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);

        setReport((prev) => [
          {
            time: new Date().toLocaleTimeString(),
            emotion: faceEmotionRef.current,
            anxiety: data.anxietyScore,
            state: data.emotionalState,
          },
          ...prev.slice(0, 9),
        ]);
      }
    } catch {
      /* backend unavailable */
    }
  }, []);

  // ── Display state label ────────────────────────────────────────────────
  const displayState = analysis?.emotionalState ?? faceEmotion;
  const displayEmoji = EMOJI_MAP[displayState] ?? EMOJI_MAP[faceEmotion] ?? "😐";

  // ── Session end handler ────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    // Stop detection loop first so no more requests fly during end
    sessionEndedRef.current = true;
    // Trigger smoke explosion
    setSmokeSessionEnded(true);
    const result = await endSessionStore();
    if (result) {
      setShowEndModal(true);
    } else {
      // Still show modal with local data on failure
      setShowEndModal(true);
    }
  }, [endSessionStore]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none font-sans" style={{ background: PALETTE.bg }}>
      {/* Hidden canvas used to snapshot the <video> element */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Ambient glow overlay ── */}
      <div className="absolute inset-0 pointer-events-none transition-colors duration-700 opacity-10" style={{ backgroundColor: activeColor }} />

      {/* ═══════ GRID ═════════════════════════════════════════════════════ */}
      <div className="relative z-10 grid grid-cols-[380px_1fr_360px] grid-rows-[1fr_auto] h-full gap-0">

        {/* ─── TOP-LEFT: Webcam Preview ───────────────────────────────── */}
        <div className="p-4 flex flex-col gap-2 overflow-y-auto">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>FACS Engine · OpenCV</p>
          <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: PALETTE.border, background: "#000" }}>
            <video ref={videoRef} autoPlay muted playsInline className="w-full aspect-[4/3] object-cover" />
            {/* Live badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider" style={{ background: "rgba(0,0,0,0.6)", color: isDetecting ? PALETTE.green : PALETTE.red }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: isDetecting ? PALETTE.green : PALETTE.red }} />
              {isDetecting ? "LIVE" : "OFFLINE"}
            </div>
            {/* Stability badge */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold" style={{ background: "rgba(0,0,0,0.6)", color: stability > 0.7 ? PALETTE.green : stability > 0.4 ? PALETTE.yellow : PALETTE.red }}>
              {(stability * 100).toFixed(0)}% stable
            </div>
            {/* Emotion overlay */}
            <div className="absolute bottom-0 inset-x-0 px-3 py-2" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
              <p className="text-lg font-bold capitalize" style={{ color: EMOTION_COLORS[faceEmotion] ?? PALETTE.text }}>{faceEmotion}</p>
              <p className="text-[10px]" style={{ color: PALETTE.textDim }}>{(confidence * 100).toFixed(0)}% confidence</p>
            </div>
          </div>

          {/* Emotion breakdown bars */}
          <div className="space-y-1 mt-1">
            {(["happy", "sad", "angry", "neutral", "surprised", "fear", "disgust"] as const).map((e) => {
              const pct = faceDistribution[e] ? faceDistribution[e] * 100 : (faceEmotion === e ? Math.max(confidence * 100, 20) : 5);
              return (
                <div key={e} className="flex items-center gap-2">
                  <span className="text-[9px] uppercase w-14 text-right font-medium" style={{ color: PALETTE.textMuted }}>{e}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: EMOTION_COLORS[e] }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Action Units (FACS) ── */}
          {Object.keys(actionUnits).length > 0 && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: PALETTE.textMuted }}>Action Units (FACS)</p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                {Object.entries(actionUnits).sort((a,b) => b[1] - a[1]).slice(0, 9).map(([au, val]) => (
                  <div key={au} className="flex items-center gap-1">
                    <span className="text-[8px] font-mono w-8" style={{ color: PALETTE.textMuted }}>{au}</span>
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(val * 100, 100)}%`, background: val > 0.6 ? PALETTE.accent : PALETTE.textMuted }} />
                    </div>
                    <span className="text-[8px] font-mono w-6 text-right" style={{ color: PALETTE.textDim }}>{(val * 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Hand Gesture Card ── */}
          {gestureData && gestureData.hand.gesture !== "none" && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: PALETTE.textMuted }}>Hand Gesture</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {gestureData.hand.gesture === "open_palm" ? "✋" :
                   gestureData.hand.gesture === "fist" ? "✊" :
                   gestureData.hand.gesture === "peace" ? "✌️" :
                   gestureData.hand.gesture === "pointing" ? "👆" :
                   gestureData.hand.gesture === "thumbs_up" ? "👍" :
                   gestureData.hand.gesture === "wave" ? "👋" : "🤚"}
                </span>
                <div>
                  <p className="text-sm font-bold capitalize" style={{ color: PALETTE.text }}>{gestureData.hand.gesture.replace("_", " ")}</p>
                  <p className="text-[9px]" style={{ color: PALETTE.textDim }}>
                    {gestureData.hand.fingerCount} fingers · {(gestureData.hand.confidence * 100).toFixed(0)}% conf
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Head Pose + Micro-expression ── */}
          {gestureData && (gestureData.headPose.headPose !== "neutral" || gestureData.microExpression.microExpressionDetected) && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
              {gestureData.headPose.headPose !== "neutral" && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase" style={{ color: PALETTE.textMuted }}>Head</span>
                  <span className="text-xs font-medium capitalize" style={{ color: PALETTE.accent }}>
                    {gestureData.headPose.headPose.replace("_", " ")}
                    {gestureData.headPose.isNodding && " (nodding)"}
                    {gestureData.headPose.isShaking && " (shaking)"}
                  </span>
                </div>
              )}
              {gestureData.microExpression.microExpressionDetected && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase" style={{ color: PALETTE.yellow }}>⚡ Micro-Expression</span>
                  <span className="text-[10px]" style={{ color: PALETTE.textDim }}>
                    Δ{(gestureData.microExpression.changeIntensity * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── CENTER: 3D Orb ─────────────────────────────────────────── */}
        <div className="row-span-2 relative flex items-center justify-center">
          {/* Three.js canvas */}
          <Canvas camera={{ position: [0, 0, 3.5] }} className="!absolute inset-0">
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1.2} color={activeColor} />
            {/* Cinematic smoke — the star of the show */}
            <CinematicSmoke
              color={activeColor}
              emotion={faceEmotion}
              gestureActive={gestureActive}
              gesturePos={gesturePos}
              sessionEnded={smokeSessionEnded}
              intensity={analysis?.intensity ?? 0.3}
            />
            {/* Ambient dust layer */}
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
        <div className="p-5 flex flex-col gap-3 overflow-y-auto">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: PALETTE.textMuted }}>Emotional Output</p>
            <button
              onClick={handleEndSession}
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-colors hover:bg-red-500/20"
              style={{ borderColor: PALETTE.red, color: PALETTE.red }}
            >
              End Session
            </button>
          </div>

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

          {/* AI Suggestion card */}
          {suggestion && suggestion.suggestions.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: PALETTE.textMuted }}>AI Suggestion</p>
              <p className="text-xs" style={{ color: PALETTE.textDim }}>{suggestion.message}</p>
              <div className="space-y-1.5">
                {suggestion.suggestions.slice(0, 2).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: PALETTE.surfaceLight }}>
                    <span className="text-lg">{s.icon}</span>
                    <div>
                      <p className="text-[11px] font-medium" style={{ color: PALETTE.text }}>{s.name}</p>
                      <p className="text-[9px]" style={{ color: PALETTE.textMuted }}>{s.category} · {s.duration_sec}s</p>
                    </div>
                  </div>
                ))}
              </div>
              {suggestion.pattern.insight && (
                <p className="text-[10px] italic pt-1" style={{ color: PALETTE.accent }}>{suggestion.pattern.insight}</p>
              )}
            </div>
          )}
        </div>

        {/* ─── BOTTOM-LEFT: Gesture Zone ──────────────────────────────── */}
        <div
          ref={gestureZoneRef}
          className="p-4 flex flex-col justify-end"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div
            className="rounded-2xl p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-shadow duration-300"
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
            {/* Engagement meter from gesture engine */}
            {gestureData && (
              <div className="flex items-center gap-2 text-[9px]">
                <span style={{ color: PALETTE.textMuted }}>Engagement</span>
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${gestureData.gestureEmotionModifiers.engagement * 100}%`, background: PALETTE.accent }} />
                </div>
                <span className="font-mono" style={{ color: PALETTE.textDim }}>{(gestureData.gestureEmotionModifiers.engagement * 100).toFixed(0)}%</span>
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

      {/* ═══ Session End Modal ═════════════════════════════════════════════ */}
      {showEndModal && lastResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-3xl p-8 max-w-md w-full space-y-5" style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.border}` }}>
            <h2 className="text-2xl font-bold text-center" style={{ color: PALETTE.text }}>Session Complete!</h2>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold" style={{ color: PALETTE.green }}>{lastResult.moodScore ?? 0}</p>
                <p className="text-[10px]" style={{ color: PALETTE.textMuted }}>Mood Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: PALETTE.purple }}>{lastResult.stabilityIndex ?? 0}</p>
                <p className="text-[10px]" style={{ color: PALETTE.textMuted }}>Stability</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: PALETTE.blue }}>{Math.round((lastResult.durationSec || 0) / 60)}m</p>
                <p className="text-[10px]" style={{ color: PALETTE.textMuted }}>Duration</p>
              </div>
            </div>

            {/* XP gain */}
            {lastResult.sessionXp && (
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: PALETTE.accent }}>+{lastResult.sessionXp} XP</p>
                {lastResult.level && (
                  <p className="text-xs" style={{ color: PALETTE.textDim }}>Level {lastResult.level}</p>
                )}
                {lastResult.levelProgress && (
                  <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: PALETTE.surfaceLight }}>
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${lastResult.levelProgress.percent}%` }} />
                  </div>
                )}
              </div>
            )}

            {/* New badges */}
            {lastResult.newBadges && lastResult.newBadges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-center" style={{ color: PALETTE.yellow }}>New Badge{lastResult.newBadges.length > 1 ? "s" : ""}!</p>
                <div className="flex justify-center gap-3">
                  {lastResult.newBadges.map((b: any) => (
                    <div key={b.id} className="text-center">
                      <span className="text-3xl">{b.icon}</span>
                      <p className="text-[10px] font-medium" style={{ color: PALETTE.text }}>{b.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dominant emotion */}
            <div className="text-center">
              <span className="text-4xl">{EMOJI_MAP[lastResult.dominantEmotion || "neutral"] || "😐"}</span>
              <p className="text-sm capitalize font-medium mt-1" style={{ color: PALETTE.text }}>
                Dominant: {lastResult.dominantEmotion || "neutral"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link
                href="/relief"
                className="w-full py-2.5 rounded-xl text-sm font-bold text-center transition-colors"
                style={{ background: `linear-gradient(135deg, ${PALETTE.green}, ${PALETTE.blue})`, color: "#fff" }}
              >
                🌿 Start Relief Journey
              </Link>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowEndModal(false); resetSession(); startSession(); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{ background: PALETTE.accent, color: "#fff" }}
                >
                  New Session
                </button>
                <Link
                  href="/session-results"
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-center transition-colors border"
                  style={{ borderColor: PALETTE.border, color: PALETTE.text }}
                >
                  View Analytics
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
