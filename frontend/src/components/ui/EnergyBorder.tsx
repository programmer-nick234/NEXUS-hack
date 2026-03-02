"use client";

import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";

interface EnergyBorderProps {
    children: React.ReactNode;
    className?: string;
    color?: string; // Default: #FF5A1F
    thickness?: number; // Default: 2
    glowIntensity?: number; // Default: 1
    alwaysOn?: boolean; // New: Always show a base animation
}

/**
 * EnergyBorder component wraps children and renders a cinematic,
 * cursor-reactive energy/smoke border animation on a canvas overlay.
 */
export default function EnergyBorder({
    children,
    className = "",
    color = "#FF5A1F",
    thickness = 2,
    glowIntensity = 1,
    alwaysOn = false,
}: EnergyBorderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const mouseRef = useRef({ x: -1000, y: -1000, active: false });
    const [size, setSize] = useState({ width: 0, height: 0 });

    // Animation state
    const offsetRef = useRef(0);
    const intensityRef = useRef({ value: alwaysOn ? 0.3 : 0 });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setSize({ width, height });
            }
        });

        resizeObserver.observe(container);

        const handleMouseMove = (e: MouseEvent) => {
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if mouse is near the border (e.g., within 50px)
            const padding = 50;
            const isInside =
                x >= -padding &&
                x <= rect.width + padding &&
                y >= -padding &&
                y <= rect.height + padding;

            mouseRef.current = { x, y, active: isInside };

            if (isInside) {
                gsap.to(intensityRef.current, { value: 1, duration: 0.5, ease: "power3.out" });
                // Subtle glow pulse
                gsap.to(canvasRef.current, {
                    filter: "brightness(1.3) contrast(1.2)",
                    duration: 1.2,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut"
                });
            } else {
                gsap.to(intensityRef.current, { value: alwaysOn ? 0.3 : 0, duration: 0.5, ease: "power3.out" });
                gsap.killTweensOf(canvasRef.current);
                gsap.set(canvasRef.current, { filter: "none" });
            }
        };

        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("mousemove", handleMouseMove);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || size.width === 0 || size.height === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const render = (time: number) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const intensity = intensityRef.current.value;
            if (intensity <= 0.01) {
                requestRef.current = requestAnimationFrame(render);
                return;
            }

            // Draw energy trail
            const w = canvas.width;
            const h = canvas.height;
            const t = time * 0.001;

            // Interpolate values based on intensity
            // Base mode (intensity 0.3): 4-6px
            // Hover mode (intensity 1.0): 8-14px
            let baseThickness;
            if (alwaysOn) {
                // Map intensity [0.3, 1.0] to thickness [5, 12]
                const t = (intensity - 0.3) / 0.7;
                baseThickness = 5 + Math.max(0, t) * 7;
            } else {
                baseThickness = thickness * 4 * intensity;
            }

            const perimeter = 2 * (w + h);
            const segmentLen = (0.3 + 0.2 * intensity) * perimeter;

            const getPoint = (dist: number) => {
                let d = dist % perimeter;
                if (d < 0) d += perimeter;

                if (d < w) return { x: d, y: 0 }; // Top
                d -= w;
                if (d < h) return { x: w, y: d }; // Right
                d -= h;
                if (d < w) return { x: w - d, y: h }; // Bottom
                d -= w;
                return { x: 0, y: h - d }; // Left
            };

            // Draw the energy stroke
            const flowSpeed = 1.2 + intensity * 3.5;
            offsetRef.current += flowSpeed;
            const startDist = offsetRef.current % perimeter;

            const steps = alwaysOn ? 70 : 60;

            // ─── LAYER 1: OUTER DIFFUSED SMOKE ───────────────────────────
            // Base blur: 8-12px, Hover blur: 16-24px
            let blurSize;
            if (alwaysOn) {
                const t = (intensity - 0.3) / 0.7;
                blurSize = 10 + Math.max(0, t) * 10;
            } else {
                blurSize = 20 * intensity;
            }

            ctx.shadowBlur = blurSize * glowIntensity;
            ctx.shadowColor = color;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (let i = 0; i <= steps; i++) {
                const stepDist = startDist + (segmentLen * i) / steps;
                const pt = getPoint(stepDist);

                // Turbulence Wave
                const turbulence = 1.5 + 3.5 * intensity;
                const wave = Math.sin(t * (3 + intensity * 5) + i * 0.1) * turbulence * intensity;
                const jitterX = Math.sin(t * 12 + i * 0.3) * 2 * intensity + wave;
                const jitterY = Math.cos(t * 10 + i * 0.2) * 2 * intensity + wave;

                // Trailing fade
                // Base opacity: medium-low, Hover: high
                const alphaBase = alwaysOn ? (0.2 + 0.6 * intensity) : 0.8 * intensity;
                const alpha = Math.pow(i / steps, 1.5) * alphaBase * 0.5;

                ctx.globalAlpha = alpha;
                ctx.strokeStyle = color;
                ctx.lineWidth = baseThickness * 1.5 * (i / steps);

                if (i === 0) {
                    ctx.beginPath();
                    ctx.moveTo(pt.x + jitterX, pt.y + jitterY);
                } else {
                    ctx.lineTo(pt.x + jitterX, pt.y + jitterY);
                    if (i % 3 === 0 || i === steps) {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(pt.x + jitterX, pt.y + jitterY);
                    }
                }
            }

            // ─── LAYER 2: BRIGHT CORE ENERGY ─────────────────────────────
            ctx.shadowBlur = (alwaysOn ? 4 : 8) * glowIntensity * intensity;

            for (let i = 0; i <= steps; i++) {
                const stepDist = startDist + (segmentLen * i) / steps;
                const pt = getPoint(stepDist);

                const jitterX = Math.sin(t * 15 + i * 0.2) * 1.0 * intensity;
                const jitterY = Math.cos(t * 12 + i * 0.1) * 1.0 * intensity;

                const alphaBase = alwaysOn ? (0.3 + 0.7 * intensity) : intensity;
                const alpha = Math.pow(i / steps, 2) * alphaBase;
                ctx.globalAlpha = alpha;

                // Darken/whiten logic
                ctx.strokeStyle = intensity > 0.8 ? "#FFF" : color;
                ctx.lineWidth = baseThickness * 0.4 * (i / steps);

                if (i === 0) {
                    ctx.beginPath();
                    ctx.moveTo(pt.x + jitterX, pt.y + jitterY);
                } else {
                    ctx.lineTo(pt.x + jitterX, pt.y + jitterY);
                    if (i % 5 === 0 || i === steps) {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(pt.x + jitterX, pt.y + jitterY);
                    }
                }
            }

            requestRef.current = requestAnimationFrame(render);
        };

        requestRef.current = requestAnimationFrame(render);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [size, color, thickness, glowIntensity]);

    return (
        <div
            ref={containerRef}
            className={`relative group ${className}`}
            style={{ isolation: "isolate" }}
        >
            <canvas
                ref={canvasRef}
                width={size.width}
                height={size.height}
                className="absolute inset-0 pointer-events-none z-50 transition-opacity"
                style={{
                    width: "100%",
                    height: "100%",
                    willChange: "transform, opacity",
                }}
            />
            <div className="relative z-1">{children}</div>
        </div>
    );
}
