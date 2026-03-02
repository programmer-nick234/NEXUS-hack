"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, MeshDistortMaterial, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import Lenis from "lenis";
import axios from "axios";

// --- Types ---
type Emotion = "happy" | "sad" | "angry" | "neutral" | "surprised" | "nervous" | "anxious" | "calm";

interface EmotionData {
  emotion: string;
  confidence: number;
}

interface GestureData {
  totalDuration: number;
  totalDistance: number;
  averageSpeed: number;
  directionChanges: number;
  movementVariance: number;
  holdDuration: number;
}

// --- Constants ---
const BACKEND_URL = "http://localhost:8000/api/v1/face/detect-emotion";

const EMOTION_THEMES: Record<Emotion, { color: string; speed: number; particleSpeed: number }> = {
  happy: { color: "#fbbf24", speed: 2.5, particleSpeed: 1.5 },
  sad: { color: "#3b82f6", speed: 0.8, particleSpeed: 0.5 },
  angry: { color: "#ef4444", speed: 4.0, particleSpeed: 3.0 },
  neutral: { color: "#f8fafc", speed: 1.5, particleSpeed: 1.0 },
  surprised: { color: "#a855f7", speed: 3.5, particleSpeed: 2.0 },
  nervous: { color: "#f59e0b", speed: 4.5, particleSpeed: 4.0 }, // Frontend gesture only
  anxious: { color: "#0ea5e9", speed: 2.0, particleSpeed: 1.2 }, // Frontend gesture only
  calm: { color: "#10b981", speed: 0.5, particleSpeed: 0.3 },   // Frontend gesture only
};

const EMOJI_MAP: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😡",
  neutral: "😐",
  surprised: "😮",
  nervous: "😰",
  anxious: "😟",
  calm: "😌",
};

// --- Three.js Components ---

const ParticleBackground = ({ emotion }: { emotion: Emotion }) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const theme = EMOTION_THEMES[emotion];

  const particlesCount = 2000;
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    pointsRef.current.rotation.y = time * 0.05 * theme.particleSpeed;
    pointsRef.current.rotation.x = time * 0.03 * theme.particleSpeed;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color={theme.color}
        size={0.02}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.4}
      />
    </Points>
  );
};

const AnimatedOrb = ({ emotion }: { emotion: Emotion }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const theme = EMOTION_THEMES[emotion];

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const breathSpeed = theme.speed;
    const scale = 1 + Math.sin(time * breathSpeed) * 0.1;
    meshRef.current.scale.set(scale, scale, scale);

    if (emotion === "nervous") {
      meshRef.current.position.x = Math.sin(time * 50) * 0.02;
      meshRef.current.position.y = Math.cos(time * 50) * 0.02;
    } else {
      meshRef.current.position.set(0, 0, 0);
    }
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color={theme.color}
        speed={theme.speed}
        distort={0.4}
        radius={1}
      />
    </Sphere>
  );
};

// --- Main Page Component ---

export default function MoodAnalyzePage() {
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [confidence, setConfidence] = useState(0);
  const [gestureEmotion, setGestureEmotion] = useState<Emotion | null>(null);
  
  const emojiRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Gesture tracking refs
  const gestureState = useRef({
    startTime: 0,
    points: [] as { x: number; y: number; t: number }[],
    isDown: false,
  });

  // --- Lenis Init ---
  useEffect(() => {
    const lenis = new Lenis();
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // --- Backend Polling ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(BACKEND_URL);
        if (response.data.success) {
          const newEmotion = response.data.emotion.toLowerCase() as Emotion;
          setEmotion(newEmotion);
          setConfidence(response.data.confidence);
        }
      } catch (err) {
        console.error("Failed to fetch emotion data");
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // --- GSAP Transitions ---
  useEffect(() => {
    if (emojiRef.current) {
      gsap.fromTo(
        emojiRef.current,
        { scale: 0, opacity: 0, rotate: -45 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.5)" }
      );
    }
  }, [emotion, gestureEmotion]);

  // --- Webcam Access (Browser side for preview) ---
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    }
  }, []);

  // --- Gesture Detection Logic ---
  const handlePointerDown = (e: React.PointerEvent) => {
    gestureState.current = {
      startTime: Date.now(),
      points: [{ x: e.clientX, y: e.clientY, t: Date.now() }],
      isDown: true,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!gestureState.current.isDown) return;
    gestureState.current.points.push({ x: e.clientX, y: e.clientY, t: Date.now() });
  };

  const handlePointerUp = () => {
    if (!gestureState.current.isDown) return;
    gestureState.current.isDown = false;

    const endTime = Date.now();
    const { startTime, points } = gestureState.current;
    
    if (points.length < 2) return;

    const totalDuration = endTime - startTime;
    let totalDistance = 0;
    let directionChanges = 0;
    let prevAngle = null;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      totalDistance += Math.sqrt(dx * dx + dy * dy);

      const angle = Math.atan2(dy, dx);
      if (prevAngle !== null) {
        if (Math.abs(angle - prevAngle) > Math.PI / 4) {
          directionChanges++;
        }
      }
      prevAngle = angle;
    }

    const averageSpeed = totalDistance / (totalDuration / 1000);
    
    // Variance calculation (crude)
    const speeds = [];
    for (let i = 1; i < points.length; i++) {
      const d = Math.sqrt(Math.pow(points[i].x - points[i - 1].x, 2) + Math.pow(points[i].y - points[i - 1].y, 2));
      speeds.push(d / ((points[i].t - points[i - 1].t) / 1000));
    }
    const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance = speeds.reduce((a, b) => a + Math.pow(b - meanSpeed, 2), 0) / speeds.length;

    // Business Logic
    let detected: Emotion = "neutral";
    if (averageSpeed > 800 && directionChanges > 8) detected = "nervous";
    else if (averageSpeed > 300 && averageSpeed < 700 && variance > 5000) detected = "anxious";
    else if (totalDuration > 1500 && totalDistance < 50) detected = "calm";

    setGestureEmotion(detected === "neutral" ? null : detected);
  };

  const activeEmotion = gestureEmotion || emotion;

  return (
    <main 
      className="relative w-screen h-screen bg-[#0F172A] text-white font-sans overflow-hidden select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* --- Ambient Glow --- */}
      <div 
        className="absolute inset-0 transition-colors duration-1000 opacity-20 pointer-events-none"
        style={{ backgroundColor: EMOTION_THEMES[activeEmotion].color }}
      />

      {/* --- Top Left: Webcam & Info --- */}
      <div className="absolute top-8 left-8 z-20 flex flex-col gap-4">
        <div className="w-48 h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover grayscale opacity-60" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-widest text-white/50 uppercase">Analysis Status</p>
          <h2 className="text-3xl font-bold capitalize tracking-tight">
            {activeEmotion} <span className="text-sm font-normal text-white/40">{(confidence * 100).toFixed(0)}%</span>
          </h2>
          {gestureEmotion && (
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-tighter animate-pulse">
              Gesture Override Active
            </p>
          )}
        </div>
      </div>

      {/* --- Top Right: Emoji Reaction --- */}
      <div className="absolute top-8 right-8 z-20 text-center">
        <div ref={emojiRef} className="text-8xl drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
          {EMOJI_MAP[activeEmotion]}
        </div>
        <p className="mt-2 text-[10px] tracking-[0.2em] font-bold text-white/30 uppercase">Detected Mood</p>
      </div>

      {/* --- Center: 3D Orb --- */}
      <div className="absolute inset-0 z-10">
        <Canvas camera={{ position: [0, 0, 4] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} color={EMOTION_THEMES[activeEmotion].color} />
          <ParticleBackground emotion={activeEmotion} />
          <AnimatedOrb emotion={activeEmotion} />
        </Canvas>
      </div>

      {/* --- Bottom: Gesture Zone --- */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-8 text-center">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ 
              width: gestureState.current.isDown ? "100%" : "0%", 
              backgroundColor: EMOTION_THEMES[activeEmotion].color 
            }}
          />
        </div>
        <p className="mt-4 text-[11px] font-bold tracking-[0.3em] text-white/20 uppercase">
          Interact anywhere to express through motion
        </p>
      </div>

      {/* --- UI Decorative elements --- */}
      <div className="absolute bottom-4 left-8 text-[9px] text-white/10 font-mono">
        NEXUS_SYSTEM_CORE_V1.0.4 // REALTIME_EMOTION_SYNC
      </div>
      <div className="absolute bottom-4 right-8 text-[9px] text-white/10 font-mono">
        HACKATHON_WILDCARD_2 // ALT_UI_PROTOCOL
      </div>
    </main>
  );
}
