/**
 * 模块名：Ingest Service
 * 职责：协调分片和上传流程
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import { randomUUID } from "crypto";
import type { IngestResult } from "../types/ingester.js";
import { processChunks } from "../ingesters/batch-processor.js";
import { OperationLogger } from "./operation-logger.js";
import { logger } from "../utils/logger.js";

/**
 * 上传服务
 */
export class IngestService {
  private operationLogger: OperationLogger;

  constructor() {
    this.operationLogger = new OperationLogger();
  }

  /**
   * 处理源数据上传
   * @param sourceId - 源 ID
   * @param version - 版本号
   * @param chunks - 文档分片数组
   * @returns 上传结果
   */
  async process(
    sourceId: string,
    version: string,
    chunks: any[]
  ): Promise<IngestResult> {
    const operationId = `op_${randomUUID().replace(/-/g, "")}`;

    logger.info(`开始上传处理`, {
      operationId,
      sourceId,
      version,
      chunksCount: chunks.length,
    });

    try {
      // 记录操作开始
      await this.operationLogger.logStart(operationId, sourceId, {
        version,
        lang: chunks[0]?.lang || "en",
        crawlerVersion: "1.0.0",
      });

      // 批量上传
      const result = await processChunks(chunks, sourceId, version);

      // 更新操作 ID
      result.operationId = operationId;

      // 记录操作成功
      await this.operationLogger.logSuccess(operationId, result);

      return result;
    } catch (error) {
      // 记录操作失败
      await this.operationLogger.logError(
        operationId,
        error instanceof Error ? error : new Error(String(error))
      );

      throw error;
    }
  }
}

