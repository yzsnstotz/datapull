/**
 * API 服务入口
 * 提供 Fastify 服务器和路由聚合
 */

import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import websocket from "@fastify/websocket";
import basicAuth from "@fastify/basic-auth";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { logger } from "../utils/logger.js";

// 加载环境变量
dotenv.config();
import { sourcesRoutes } from "./routes/sources.js";
import { tasksRoutes } from "./routes/tasks.js";
import { logsRoutes } from "./routes/logs.js";
import { uploadRoutes } from "./routes/upload.js";
import { systemRoutes } from "./routes/system.js";
import { reviewRoutes } from "./routes/review.js";
import { setupWebSocket } from "./websocket.js";
import { loadReviewsFromFile } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.DATAPULL_PORT) || 3100;
const GUI_AUTH_ENABLED = process.env.GUI_AUTH_ENABLED === "true";
const GUI_BASIC_USER = process.env.GUI_BASIC_USER || "admin";
const GUI_BASIC_PASS = process.env.GUI_BASIC_PASS || "admin123";

/**
 * 启动 API 服务
 */
export async function startApiServer() {
  const app = Fastify({
    logger: false, // 使用自定义logger
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Basic Auth（如果启用）
  if (GUI_AUTH_ENABLED) {
    await app.register(basicAuth, {
      validate: async (username, password, req, reply) => {
        if (username === GUI_BASIC_USER && password === GUI_BASIC_PASS) {
          return;
        }
        return new Error("Unauthorized");
      },
      authenticate: { realm: "Datapull GUI" },
    });

    // 保护所有 /api 路由
    app.addHook("onRequest", async (request, reply) => {
      if (request.url.startsWith("/api")) {
        await request.basicAuth();
      }
    });
  }

  // WebSocket
  await app.register(websocket);

  // 静态文件（GUI前端）
  const guiDistPath = join(__dirname, "../../gui/dist");
  if (existsSync(guiDistPath)) {
    await app.register(staticFiles, {
      root: guiDistPath,
      prefix: "/",
    });
  }

  // API 路由
  await app.register(sourcesRoutes, { prefix: "/api/sources" });
  await app.register(tasksRoutes, { prefix: "/api/tasks" });
  await app.register(logsRoutes, { prefix: "/api/logs" });
  await app.register(uploadRoutes, { prefix: "/api" });
  await app.register(systemRoutes, { prefix: "/api/system" });
  await app.register(reviewRoutes, { prefix: "/api" });

  // WebSocket 路由
  await app.register(setupWebSocket, { prefix: "/ws" });

  // 健康检查
  app.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // 加载已保存的审查数据
  try {
    await loadReviewsFromFile();
  } catch (error) {
    logger.error("加载审查数据失败", { error });
  }

  // 启动服务器
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`API 服务器启动成功`, { port: PORT });
    return app;
  } catch (error) {
    logger.error("API 服务器启动失败", { error });
    throw error;
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  startApiServer().catch((error) => {
    logger.error("启动失败", { error });
    process.exit(1);
  });
}

