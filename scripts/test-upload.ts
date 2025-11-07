/**
 * 测试上传脚本
 * 用于模拟上传并排查问题
 */

import dotenv from "dotenv";
import { IngestService } from "../src/services/ingest-service.js";
import type { DocumentChunk } from "../src/types/chunker.js";
import { logger } from "../src/utils/logger.js";
import { addChunk } from "../src/api/store.js";
import { DriveQuizClient } from "../src/ingesters/drivequiz-client.js";

// 加载环境变量
dotenv.config();

async function testUpload() {
  logger.info("=== 开始测试上传 ===");

  // 0. 检查环境变量
  const apiUrl = process.env.DRIVEQUIZ_API_URL || "http://localhost:8789/api/v1/rag";
  const apiToken = process.env.DRIVEQUIZ_API_TOKEN || "";

  logger.info("环境变量检查", {
    DRIVEQUIZ_API_URL: apiUrl,
    DRIVEQUIZ_API_TOKEN: apiToken ? `${apiToken.substring(0, 10)}...` : "未设置",
    hasToken: !!apiToken,
  });

  // 0.1. 测试 DriveQuizClient 连接
  const client = new DriveQuizClient();
  try {
    logger.info("测试 DriveQuiz API 健康检查");
    const isHealthy = await client.healthCheck();
    logger.info("DriveQuiz API 健康检查结果", {
      isHealthy,
    });
  } catch (error) {
    logger.error("DriveQuiz API 健康检查失败", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 1. 创建一个测试分片
  const testChunk: DocumentChunk = {
    chunkIndex: 1,
    totalChunks: 1,
    content: "这是一个测试文档内容。This is a test document content. これはテストドキュメントの内容です。".repeat(10), // 确保内容长度足够
    lang: "zh",
    contentHash: "test_hash_" + Date.now(),
    parentUrl: "https://example.com/test",
    sourceId: "test_source",
  };

  logger.info("创建测试分片", {
    contentHash: testChunk.contentHash,
    contentLength: testChunk.content.length,
    lang: testChunk.lang,
    sourceId: testChunk.sourceId,
  });

  // 2. 将分片存储到 chunksStore
  const chunkDTO = addChunk({
    sourceId: testChunk.sourceId,
    title: "测试文档",
    url: testChunk.parentUrl,
    content: testChunk.content,
    version: "2025Q1",
    lang: testChunk.lang,
    meta: {
      chunkIndex: testChunk.chunkIndex,
      totalChunks: testChunk.totalChunks,
      contentHash: testChunk.contentHash,
    },
    status: "pending",
  });

  logger.info("分片已存储到 chunksStore", {
    chunkId: chunkDTO.id,
    status: chunkDTO.status,
  });

  // 3. 测试 IngestService
  const ingestService = new IngestService();
  
  try {
    logger.info("开始调用 IngestService.process", {
      sourceId: testChunk.sourceId,
      version: "2025Q1",
      chunksCount: 1,
    });

    const result = await ingestService.process(
      testChunk.sourceId,
      "2025Q1",
      [testChunk]
    );

    logger.info("IngestService.process 完成", {
      operationId: result.operationId,
      processed: result.processed,
      failed: result.failed,
      success: result.success,
    });

    if (result.results && result.results.length > 0) {
      logger.info("上传结果详情", {
        results: result.results,
      });
    }

    logger.info("=== 测试上传完成 ===");
  } catch (error) {
    logger.error("测试上传失败", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// 运行测试
testUpload()
  .then(() => {
    logger.info("测试脚本执行完成");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("测试脚本执行失败", { error });
    process.exit(1);
  });

