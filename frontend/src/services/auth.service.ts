import api, { resetRefreshGate } from "@/lib/axios";
import type {
  ApiResponse,
  LoginCredentials,
  RegisterPayload,
  User,
} from "@/types";

export const authService = {
  async login(credentials: LoginCredentials): Promise<User> {
    const { data } = await api.post<ApiResponse<{ user: User }>>(
      "/auth/login",
      credentials,
    );
    resetRefreshGate();
    return data.data.user;
  },

  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await api.post<ApiResponse<{ user: User }>>(
      "/auth/register",
      payload,
    );
    resetRefreshGate();
    return data.data.user;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  async me(): Promise<User> {
    const { data } = await api.get<ApiResponse<User>>("/auth/me");
    return data.data;
  },

  async refreshToken(): Promise<void> {
    await api.post("/auth/refresh");
  },
};
