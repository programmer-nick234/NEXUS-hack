import api from "@/lib/axios";
import type { ApiResponse, InteractionMetrics, StateAnalysisResult } from "@/types";

export const stateService = {
  /**
   * Send interaction metrics to the backend for emotional state classification.
   * Returns intervention parameters for the 3D scene morph.
   */
  async analyzeState(metrics: InteractionMetrics): Promise<StateAnalysisResult> {
    const { data } = await api.post<ApiResponse<StateAnalysisResult>>(
      "/state/analyze-state",
      {
        hold_duration: metrics.holdDuration,
        movement_variance: metrics.movementVariance,
        release_speed: metrics.releaseSpeed,
        interaction_rhythm: metrics.interactionRhythm,
      },
    );
    return data.data;
  },
};
