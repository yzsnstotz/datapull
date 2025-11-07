/**
 * Datapull API 服务
 * 统一响应处理和错误处理
 */

import axios, { AxiosInstance } from "axios";
import type {
  Source,
  TaskStatusDTO,
  ChunkDTO,
  LogEntry,
  SystemStatusDTO,
  ReviewDTO,
  ReviewStatus,
  ApiResp,
} from "../types/common";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const data = response.data as ApiResp<any>;
    if (data.success) {
      return data.data;
    } else {
      return Promise.reject(data.error);
    }
  },
  (error) => {
    // 如果后端返回了错误响应，提取错误信息
    if (error.response?.data) {
      const data = error.response.data as ApiResp<any>;
      if (data && !data.success && data.error) {
        return Promise.reject(data.error);
      }
    }
    // 否则返回网络错误
    return Promise.reject({
      code: "NETWORK_ERROR",
      message: error.message || "网络错误",
    });
  }
);

// Sources
export const getSources = (q?: string): Promise<Source[]> => {
  return api.get("/sources", { params: { q } });
};

export const createSource = (payload: Source): Promise<Source> => {
  return api.post("/sources", payload);
};

export const updateSource = (id: string, patch: Partial<Source>): Promise<Source> => {
  return api.put(`/sources/${id}`, patch);
};

export const deleteSource = (id: string): Promise<{ deleted: boolean }> => {
  return api.delete(`/sources/${id}`);
};

// Tasks
export const startTasks = (payload: {
  sourceIds?: string[];
  mode?: "full" | "incremental";
}): Promise<{ started: boolean; startedAt: string }> => {
  return api.post("/tasks/start", payload);
};

export const stopTasks = (): Promise<{ stopped: boolean; stoppedAt: string }> => {
  return api.post("/tasks/stop");
};

export const getTaskStatus = (): Promise<TaskStatusDTO> => {
  return api.get("/tasks/status");
};

// Logs
export const getLogs = (params: {
  type?: "system" | "crawl" | "upload";
  sourceId?: string;
  level?: string;
  limit?: number;
}): Promise<{ items: LogEntry[]; nextCursor?: string }> => {
  return api.get("/logs", { params });
};

// Chunks
export const listChunks = (params: {
  status?: "pending" | "uploaded" | "failed";
  sourceId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ChunkDTO[]; page: number; pageSize: number; total: number }> => {
  return api.get("/chunks", { params });
};

export const uploadBatch = (payload: {
  chunkIds: string[];
  mode?: "auto" | "manual";
}): Promise<{
  operationId: string;
  processed: number;
  failed: number;
  results: Array<{
    chunkId: string;
    status: "success" | "failed" | "duplicate";
    error?: { code: string; message: string };
  }>;
}> => {
  return api.post("/upload/batch", payload);
};

// System
export const getSystemStatus = (): Promise<SystemStatusDTO> => {
  return api.get("/system/status");
};

// Reviews
export const getReviews = (params: {
  status?: ReviewStatus;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: ReviewDTO[]; page: number; pageSize: number; total: number }> => {
  return api.get("/reviews", { params });
};

export const getReview = (id: string): Promise<ReviewDTO> => {
  return api.get(`/reviews/${id}`);
};

export const approveReview = (id: string): Promise<{ approved: boolean }> => {
  return api.post(`/reviews/${id}/approve`);
};

export const rejectReview = (id: string): Promise<{ rejected: boolean }> => {
  return api.post(`/reviews/${id}/reject`);
};

export const batchApproveReviews = (ids: string[]): Promise<{ approved: number }> => {
  return api.post("/reviews/batch-approve", { ids });
};

export const batchRejectReviews = (ids: string[]): Promise<{ rejected: number }> => {
  return api.post("/reviews/batch-reject", { ids });
};

