/**
 * WebSocket 支持
 * 实时推送任务状态、日志等
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { logger } from "../utils/logger.js";
import type { WsEvent } from "../gui/types/common.js";
import { getTaskStatus } from "./store.js";
import { addLogToBuffer } from "./routes/logs.js";

const connections = new Set<any>();

/**
 * 广播事件到所有连接
 */
export function broadcastEvent(event: WsEvent): void {
  const message = JSON.stringify(event) + "\n";
  for (const connection of connections) {
    try {
      connection.socket.send(message);
    } catch (error) {
      logger.warn("WebSocket 发送失败", { error });
      connections.delete(connection);
    }
  }
}

/**
 * 设置 WebSocket 路由
 */
export async function setupWebSocket(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  app.get("/", { websocket: true }, (connection, req) => {
    connections.add(connection);
    // 只在控制台记录，不写入日志文件（避免在 GUI 中重复显示）
    console.log(`WebSocket 连接建立 (当前连接数: ${connections.size})`);

    // 发送初始任务状态
    const status = getTaskStatus();
    connection.socket.send(
      JSON.stringify({ event: "task.status", payload: status }) + "\n"
    );

    // 心跳定时器
    const heartbeatInterval = setInterval(() => {
      try {
        connection.socket.send(
          JSON.stringify({ event: "heartbeat", payload: {} }) + "\n"
        );
      } catch (error) {
        clearInterval(heartbeatInterval);
        connections.delete(connection);
      }
    }, 30000); // 30秒

    connection.socket.on("close", () => {
      clearInterval(heartbeatInterval);
      connections.delete(connection);
      // 只在控制台记录，不写入日志文件（避免在 GUI 中重复显示）
      console.log(`WebSocket 连接关闭 (当前连接数: ${connections.size})`);
    });

    connection.socket.on("error", (error) => {
      logger.error("WebSocket 错误", { error });
      clearInterval(heartbeatInterval);
      connections.delete(connection);
    });
  });
}

