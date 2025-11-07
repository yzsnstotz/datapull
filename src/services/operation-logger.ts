/**
 * 模块名：Operation Logger
 * 职责：记录操作日志和状态
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { OperationRecord } from "../types/service.js";
import type { IngestResult } from "../types/ingester.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPERATIONS_DIR = path.join(__dirname, "../../logs/operations");

/**
 * 确保操作日志目录存在
 */
async function ensureOperationsDir(): Promise<void> {
  try {
    await fs.mkdir(OPERATIONS_DIR, { recursive: true });
  } catch (error) {
    logger.error(`创建操作日志目录失败`, { error });
  }
}

/**
 * 操作日志记录器
 */
export class OperationLogger {
  /**
   * 记录操作开始
   * @param operationId - 操作 ID
   * @param sourceId - 源 ID
   * @param metadata - 元数据
   */
  async logStart(
    operationId: string,
    sourceId: string,
    metadata: OperationRecord["metadata"]
  ): Promise<void> {
    await ensureOperationsDir();

    const record: OperationRecord = {
      operationId,
      sourceId,
      status: "processing",
      docsCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      metadata,
    };

    const filePath = path.join(OPERATIONS_DIR, `${operationId}.json`);
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

    logger.info(`操作开始: ${operationId}`, { sourceId });
  }

  /**
   * 记录操作成功
   * @param operationId - 操作 ID
   * @param summary - 上传结果摘要
   */
  async logSuccess(operationId: string, summary: IngestResult): Promise<void> {
    await ensureOperationsDir();

    const filePath = path.join(OPERATIONS_DIR, `${operationId}.json`);
    let record: OperationRecord;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      record = JSON.parse(content);
    } catch {
      // 如果文件不存在，创建新记录
      record = {
        operationId,
        sourceId: "",
        status: "completed",
        docsCount: summary.processed,
        failedCount: summary.failed,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: {
          version: "",
          lang: "en",
          crawlerVersion: "1.0.0",
        },
      };
    }

    record.status = "completed";
    record.docsCount = summary.processed;
    record.failedCount = summary.failed;
    record.completedAt = new Date().toISOString();

    await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

    logger.info(`操作成功: ${operationId}`, {
      processed: summary.processed,
      failed: summary.failed,
    });
  }

  /**
   * 记录操作错误
   * @param operationId - 操作 ID
   * @param error - 错误对象
   */
  async logError(operationId: string, error: Error): Promise<void> {
    await ensureOperationsDir();

    const filePath = path.join(OPERATIONS_DIR, `${operationId}.json`);
    let record: OperationRecord;

    try {
      const content = await fs.readFile(filePath, "utf-8");
      record = JSON.parse(content);
    } catch {
      record = {
        operationId,
        sourceId: "",
        status: "failed",
        docsCount: 0,
        failedCount: 0,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: {
          version: "",
          lang: "en",
          crawlerVersion: "1.0.0",
        },
      };
    }

    record.status = "failed";
    record.completedAt = new Date().toISOString();

    await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

    logger.error(`操作失败: ${operationId}`, { error: error.message });
  }

  /**
   * 读取操作记录
   * @param operationId - 操作 ID
   * @returns 操作记录
   */
  async getOperation(operationId: string): Promise<OperationRecord | null> {
    const filePath = path.join(OPERATIONS_DIR, `${operationId}.json`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as OperationRecord;
    } catch {
      return null;
    }
  }
}

