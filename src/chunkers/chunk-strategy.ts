/**
 * 模块名：Chunk Strategy
 * 职责：定义分片策略接口
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { DocumentChunk, LangCode } from "../types/chunker.js";

/**
 * 分片策略接口
 */
export interface ChunkStrategy {
  /**
   * 将文本分割为分片
   * @param text - 要分割的文本
   * @param lang - 语言代码
   * @param parentUrl - 父 URL
   * @param sourceId - 源 ID
   * @returns 分片数组
   */
  split(
    text: string,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk[];
}

