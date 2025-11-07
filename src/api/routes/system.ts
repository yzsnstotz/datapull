/**
 * System 路由
 * 系统状态：GET /api/system/status
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { logger } from "../../utils/logger.js";
import type { SystemStatusDTO, ApiResp } from "../../gui/types/common.js";
import os from "os";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_JSON = join(__dirname, "../../../package.json");

const startTime = Date.now();

/**
 * 获取系统状态
 */
async function getSystemStatus(): Promise<SystemStatusDTO> {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memUsage = ((totalMem - freeMem) / totalMem) * 100;

  // CPU 使用率（简化计算）
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / uptime * 100;

  // 磁盘空间（简化处理，获取当前目录所在磁盘）
  const diskFreeGB = 0; // 需要额外库来获取，这里简化处理

  // 版本号
  let version = "1.0.0";
  try {
    if (existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
      version = pkg.version || "1.0.0";
    }
  } catch (error) {
    logger.warn("读取版本号失败", { error });
  }

  // DriveQuiz 连通性（简化处理，这里假设可连通）
  const driveQuizReachable = !!process.env.DRIVEQUIZ_API_URL;

  // 队列大小（从 store 获取）
  const { listChunks } = await import("../store.js");
  const queueResult = listChunks({ status: "pending" });
  const queueSize = queueResult.total;

  return {
    version,
    appUptimeSec: uptime,
    cpuUsage: Math.min(cpuPercent, 100),
    memUsage: Math.min(memUsage, 100),
    diskFreeGB,
    queueSize,
    driveQuizReachable,
  };
}

export async function systemRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // GET /api/system/status
  app.get("/status", async (request, reply) => {
    try {
      const status = await getSystemStatus();
      const response: ApiResp<SystemStatusDTO> = {
        success: true,
        data: status,
      };
      return response;
    } catch (error) {
      logger.error("获取系统状态失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<SystemStatusDTO>;
    }
  });
}

