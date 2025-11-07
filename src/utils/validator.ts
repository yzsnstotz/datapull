/**
 * 模块名：Validator
 * 职责：提供配置验证功能
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import { z } from "zod";
import type { SourceConfig } from "../types/service.js";

const AuthConfigSchema = z.object({
  cookies: z.string().optional(),
  authorization: z.string().optional(),
  headers: z.record(z.string()).optional(),
}).optional();

const SourceConfigSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["official", "organization", "education"]),
  lang: z.enum(["ja", "zh", "en"]),
  version: z.string().min(1),
  seeds: z.array(z.string().url()).min(1),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxDepth: z.number().int().min(0).max(10).default(2),
  maxPages: z.number().int().min(1).max(1000).default(50),
  auth: AuthConfigSchema,
});

const SourcesConfigSchema = z.array(SourceConfigSchema);

/**
 * 验证配置文件
 * @param config - 配置对象
 * @returns 验证后的配置数组
 * @throws 如果配置无效
 */
export function validateConfig(config: unknown): SourceConfig[] {
  try {
    return SourcesConfigSchema.parse(config) as SourceConfig[];
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `配置验证失败: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw error;
  }
}

/**
 * 从文件路径加载并验证配置
 * @param filePath - 配置文件路径
 * @returns 验证后的配置数组
 */
export async function validateConfigFile(
  filePath: string
): Promise<SourceConfig[]> {
  try {
    const config = await import(filePath, { assert: { type: "json" } });
    return validateConfig(config.default);
  } catch (error) {
    throw new Error(`无法加载配置文件 ${filePath}: ${error}`);
  }
}

