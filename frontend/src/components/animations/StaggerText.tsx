"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

interface StaggerTextProps {
  text: string;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "p" | "span";
  staggerAmount?: number;
}

export default function StaggerText({
  text,
  className = "",
  tag: Tag = "h2",
  staggerAmount = 0.05,
}: StaggerTextProps) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !containerRef.current) return;

    const chars = containerRef.current.querySelectorAll(".stagger-char");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { y: 60, opacity: 0, rotateX: -90 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          stagger: staggerAmount,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, [text, staggerAmount]);

  const words = text.split(" ");

  return (
    <Tag ref={containerRef as React.RefObject<HTMLHeadingElement>} className={`overflow-hidden ${className}`}>
      {words.map((word, wi) => (
        <span key={wi} className="inline-block mr-[0.25em]">
          {word.split("").map((char, ci) => (
            <span
              key={ci}
              className="stagger-char inline-block will-change-transform"
              style={{ perspective: "400px" }}
            >
              {char}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
