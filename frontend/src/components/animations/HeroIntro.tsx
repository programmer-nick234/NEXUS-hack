"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/lib/utils";

export default function HeroIntro({ children }: { children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Still show the content immediately
      if (overlayRef.current) overlayRef.current.style.display = "none";
      if (contentRef.current) contentRef.current.style.opacity = "1";
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "power4.inOut" } });

    tl.to(overlayRef.current, {
      scaleY: 0,
      transformOrigin: "top center",
      duration: 1.2,
      delay: 0.3,
    })
      .fromTo(
        contentRef.current,
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1 },
        "-=0.5",
      );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Cinematic wipe overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black pointer-events-none"
      />
      <div ref={contentRef} className="opacity-0">
        {children}
      </div>
    </div>
  );
}
