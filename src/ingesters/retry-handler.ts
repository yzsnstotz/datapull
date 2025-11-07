/**
 * 模块名：Retry Handler
 * 职责：封装统一重试逻辑
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import { logger } from "../utils/logger.js";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000; // 1秒

/**
 * 重试函数
 * @param fn - 要重试的函数
 * @param maxRetries - 最大重试次数
 * @param initialDelay - 初始延迟（毫秒）
 * @returns 函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  initialDelay: number = DEFAULT_INITIAL_DELAY
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // 指数退避：delay = initialDelay * 2^attempt
        const delay = initialDelay * Math.pow(2, attempt);
        logger.warn(`重试 ${attempt + 1}/${maxRetries}，延迟 ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(`重试失败，已达最大次数: ${maxRetries}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  throw lastError;
}

