/**
 * GUI 通用类型定义
 * 与后端API保持一致
 */

export type ISODate = string;

export type TaskStatus = "idle" | "running" | "stopped" | "error";
export type ChunkStatus = "pending" | "uploaded" | "failed";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type LogType = "system" | "crawl" | "upload";
export type LangCode = "ja" | "zh" | "en";

export interface ApiRespOk<T> {
  success: true;
  data: T;
}

export interface ApiRespErr {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResp<T> = ApiRespOk<T> | ApiRespErr;

// 认证配置
export interface AuthConfig {
  /** Cookie 字符串，例如: "session_id=abc123; token=xyz789" */
  cookies?: string;
  /** Authorization 头，例如: "Bearer token123" 或 "Basic base64string" */
  authorization?: string;
  /** 自定义请求头，键值对 */
  headers?: Record<string, string>;
}

// Source（数据源）
export interface Source {
  id: string;
  name: string;
  seedUrls: string[];
  include: string[];
  exclude: string[];
  lang: LangCode;
  version: string;
  enabled: boolean;
  crawlDepth?: number;
  rateLimitQPS?: number;
  notes?: string;
  /** 认证配置（可选），用于需要登录的网站 */
  auth?: AuthConfig;
  updatedAt: ISODate;
  createdAt: ISODate;
}

// Task（任务状态）
export interface TaskStatusDTO {
  status: TaskStatus;
  runningSources: string[];
  startedAt?: ISODate;
  lastHeartbeat?: ISODate;
  progress?: {
    [sourceId: string]: {
      pagesVisited: number;
      chunksGenerated: number;
      uploaded: number;
      failed: number;
    };
  };
}

// Chunk（分片记录）
export interface ChunkDTO {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  content: string;
  version: string;
  lang: LangCode;
  meta: {
    chunkIndex: number;
    totalChunks: number;
    contentHash: string;
  };
  status: ChunkStatus;
  errorMessage?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// System（系统状态）
export interface SystemStatusDTO {
  version: string;
  appUptimeSec: number;
  cpuUsage: number;
  memUsage: number;
  diskFreeGB: number;
  queueSize: number;
  driveQuizReachable: boolean;
  lastUploadAt?: ISODate;
}

// Log Entry
export interface LogEntry {
  ts: ISODate;
  type: LogType;
  level: string;
  message: string;
  sourceId?: string;
}

// Review（审查文档）
export interface ReviewDTO {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  content: string;
  lang: LangCode;
  version: string;
  status: ReviewStatus;
  metadata?: Record<string, string>;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// WebSocket Event
export type WsEvent =
  | { event: "task.status"; payload: TaskStatusDTO }
  | { event: "log.append"; payload: LogEntry }
  | { event: "chunk.update"; payload: { chunkId: string; status: ChunkStatus; errorMessage?: string } }
  | { event: "upload.completed"; payload: { operationId: string; processed: number; failed: number } }
  | { event: "review.update"; payload: { reviewId: string; status: ReviewStatus } }
  | { event: "heartbeat"; payload: {} };

