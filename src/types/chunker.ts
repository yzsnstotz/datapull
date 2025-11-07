/**
 * 模块名：Chunker Types
 * 职责：定义分片模块相关类型
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { LangCode } from "./common.js";

export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  lang: LangCode;
  contentHash: string;
  parentUrl: string;
  sourceId: string;
}

