/**
 * Tasks 路由
 * 任务控制：POST /api/tasks/*, GET /api/tasks/status
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { logger } from "../../utils/logger.js";
import type { TaskStatusDTO, ApiResp } from "../../gui/types/common.js";
import { getTaskStatus, updateTaskStatus } from "../store.js";
import { CrawlService } from "../../services/crawl-service.js";
import type { SourceConfig } from "../../types/service.js";
import { validateConfig } from "../../utils/validator.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCES_FILE = process.env.DATAPULL_SOURCES_FILE || join(__dirname, "../../../config/sources.json");

let crawlService: CrawlService | null = null;
let isRunning = false;

/**
 * 加载源配置（内部格式）
 */
function loadSourceConfigs(): SourceConfig[] {
  try {
    const content = readFileSync(SOURCES_FILE, "utf-8");
    return validateConfig(JSON.parse(content)) as SourceConfig[];
  } catch (error) {
    logger.error("加载源配置失败", { error });
    return [];
  }
}

export async function tasksRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // POST /api/tasks/start
  app.post<{
    Body: { sourceIds?: string[]; mode?: "full" | "incremental" };
  }>("/start", async (request, reply) => {
    try {
      if (isRunning) {
        reply.code(409);
        return {
          success: false,
          error: {
            code: "TASK_CONFLICT",
            message: "任务运行中，无法重复启动",
          },
        } as ApiResp<{ started: boolean; startedAt: string }>;
      }

      const { sourceIds, mode = "full" } = request.body;
      const allConfigs = loadSourceConfigs();
      
      // 过滤要执行的源
      let configsToRun: SourceConfig[];
      if (sourceIds && sourceIds.length > 0) {
        configsToRun = allConfigs.filter((c) => sourceIds.includes(c.id) && c.id);
      } else {
        // 默认执行所有启用的源（这里简化处理，执行所有源）
        configsToRun = allConfigs;
      }

      if (configsToRun.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "没有可执行的源",
          },
        } as ApiResp<{ started: boolean; startedAt: string }>;
      }

      // 更新任务状态
      const startedAt = new Date().toISOString();
      updateTaskStatus({
        status: "running",
        runningSources: configsToRun.map((c) => c.id),
        startedAt,
      });
      isRunning = true;

      // 异步执行任务
      crawlService = new CrawlService();
      (async () => {
        try {
          for (const config of configsToRun) {
            logger.info(`开始执行源: ${config.id}`);
            await crawlService!.startCrawl(config.id, config);
          }
          
          updateTaskStatus({
            status: "idle",
            runningSources: [],
          });
          isRunning = false;
          logger.info("所有任务执行完成");
        } catch (error) {
          logger.error("任务执行失败", { error });
          updateTaskStatus({
            status: "error",
            runningSources: [],
          });
          isRunning = false;
        }
      })();

      return {
        success: true,
        data: { started: true, startedAt },
      } as ApiResp<{ started: boolean; startedAt: string }>;
    } catch (error) {
      logger.error("启动任务失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ started: boolean; startedAt: string }>;
    }
  });

  // POST /api/tasks/stop
  app.post("/stop", async (request, reply) => {
    try {
      if (!isRunning) {
        reply.code(400);
        return {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "没有运行中的任务",
          },
        } as ApiResp<{ stopped: boolean; stoppedAt: string }>;
      }

      // 停止任务（这里简化处理，实际应该中断爬取）
      updateTaskStatus({
        status: "stopped",
        runningSources: [],
      });
      isRunning = false;
      crawlService = null;

      const stoppedAt = new Date().toISOString();
      return {
        success: true,
        data: { stopped: true, stoppedAt },
      } as ApiResp<{ stopped: boolean; stoppedAt: string }>;
    } catch (error) {
      logger.error("停止任务失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ stopped: boolean; stoppedAt: string }>;
    }
  });

  // GET /api/tasks/status
  app.get("/status", async (request, reply) => {
    try {
      const status = getTaskStatus();
      return { success: true, data: status } as ApiResp<TaskStatusDTO>;
    } catch (error) {
      logger.error("获取任务状态失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<TaskStatusDTO>;
    }
  });
}


