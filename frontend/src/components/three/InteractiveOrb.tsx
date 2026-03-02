"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useInteractionStore } from "@/store";
import type { InteractionMetrics } from "@/types";

/**
 * Interactive Orb – the core interaction element.
 *
 * User presses and holds the orb. On release, captured metrics are:
 * - holdDuration (seconds)
 * - movementVariance (pointer movement during hold)
 * - releaseSpeed (how fast the pointer moved on release)
 * - interactionRhythm (regularity of small movements – lower = more erratic)
 */
export default function InteractiveOrb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const { phase, interventionParams, captureMetrics } = useInteractionStore();

  // ── Interaction tracking state ──────────────────────────────────────────
  const [isHolding, setIsHolding] = useState(false);
  const holdStart = useRef(0);
  const movements = useRef<number[]>([]);
  const lastPointer = useRef({ x: 0, y: 0 });
  const intervalTimestamps = useRef<number[]>([]);

  // ── Visual state ────────────────────────────────────────────────────────
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const holdProgress = useRef(0);

  // ── Pointer handlers ───────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (phase !== "landing" && phase !== "interaction") return;
      e.stopPropagation();
      setIsHolding(true);
      holdStart.current = performance.now();
      movements.current = [];
      intervalTimestamps.current = [performance.now()];
      lastPointer.current = { x: e.clientX, y: e.clientY };
      targetScale.current = 0.85; // press-in effect
      useInteractionStore.getState().setPhase("interaction");
    },
    [phase],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isHolding) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      movements.current.push(dist);
      intervalTimestamps.current.push(performance.now());
      lastPointer.current = { x: e.clientX, y: e.clientY };
    },
    [isHolding],
  );

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!isHolding) return;
      setIsHolding(false);
      targetScale.current = 1;

      // Calculate metrics
      const holdDuration = (performance.now() - holdStart.current) / 1000;

      // Movement variance
      const mvs = movements.current;
      const mean = mvs.length > 0 ? mvs.reduce((a, b) => a + b, 0) / mvs.length : 0;
      const variance =
        mvs.length > 1
          ? mvs.reduce((acc, v) => acc + (v - mean) ** 2, 0) / mvs.length
          : 0;
      const movementVariance = Math.min(1, variance / 100); // normalise 0-1

      // Release speed (last few movements)
      const lastMoves = mvs.slice(-3);
      const releaseSpeed = lastMoves.length > 0
        ? Math.min(1, lastMoves.reduce((a, b) => a + b, 0) / lastMoves.length / 50)
        : 0;

      // Interaction rhythm (regularity of movement intervals)
      const ts = intervalTimestamps.current;
      let rhythmVariance = 0;
      if (ts.length > 2) {
        const intervals = [];
        for (let i = 1; i < ts.length; i++) intervals.push(ts[i] - ts[i - 1]);
        const intMean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        rhythmVariance = intervals.reduce((a, v) => a + (v - intMean) ** 2, 0) / intervals.length;
      }
      const interactionRhythm = Math.max(0, Math.min(1, 1 - rhythmVariance / 10000));

      const metrics: InteractionMetrics = {
        holdDuration: Math.round(holdDuration * 100) / 100,
        movementVariance: Math.round(movementVariance * 100) / 100,
        releaseSpeed: Math.round(releaseSpeed * 100) / 100,
        interactionRhythm: Math.round(interactionRhythm * 100) / 100,
      };

      captureMetrics(metrics);

      // Trigger analysis
      setTimeout(() => {
        useInteractionStore.getState().analyzeAndIntervene();
      }, 300);
    },
    [isHolding, captureMetrics],
  );

  // ── Animation loop ─────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    // Smooth scale lerp
    currentScale.current += (targetScale.current - currentScale.current) * 0.08;

    if (phase === "intervention") {
      // Breathing animation: scale = base + sin(time / breathSpeed) * amplitude
      const bs = interventionParams.breathSpeed;
      const breathScale =
        interventionParams.orbScale + Math.sin((t * Math.PI * 2) / bs) * 0.12;
      meshRef.current.scale.setScalar(breathScale * 2.2);
      meshRef.current.rotation.y = t * 0.05;
    } else {
      // Idle / interaction
      if (isHolding) {
        holdProgress.current = Math.min(1, holdProgress.current + 0.008);
        meshRef.current.rotation.y += 0.002 + holdProgress.current * 0.01;
      } else {
        holdProgress.current *= 0.95;
        meshRef.current.rotation.y = t * 0.1;
      }
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
      meshRef.current.scale.setScalar(currentScale.current * 2.2);
    }

    // Outer glow pulse
    if (glowRef.current) {
      const glowScale = phase === "intervention"
        ? interventionParams.orbScale * 2.6 + Math.sin(t * 0.8) * 0.1
        : 2.6 + Math.sin(t * 1.5) * 0.05 + (isHolding ? holdProgress.current * 0.3 : 0);
      glowRef.current.scale.setScalar(glowScale);
    }
  });

  // Determine color based on phase
  const orbColor = phase === "intervention" ? interventionParams.color : "#4A90E2";
  const glowColor = phase === "intervention" ? interventionParams.color : "#A78BFA";

  return (
    <group>
      {/* Core orb */}
      <mesh
        ref={meshRef}
        scale={2.2}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <icosahedronGeometry args={[1, 64]} />
        <MeshDistortMaterial
          color={orbColor}
          roughness={0.2}
          metalness={0.8}
          distort={isHolding ? 0.5 : 0.3}
          speed={isHolding ? 3.0 : 1.5}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef} scale={2.6}>
        <icosahedronGeometry args={[1, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
