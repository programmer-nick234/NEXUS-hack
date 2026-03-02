"use client";

import { create } from "zustand";
import api from "@/lib/axios";
import type {
  MoodSession,
  SessionEndResult,
  EmotionSnapshot,
  SuggestionResult,
  AnalyticsOverview,
} from "@/types";

/** Find the most frequent emotion in a timeline. */
function _dominantFrom(timeline: EmotionSnapshot[]): string {
  if (!timeline.length) return "neutral";
  const counts: Record<string, number> = {};
  for (const e of timeline) {
    counts[e.emotion] = (counts[e.emotion] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

interface SessionState {
  // Current session
  sessionId: string | null;
  isActive: boolean;
  timeline: EmotionSnapshot[];
  currentEmotion: string;
  currentConfidence: number;
  currentDistribution: Record<string, number>;

  // Post-session
  lastResult: SessionEndResult | null;

  // Suggestions
  suggestion: SuggestionResult | null;

  // Analytics
  analytics: AnalyticsOverview | null;

  // History
  sessions: MoodSession[];

  // Actions
  startSession: () => Promise<void>;
  addEmotionSnapshot: (snap: {
    emotion: string;
    confidence: number;
    distribution: Record<string, number>;
  }) => void;
  endSession: () => Promise<SessionEndResult | null>;
  fetchSuggestion: (emotion: string, confidence: number, anxietyScore?: number) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  isActive: false,
  timeline: [],
  currentEmotion: "neutral",
  currentConfidence: 0,
  currentDistribution: {},
  lastResult: null,
  suggestion: null,
  analytics: null,
  sessions: [],

  startSession: async () => {
    try {
      const { data } = await api.post("/sessions/start");
      set({
        sessionId: data.sessionId,
        isActive: true,
        timeline: [],
        lastResult: null,
      });
    } catch (err) {
      console.error("Failed to start session:", err);
      // Offline fallback — generate local session ID
      set({
        sessionId: `local-${Date.now()}`,
        isActive: true,
        timeline: [],
        lastResult: null,
      });
    }
  },

  addEmotionSnapshot: (snap) => {
    const { sessionId, timeline } = get();
    const entry: EmotionSnapshot = {
      ts: new Date().toISOString(),
      ...snap,
    };
    set({
      timeline: [...timeline, entry],
      currentEmotion: snap.emotion,
      currentConfidence: snap.confidence,
      currentDistribution: snap.distribution,
    });

    // Fire-and-forget to backend
    if (sessionId && !sessionId.startsWith("local-")) {
      api
        .post(`/sessions/${sessionId}/emotion`, snap)
        .catch(() => {}); // silent
    }
  },

  endSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return null;

    try {
      if (sessionId.startsWith("local-")) {
        // Compute local result
        const { timeline } = get();
        const result: SessionEndResult = {
          sessionId,
          moodScore: 60,
          stabilityIndex: 0.5,
          dominantEmotion: "neutral",
          durationSec: 0,
          totalSnapshots: timeline.length,
        };
        set({ isActive: false, lastResult: result });
        return result;
      }

      const { data } = await api.post(`/sessions/${sessionId}/end`);
      set({ isActive: false, lastResult: data });
      return data as SessionEndResult;
    } catch (err) {
      console.error("Failed to end session:", err);
      // Build a local result from timeline data so the modal + analytics still work
      const { timeline, sessionId: sid } = get();
      const fallback: SessionEndResult = {
        sessionId: sid || "unknown",
        moodScore: 60,
        stabilityIndex: 0.5,
        dominantEmotion: _dominantFrom(timeline),
        durationSec: 0,
        totalSnapshots: timeline.length,
      };
      set({ isActive: false, lastResult: fallback });
      return fallback;
    }
  },

  fetchSuggestion: async (emotion, confidence, anxietyScore = 0) => {
    const { timeline } = get();
    const recentEmotions = timeline.slice(-10).map((e) => e.emotion);
    try {
      const { data } = await api.post("/suggestions/recommend", {
        emotion,
        confidence,
        anxietyScore,
        recentEmotions,
        usedInterventions: [],
      });
      set({ suggestion: data });
    } catch {
      // silent
    }
  },

  fetchAnalytics: async () => {
    try {
      const { data } = await api.get("/analytics/overview");
      set({ analytics: data });
    } catch {
      // silent
    }
  },

  fetchHistory: async () => {
    try {
      const { data } = await api.get("/sessions/history");
      set({ sessions: data.sessions || [] });
    } catch {
      // silent
    }
  },

  reset: () =>
    set({
      sessionId: null,
      isActive: false,
      timeline: [],
      currentEmotion: "neutral",
      currentConfidence: 0,
      currentDistribution: {},
      lastResult: null,
      suggestion: null,
    }),
}));
