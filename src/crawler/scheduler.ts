/**
 * 模块名：Scheduler
 * 职责：控制爬取任务队列、并发和间隔
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import PQueue from "p-queue";
import type { CrawlTask, CrawlResult } from "../types/crawler.js";
import { fetchPage } from "./fetcher.js";
import { logger } from "../utils/logger.js";

const DEFAULT_CONCURRENCY = parseInt(
  process.env.CRAWL_CONCURRENCY || "5",
  10
);
const DEFAULT_DELAY = 500; // 默认延迟 500ms

export interface SchedulerOptions {
  concurrency?: number;
  delay?: number;
}

/**
 * 启动爬取调度器
 * @param tasks - 爬取任务数组
 * @param options - 调度器选项
 * @returns 爬取结果数组
 */
export async function startScheduler(
  tasks: CrawlTask[],
  options: SchedulerOptions = {}
): Promise<CrawlResult[]> {
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;
  const delay = options.delay || DEFAULT_DELAY;

  const queue = new PQueue({
    concurrency,
    interval: delay,
    intervalCap: 1,
  });

  const results: CrawlResult[] = [];
  let completed = 0;
  const total = tasks.length;

  logger.info(`开始爬取调度`, {
    total,
    concurrency,
    delay,
  });

  for (const task of tasks) {
    queue
      .add(async () => {
        const result = await fetchPage(task);
        results.push(result);
        completed++;

        if (result.error) {
          logger.warn(`任务失败: ${task.url}`, { error: result.error });
        } else {
          logger.debug(`任务完成: ${task.url}`, {
            status: result.status,
            contentType: result.contentType,
          });
        }

        if (completed % 10 === 0) {
          logger.info(`进度: ${completed}/${total}`, {
            completed,
            total,
            percentage: Math.round((completed / total) * 100),
          });
        }
      })
      .catch((error) => {
        logger.error(`队列任务异常: ${task.url}`, { error });
        results.push({
          url: task.url,
          status: 500,
          fetchedAt: new Date().toISOString(),
          error: error.message,
        });
        completed++;
      });
  }

  await queue.onIdle();

  logger.info(`爬取调度完成`, {
    total,
    completed,
    success: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
  });

  return results;
}

