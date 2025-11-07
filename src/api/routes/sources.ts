/**
 * Sources 路由
 * 数据源管理：GET/POST/PUT/DELETE /api/sources*
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { logger } from "../../utils/logger.js";
import type { Source, ApiResp } from "../../gui/types/common.js";
import { validateConfig } from "../../utils/validator.js";
import type { SourceConfig } from "../../types/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCES_FILE = process.env.DATAPULL_SOURCES_FILE || join(__dirname, "../../../config/sources.json");

/**
 * 加载 sources 配置
 */
function loadSources(): Source[] {
  try {
    const content = readFileSync(SOURCES_FILE, "utf-8");
    const configs = validateConfig(JSON.parse(content)) as SourceConfig[];
    
    // 转换为 GUI 格式
    return configs.map((config) => ({
      id: config.id,
      name: config.title,
      seedUrls: config.seeds,
      include: config.include || [],
      exclude: config.exclude || [],
      lang: config.lang,
      version: config.version,
      enabled: true, // 默认启用
      crawlDepth: config.maxDepth,
      rateLimitQPS: 5, // 默认值
      notes: "",
      auth: config.auth, // 传递认证配置
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error("加载 sources 失败", { error });
    return [];
  }
}

/**
 * 保存 sources 配置
 */
function saveSources(sources: Source[]): void {
  try {
    // 转换为内部格式
    const configs: SourceConfig[] = sources.map((source) => ({
      id: source.id,
      title: source.name,
      type: "official", // 默认值
      lang: source.lang,
      version: source.version,
      seeds: source.seedUrls,
      include: source.include,
      exclude: source.exclude,
      maxDepth: source.crawlDepth || 2,
      maxPages: 50, // 默认值
      auth: source.auth, // 保存认证配置
    }));

    writeFileSync(SOURCES_FILE, JSON.stringify(configs, null, 2), "utf-8");
    logger.info("保存 sources 成功", { count: sources.length });
  } catch (error) {
    logger.error("保存 sources 失败", { error });
    throw error;
  }
}

/**
 * 验证 Source ID
 */
function validateSourceId(id: string): boolean {
  return /^[a-z0-9_]{3,50}$/.test(id);
}

/**
 * 验证 Source
 * @param source - Source 对象（创建时必填字段必须存在，更新时可选）
 * @param isCreate - 是否为创建操作
 */
function validateSource(source: Partial<Source>, isCreate: boolean = false): string | null {
  // 创建时必填字段验证
  if (isCreate) {
    if (!source.id) {
      return "Source.id 是必填字段";
    }
    if (!source.name) {
      return "Source.name 是必填字段";
    }
    if (!source.seedUrls || source.seedUrls.length === 0) {
      return "Source.seedUrls 是必填字段，至少需要一个种子 URL";
    }
    if (!source.lang) {
      return "Source.lang 是必填字段";
    }
    if (!source.version) {
      return "Source.version 是必填字段";
    }
  }

  // ID 格式验证
  if (source.id && !validateSourceId(source.id)) {
    return "Source.id 必须匹配 ^[a-z0-9_]{3,50}$";
  }

  // 种子 URL 验证
  if (source.seedUrls && source.seedUrls.length > 0) {
    for (const url of source.seedUrls) {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return `seedUrls 必须为 http(s):// 开头: ${url}`;
      }
    }
  }

  // 版本格式验证
  if (source.version && !/^\d{4}(Q[1-4])?$/.test(source.version)) {
    return "version 必须匹配 ^\\d{4}(Q[1-4])?$（如：2025Q1 或 2025）";
  }

  // 语言验证
  if (source.lang && !["ja", "zh", "en"].includes(source.lang)) {
    return "lang 必须为 ja|zh|en";
  }

  // 爬取深度验证
  if (source.crawlDepth !== undefined && (source.crawlDepth < 1 || source.crawlDepth > 5)) {
    return "crawlDepth 必须在 1-5 之间";
  }

  // 速率限制验证
  if (source.rateLimitQPS !== undefined && (source.rateLimitQPS < 1 || source.rateLimitQPS > 50)) {
    return "rateLimitQPS 必须在 1-50 之间";
  }

  return null;
}

export async function sourcesRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // GET /api/sources
  app.get<{ Querystring: { q?: string } }>("/", async (request, reply) => {
    try {
      let sources = loadSources();
      const query = request.query.q;

      if (query) {
        const keyword = query.toLowerCase();
        sources = sources.filter(
          (s) =>
            s.id.toLowerCase().includes(keyword) ||
            s.name.toLowerCase().includes(keyword)
        );
      }

      const response: ApiResp<Source[]> = {
        success: true,
        data: sources,
      };
      return response;
    } catch (error) {
      logger.error("获取 sources 失败", { error });
      const response: ApiResp<Source[]> = {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      reply.code(500);
      return response;
    }
  });

  // POST /api/sources
  app.post<{ Body: Source }>("/", async (request, reply) => {
    try {
      const source = request.body;
      const sources = loadSources();

      // 验证（创建时要求所有必填字段存在）
      const validationError = validateSource(source, true);
      if (validationError) {
        reply.code(400);
        return {
          success: false,
          error: { code: "INVALID_REQUEST", message: validationError },
        } as ApiResp<Source>;
      }

      // 检查重复
      if (sources.some((s) => s.id === source.id)) {
        reply.code(409);
        return {
          success: false,
          error: { code: "SOURCE_DUPLICATE", message: "Source.id 已存在" },
        } as ApiResp<Source>;
      }

      // 添加时间戳
      const now = new Date().toISOString();
      source.createdAt = now;
      source.updatedAt = now;

      sources.push(source);
      saveSources(sources);

      return { success: true, data: source } as ApiResp<Source>;
    } catch (error) {
      logger.error("创建 source 失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<Source>;
    }
  });

  // PUT /api/sources/:id
  app.put<{ Params: { id: string }; Body: Partial<Source> }>(
    "/:id",
    async (request, reply) => {
      try {
        const { id } = request.params;
        const updates = request.body;
        const sources = loadSources();
        const index = sources.findIndex((s) => s.id === id);

        if (index === -1) {
          reply.code(404);
          return {
            success: false,
            error: { code: "NOT_FOUND", message: "Source 不存在" },
          } as ApiResp<Source>;
        }

        // 不允许修改 id
        if (updates.id && updates.id !== id) {
          reply.code(400);
          return {
            success: false,
            error: { code: "INVALID_REQUEST", message: "不允许修改 id" },
          } as ApiResp<Source>;
        }

        // 验证
        const validationError = validateSource(updates);
        if (validationError) {
          reply.code(400);
          return {
            success: false,
            error: { code: "INVALID_REQUEST", message: validationError },
          } as ApiResp<Source>;
        }

        // 更新
        sources[index] = {
          ...sources[index],
          ...updates,
          id, // 确保 id 不变
          updatedAt: new Date().toISOString(),
        };

        saveSources(sources);

        return { success: true, data: sources[index] } as ApiResp<Source>;
      } catch (error) {
        logger.error("更新 source 失败", { error });
        reply.code(500);
        return {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
          },
        } as ApiResp<Source>;
      }
    }
  );

  // DELETE /api/sources/:id
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const sources = loadSources();
      const index = sources.findIndex((s) => s.id === id);

      if (index === -1) {
        reply.code(404);
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Source 不存在" },
        } as ApiResp<{ deleted: boolean }>;
      }

      sources.splice(index, 1);
      saveSources(sources);

      return { success: true, data: { deleted: true } } as ApiResp<{ deleted: boolean }>;
    } catch (error) {
      logger.error("删除 source 失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ deleted: boolean }>;
    }
  });
}

