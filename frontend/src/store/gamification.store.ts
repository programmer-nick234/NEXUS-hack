"use client";

import { create } from "zustand";
import api from "@/lib/axios";
import type { GamificationStats, Badge, LevelProgress } from "@/types";

interface GamificationState {
  stats: GamificationStats | null;
  badges: Badge[];
  allBadges: Badge[];
  loading: boolean;

  fetchStats: () => Promise<void>;
  fetchBadges: () => Promise<void>;
  fetchAllBadges: () => Promise<void>;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  stats: null,
  badges: [],
  allBadges: [],
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get("/gamification/stats");
      set({ stats: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchBadges: async () => {
    try {
      const { data } = await api.get("/gamification/badges");
      set({ badges: data.badges || [] });
    } catch {
      // silent
    }
  },

  fetchAllBadges: async () => {
    try {
      const { data } = await api.get("/gamification/badges/all");
      set({ allBadges: data.badges || [] });
    } catch {
      // silent
    }
  },
}));
