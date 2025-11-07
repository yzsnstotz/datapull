/**
 * Logs 路由
 * 日志查询：GET /api/logs
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { logger } from "../../utils/logger.js";
import type { LogEntry, LogType, ApiResp } from "../../gui/types/common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RUNTIME_LOG = join(__dirname, "../../../logs/runtime.log");
const ERROR_LOG = join(__dirname, "../../../logs/error.log");

// 内存日志缓存（用于实时日志）
const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER = 1000;

/**
 * 添加日志到缓冲区
 */
export function addLogToBuffer(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }
}

/**
 * 从文件读取日志
 */
function readLogsFromFile(filePath: string, limit: number): LogEntry[] {
  const entries: LogEntry[] = [];
  
  if (!existsSync(filePath)) {
    return entries;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());
    
    for (const line of lines.slice(-limit)) {
      try {
        const log = JSON.parse(line);
        const entry: LogEntry = {
          ts: log.timestamp || new Date().toISOString(),
          type: inferLogType(log.message || ""),
          level: log.level || "info",
          message: log.message || "",
          sourceId: log.sourceId,
        };
        entries.push(entry);
      } catch {
        // 忽略解析失败的日志行
      }
    }
  } catch (error) {
    logger.error("读取日志文件失败", { error, filePath });
  }

  return entries;
}

/**
 * 推断日志类型
 */
function inferLogType(message: string): LogType {
  const msg = message.toLowerCase();
  if (msg.includes("upload") || msg.includes("ingest")) {
    return "upload";
  }
  if (msg.includes("crawl") || msg.includes("fetch") || msg.includes("extract")) {
    return "crawl";
  }
  return "system";
}

export async function logsRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // GET /api/logs
  app.get<{
    Querystring: {
      type?: LogType;
      sourceId?: string;
      level?: string;
      limit?: number;
    };
  }>("/", async (request, reply) => {
    try {
      const { type, sourceId, level, limit = 100 } = request.query;
      const maxLimit = Math.min(limit, 1000);

      // 从内存缓冲区读取
      let entries = [...logBuffer];

      // 从文件读取（如果缓冲区不足）
      if (entries.length < maxLimit) {
        const fileEntries = [
          ...readLogsFromFile(RUNTIME_LOG, maxLimit),
          ...readLogsFromFile(ERROR_LOG, maxLimit),
        ];
        entries = [...fileEntries, ...entries];
      }

      // 去重（按时间戳）
      const uniqueEntries = Array.from(
        new Map(entries.map((e) => [e.ts, e])).values()
      );

      // 排序（最新的在前）
      uniqueEntries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

      // 过滤
      let filtered = uniqueEntries.slice(0, maxLimit);
      if (type) {
        filtered = filtered.filter((e) => e.type === type);
      }
      if (sourceId) {
        filtered = filtered.filter((e) => e.sourceId === sourceId);
      }
      if (level) {
        filtered = filtered.filter((e) => e.level === level);
      }

      const response: ApiResp<{ items: LogEntry[]; nextCursor?: string }> = {
        success: true,
        data: {
          items: filtered,
        },
      };
      return response;
    } catch (error) {
      logger.error("获取日志失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ items: LogEntry[]; nextCursor?: string }>;
    }
  });
}

