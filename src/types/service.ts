/**
 * 模块名：Service Types
 * 职责：定义服务模块相关类型
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { TaskStatus, LangCode, ISODate } from "./common.js";
import type { IngestResult } from "./ingester.js";

export interface OperationRecord {
  operationId: string;
  sourceId: string;
  status: TaskStatus;
  docsCount: number;
  failedCount: number;
  createdAt: ISODate;
  completedAt?: ISODate;
  metadata: {
    version: string;
    lang: LangCode;
    crawlerVersion: string;
  };
}

/**
 * 认证配置
 */
export interface AuthConfig {
  /** Cookie 字符串，例如: "session_id=abc123; token=xyz789" */
  cookies?: string;
  /** Authorization 头，例如: "Bearer token123" 或 "Basic base64string" */
  authorization?: string;
  /** 自定义请求头，键值对 */
  headers?: Record<string, string>;
}

export interface SourceConfig {
  id: string;
  title: string;
  type: "official" | "organization" | "education";
  lang: LangCode;
  version: string;
  seeds: string[];
  include: string[];
  exclude: string[];
  maxDepth: number;
  maxPages: number;
  /** 认证配置（可选），用于需要登录的网站 */
  auth?: AuthConfig;
}

