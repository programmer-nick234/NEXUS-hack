"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useRef } from "react";
import Providers from "@/components/ui/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Audio initializes ONLY ONCE when app loads due to empty dependency array
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.5;
    audio.loop = true;

    const playAudio = () => {
      audio.play().catch((err) => {
        console.log("Autoplay blocked, waiting for interaction:", err);
      });
    };

    // Attempt autoplay on mount
    playAudio();

    // Handle autoplay restriction: start on first user interaction
    const handleInteraction = () => {
      if (audio.paused) {
        playAudio();
      }
      // Remove listener after first play
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white`}
      >
        <audio
          ref={audioRef}
          src="/WhatsApp Audio 2026-03-02 at 18.59.01.mpeg"
          preload="auto"
          className="hidden"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
