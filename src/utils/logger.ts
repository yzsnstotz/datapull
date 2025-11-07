/**
 * 模块名：Logger
 * 职责：提供结构化日志输出
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logLevel = process.env.LOG_LEVEL || "info";

/**
 * 创建日志记录器
 * @param level - 日志级别
 * @returns Winston logger 实例
 */
export function createLogger(level: string = logLevel): winston.Logger {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: "datapull" },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      new winston.transports.File({
        filename: path.join(__dirname, "../../logs/error.log"),
        level: "error",
      }),
      new winston.transports.File({
        filename: path.join(__dirname, "../../logs/runtime.log"),
      }),
    ],
  });
}

export const logger = createLogger();

