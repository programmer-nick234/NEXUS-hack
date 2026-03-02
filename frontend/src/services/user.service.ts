import api from "@/lib/axios";
import type { ApiResponse, PaginatedResponse, User, PaginationParams } from "@/types";

export const userService = {
  async getUsers(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const { data } = await api.get<PaginatedResponse<User>>("/users", { params });
    return data;
  },

  async getUserById(id: string): Promise<User> {
    const { data } = await api.get<ApiResponse<User>>(`/users/${id}`);
    return data.data;
  },

  async updateUser(id: string, payload: Partial<User>): Promise<User> {
    const { data } = await api.put<ApiResponse<User>>(`/users/${id}`, payload);
    return data.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
