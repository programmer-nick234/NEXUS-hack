"use client";

import { useEffect, useRef } from "react";

/**
 * Global Audio Player component.
 * Handles background music with autoplay restriction workarounds.
 */
export default function AudioPlayer({ volume = 0.5 }: { volume?: number }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Set initial volume
        audio.volume = volume;

        const playAudio = () => {
            audio.play().catch((err) => {
                console.log("Autoplay blocked, waiting for interaction:", err);
            });
        };

        // Attempt to play immediately
        playAudio();

        // Workaround for browser autoplay policies: play on first interaction
        const handleInteraction = () => {
            if (audio.paused) {
                playAudio();
            }
            // Remove listeners after first successful interaction
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
    }, [volume]);

    return (
        <audio
            ref={audioRef}
            src="/WhatsApp Audio 2026-03-02 at 18.59.01.mpeg"
            loop
            autoPlay
            preload="auto"
            className="hidden"
        />
    );
}
