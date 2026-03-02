// ─── User & Auth Types ───────────────────────────────────────────────────────

export type UserRole = "student" | "admin" | "mentor" | "superadmin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  message: string;
  detail?: string;
}

// ─── Face Detection Types ────────────────────────────────────────────────────

export interface FaceDetectionResult {
  facesDetected: number;
  confidence: number;
  emotion: string;
  note: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── Route Protection ────────────────────────────────────────────────────────

export interface ProtectedRouteConfig {
  path: string;
  roles: UserRole[];
  redirectTo?: string;
}

// ─── Interaction / State Analysis ────────────────────────────────────────────

export interface InteractionMetrics {
  holdDuration: number;
  movementVariance: number;
  releaseSpeed: number;
  interactionRhythm: number;
  // optional gesture-style fields
  duration?: number;
  avgSpeed?: number;
  directionChanges?: number;
  variance?: number;
  pressure?: number;
}

export interface InterventionParams {
  breathSpeed: number;
  color: string;
  particleSpeed: number;
}

export interface InterventionParameters {
  breathSpeed: number;
  color: string;
  particleSpeed: number;
  cameraDistance: number;
  orbScale: number;
  ambientIntensity: number;
}

export type AppPhase = "landing" | "interaction" | "analyzing" | "intervention";

export interface StateAnalysisResult {
  emotionalState: string;
  intensity: number;
  anxietyScore?: number;
  interventionType: string;
  parameters: InterventionParameters;
}

// ─── Session Types ───────────────────────────────────────────────────────────

export interface EmotionSnapshot {
  ts: string;
  emotion: string;
  confidence: number;
  distribution: Record<string, number>;
}

export interface MoodSession {
  _id: string;
  sessionId?: string;
  userId: string | null;
  startedAt: string;
  endedAt: string | null;
  timeline: EmotionSnapshot[];
  moodScore: number | null;
  stabilityIndex: number | null;
  dominantEmotion: string | null;
  durationSec: number;
}

export interface SessionEndResult {
  sessionId: string;
  moodScore: number | null;
  stabilityIndex: number | null;
  dominantEmotion: string | null;
  durationSec: number;
  totalSnapshots: number;
  xp?: number;
  level?: number;
  sessionXp?: number;
  newBadges?: Badge[];
  levelProgress?: LevelProgress;
}

// ─── Gamification Types ──────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  earned?: boolean;
  earnedAt?: string;
}

export interface LevelProgress {
  current: number;
  required: number;
  percent: number;
}

export interface GamificationStats {
  userId?: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  lastSessionDate: string | null;
  levelProgress: LevelProgress;
}

// ─── Suggestion Types ────────────────────────────────────────────────────────

export interface Intervention {
  id: string;
  name: string;
  description: string;
  category: string;
  duration_sec: number;
  icon: string;
  animation: string;
}

export interface EmotionPattern {
  pattern: string;
  dominant?: string;
  insight: string;
}

export interface SuggestionResult {
  suggestions: Intervention[];
  pattern: EmotionPattern;
  urgency: "low" | "medium" | "high";
  message: string;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export interface MoodTrendPoint {
  date: string;
  moodScore: number;
  stability: number;
}

export interface AnalyticsOverview {
  totalSessions: number;
  avgMoodScore: number;
  avgStability: number;
  totalMinutes: number;
  moodTrend: MoodTrendPoint[];
  emotionBreakdown: Record<string, number>;
}

// ─── WebSocket Types ─────────────────────────────────────────────────────────

export interface WSEmotionPayload {
  type: "emotion";
  frame: number;
  emotion: string;
  confidence: number;
  distribution: Record<string, number>;
  faceRect?: [number, number, number, number];
  suggestion?: SuggestionResult;
}
