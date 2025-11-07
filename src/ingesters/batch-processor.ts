/**
 * 模块名：Batch Processor
 * 职责：按批次处理文档上传
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { DocumentChunk } from "../types/chunker.js";
import type { IngestRequest, IngestResult } from "../types/ingester.js";
import { DriveQuizClient } from "./drivequiz-client.js";
import { logger } from "../utils/logger.js";

const DEFAULT_BATCH_SIZE = 100;

/**
 * 批量处理文档上传
 * @param docs - 文档分片数组
 * @param sourceId - 源 ID
 * @param version - 版本号
 * @param batchSize - 批次大小
 * @returns 处理结果
 */
export async function processChunks(
  docs: DocumentChunk[],
  sourceId: string,
  version: string,
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<IngestResult> {
  const client = new DriveQuizClient();
  const totalDocs = docs.length;
  let totalProcessed = 0;
  let totalFailed = 0;
  const allResults: IngestResult["results"] = [];
  let operationId = "";

  logger.info(`开始批量处理`, {
    totalDocs,
    batchSize,
    sourceId,
    version,
  });

  // 分批处理
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalDocs / batchSize);

    logger.info(`处理批次 ${batchNumber}/${totalBatches}`, {
      batchSize: batch.length,
      startIndex: i,
    });

    try {
      const request: IngestRequest = {
        docs: batch,
        sourceId,
        version,
        batchMetadata: {
          totalDocs: batch.length,
          crawledAt: new Date().toISOString(),
          crawlerVersion: "1.0.0",
        },
      };

      logger.debug(`调用 DriveQuizClient.uploadBatch`, {
        batchNumber,
        batchSize: batch.length,
        sourceId,
        version,
      });

      const result = await client.uploadBatch(request);

      totalProcessed += result.processed;
      totalFailed += result.failed;
      allResults.push(...result.results);

      if (result.operationId && !operationId) {
        operationId = result.operationId;
      }

      logger.info(`批次 ${batchNumber} 完成`, {
        processed: result.processed,
        failed: result.failed,
      });
    } catch (error) {
      logger.error(`批次 ${batchNumber} 失败`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        batchSize: batch.length,
        sourceId,
        version,
      });

      // 记录失败项
      batch.forEach((_, index) => {
        allResults.push({
          index: i + index,
          status: "failed",
          error: {
            code: "BATCH_ERROR",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      });

      totalFailed += batch.length;
    }
  }

  const finalResult: IngestResult = {
    success: totalFailed === 0,
    processed: totalProcessed,
    failed: totalFailed,
    operationId,
    results: allResults,
  };

  logger.info(`批量处理完成`, {
    totalProcessed,
    totalFailed,
    operationId,
  });

  return finalResult;
}

