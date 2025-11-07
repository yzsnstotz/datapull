/**
 * GUI 全局状态管理
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Source,
  TaskStatusDTO,
  ChunkDTO,
  LogEntry,
  SystemStatusDTO,
  WsEvent,
} from "../types/common";
import * as api from "../services/datapullApi";

export const useGuiStore = defineStore("gui", () => {
  // 状态
  const sources = ref<Source[]>([]);
  const taskStatus = ref<TaskStatusDTO>({
    status: "idle",
    runningSources: [],
  });
  const chunks = ref<ChunkDTO[]>([]);
  const logs = ref<LogEntry[]>([]);
  const systemStatus = ref<SystemStatusDTO | null>(null);
  const wsConnected = ref(false);
  
  // 从 localStorage 读取清空时间戳
  const LOGS_CLEARED_KEY = "datapull_logs_cleared_at";
  const getClearedTimestamp = (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LOGS_CLEARED_KEY);
  };
  const logsClearedAt = ref<string | null>(getClearedTimestamp());
  const logsCleared = computed(() => logsClearedAt.value !== null);

  // WebSocket 连接
  let ws: WebSocket | null = null;

  // 计算属性
  const isTaskRunning = computed(() => taskStatus.value.status === "running");

  // Actions
  async function loadSources() {
    try {
      sources.value = await api.getSources();
    } catch (error) {
      console.error("加载数据源失败", error);
      throw error;
    }
  }

  async function loadTaskStatus() {
    try {
      taskStatus.value = await api.getTaskStatus();
    } catch (error) {
      console.error("加载任务状态失败", error);
      throw error;
    }
  }

  async function loadChunks(params: {
    status?: "pending" | "uploaded" | "failed";
    sourceId?: string;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const result = await api.listChunks(params);
      chunks.value = result.items;
      return result;
    } catch (error) {
      console.error("加载分片失败", error);
      throw error;
    }
  }

  async function loadLogs(params: {
    type?: "system" | "crawl" | "upload";
    sourceId?: string;
    level?: string;
    limit?: number;
  }) {
    try {
      const result = await api.getLogs(params);
      
      // 如果日志已清空，过滤掉清空时间之前的日志
      if (logsClearedAt.value) {
        const clearedTimestamp = new Date(logsClearedAt.value).getTime();
        logs.value = result.items.filter((log) => {
          const logTimestamp = new Date(log.ts).getTime();
          return logTimestamp >= clearedTimestamp;
        });
      } else {
        logs.value = result.items;
      }
      
      return result;
    } catch (error) {
      console.error("加载日志失败", error);
      throw error;
    }
  }

  async function loadSystemStatus() {
    try {
      systemStatus.value = await api.getSystemStatus();
    } catch (error) {
      console.error("加载系统状态失败", error);
      throw error;
    }
  }

  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsConnected.value = true;
      console.log("WebSocket 连接已建立");
    };

    ws.onmessage = (event) => {
      try {
        const lines = event.data.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          const event: WsEvent = JSON.parse(line);
          handleWebSocketEvent(event);
        }
      } catch (error) {
        console.error("解析 WebSocket 消息失败", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket 错误", error);
      wsConnected.value = false;
    };

    ws.onclose = () => {
      wsConnected.value = false;
      console.log("WebSocket 连接已关闭");
      // 尝试重连
      setTimeout(() => {
        if (!wsConnected.value) {
          connectWebSocket();
        }
      }, 3000);
    };
  }

  function handleWebSocketEvent(event: WsEvent) {
    switch (event.event) {
      case "task.status":
        taskStatus.value = event.payload;
        break;
      case "log.append":
        // 如果日志已清空，只显示清空时间之后的日志
        if (logsClearedAt.value) {
          const clearedTimestamp = new Date(logsClearedAt.value).getTime();
          const logTimestamp = new Date(event.payload.ts).getTime();
          if (logTimestamp >= clearedTimestamp) {
            logs.value.unshift(event.payload);
            if (logs.value.length > 1000) {
              logs.value = logs.value.slice(0, 1000);
            }
          }
        } else {
          logs.value.unshift(event.payload);
          if (logs.value.length > 1000) {
            logs.value = logs.value.slice(0, 1000);
          }
        }
        break;
      case "chunk.update":
        const chunk = chunks.value.find((c) => c.id === event.payload.chunkId);
        if (chunk) {
          chunk.status = event.payload.status;
          if (event.payload.errorMessage) {
            chunk.errorMessage = event.payload.errorMessage;
          }
        }
        break;
      case "upload.completed":
        // 可以在这里处理上传完成事件
        console.log("上传完成", event.payload);
        break;
      case "heartbeat":
        // 心跳，不做处理
        break;
    }
  }

  function disconnectWebSocket() {
    if (ws) {
      ws.close();
      ws = null;
      wsConnected.value = false;
    }
  }

  function clearLogs() {
    logs.value = [];
    // 保存清空时间戳到 localStorage
    const clearedAt = new Date().toISOString();
    logsClearedAt.value = clearedAt;
    if (typeof window !== "undefined") {
      localStorage.setItem(LOGS_CLEARED_KEY, clearedAt);
    }
  }

  function resetLogsCleared() {
    // 清除 localStorage 中的清空时间戳
    logsClearedAt.value = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOGS_CLEARED_KEY);
    }
  }

  return {
    // 状态
    sources,
    taskStatus,
    chunks,
    logs,
    systemStatus,
    wsConnected,
    logsCleared,
    // 计算属性
    isTaskRunning,
    // Actions
    loadSources,
    loadTaskStatus,
    loadChunks,
    loadLogs,
    loadSystemStatus,
    connectWebSocket,
    disconnectWebSocket,
    clearLogs,
    resetLogsCleared,
  };
});

