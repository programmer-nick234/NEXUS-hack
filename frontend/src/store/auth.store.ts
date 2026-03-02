"use client";

import { create } from "zustand";
import type { AuthState, LoginCredentials, RegisterPayload, User } from "@/types";
import { authService } from "@/services/auth.service";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user: User | null) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(credentials);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (payload: RegisterPayload) => {
    set({ isLoading: true });
    try {
      const user = await authService.register(payload);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshAuth: async () => {
    // Only attempt auth hydration on dashboard pages
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!path.startsWith("/dashboard")) {
        set({ isLoading: false });
        return;
      }
    }
    set({ isLoading: true });
    try {
      const user = await authService.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
