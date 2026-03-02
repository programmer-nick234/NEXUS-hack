"use client";

import { create } from "zustand";
import type {
  AppPhase,
  InteractionMetrics,
  InterventionParameters,
  StateAnalysisResult,
} from "@/types";
import { stateService } from "@/services/state.service";

// ── Default neutral intervention parameters ──────────────────────────────────
const NEUTRAL_PARAMS: InterventionParameters = {
  breathSpeed: 5.0,
  color: "#4A90E2",
  particleSpeed: 0.25,
  cameraDistance: 5.0,
  orbScale: 1.0,
  ambientIntensity: 0.4,
};

interface InteractionState {
  // App flow phase
  phase: AppPhase;
  setPhase: (phase: AppPhase) => void;

  // Raw metrics from orb interaction
  metrics: InteractionMetrics | null;

  // Backend analysis result
  analysisResult: StateAnalysisResult | null;

  // Active intervention parameters (drives the 3D scene)
  interventionParams: InterventionParameters;

  // Error
  error: string | null;

  // Actions
  captureMetrics: (metrics: InteractionMetrics) => void;
  analyzeAndIntervene: () => Promise<void>;
  resetToNeutral: () => void;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  phase: "landing",
  metrics: null,
  analysisResult: null,
  interventionParams: NEUTRAL_PARAMS,
  error: null,

  setPhase: (phase) => set({ phase }),

  captureMetrics: (metrics) => set({ metrics, phase: "analyzing" }),

  analyzeAndIntervene: async () => {
    const { metrics } = get();
    if (!metrics) return;

    set({ error: null });
    try {
      const result = await stateService.analyzeState(metrics);
      set({
        analysisResult: result,
        interventionParams: result.parameters,
        phase: "intervention",
      });
    } catch (err) {
      console.error("State analysis failed:", err);
      // Provide a graceful fallback – default breathing intervention
      set({
        analysisResult: {
          emotionalState: "calm",
          intensity: 0.5,
          interventionType: "breathing",
          parameters: NEUTRAL_PARAMS,
        },
        interventionParams: NEUTRAL_PARAMS,
        phase: "intervention",
        error: "Analysis unavailable – using default intervention",
      });
    }
  },

  resetToNeutral: () =>
    set({
      phase: "landing",
      metrics: null,
      analysisResult: null,
      interventionParams: NEUTRAL_PARAMS,
      error: null,
    }),
}));
