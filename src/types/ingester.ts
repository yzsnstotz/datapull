/**
 * 模块名：Ingester Types
 * 职责：定义入库模块相关类型
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { DocumentChunk } from "./chunker.js";
import type { ISODate } from "./common.js";

export interface IngestRequest {
  docs: DocumentChunk[];
  sourceId: string;
  version: string;
  batchMetadata?: {
    totalDocs: number;
    crawledAt: ISODate;
    crawlerVersion: string;
  };
}

export interface IngestResult {
  success: boolean;
  processed: number;
  failed: number;
  operationId: string;
  results: {
    docId?: string;
    index: number;
    status: "success" | "failed";
    error?: {
      code: string;
      message: string;
    };
  }[];
}

