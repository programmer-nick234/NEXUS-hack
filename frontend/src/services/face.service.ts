import api from "@/lib/axios";
import type { ApiResponse, FaceDetectionResult } from "@/types";

export const faceService = {
  /**
   * Upload an image for face detection analysis.
   * The actual OpenCV logic is handled externally – this calls the placeholder endpoint.
   */
  async analyze(imageFile: File): Promise<FaceDetectionResult> {
    const formData = new FormData();
    formData.append("file", imageFile);

    const { data } = await api.post<ApiResponse<FaceDetectionResult>>(
      "/face/analyze",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data.data;
  },
};
