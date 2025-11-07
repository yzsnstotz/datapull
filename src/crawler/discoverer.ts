/**
 * 模块名：Discoverer
 * 职责：从 HTML 中发现新的合法链接
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import * as cheerio from "cheerio";
import type { SourceConfig } from "../types/service.js";
import { logger } from "../utils/logger.js";

/**
 * 从 HTML 中发现新的合法链接
 * @param html - HTML 内容
 * @param baseUrl - 基础 URL
 * @param config - 源配置
 * @returns 发现的链接数组
 */
export function discoverLinks(
  html: string,
  baseUrl: string,
  config: SourceConfig
): string[] {
  try {
    const $ = cheerio.load(html);
    const links = new Set<string>();
    const baseUrlObj = new URL(baseUrl);

    // 提取所有链接
    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      try {
        // 解析相对路径和绝对路径
        const absoluteUrl = new URL(href, baseUrl).href;

        // 检查是否在同一域名
        const urlObj = new URL(absoluteUrl);
        if (urlObj.hostname !== baseUrlObj.hostname) {
          return;
        }

        // 检查排除规则
        if (config.exclude && config.exclude.length > 0) {
          const shouldExclude = config.exclude.some((pattern) =>
            absoluteUrl.includes(pattern)
          );
          if (shouldExclude) {
            return;
          }
        }

        // 检查包含规则
        if (config.include && config.include.length > 0) {
          const shouldInclude = config.include.some((pattern) =>
            absoluteUrl.includes(pattern)
          );
          if (!shouldInclude) {
            return;
          }
        }

        // 过滤掉锚点链接
        if (absoluteUrl.includes("#")) {
          return;
        }

        // 只保留 HTTP/HTTPS 链接
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          links.add(absoluteUrl);
        }
      } catch (error) {
        // 忽略无效 URL
        logger.debug(`无效链接: ${href}`, { error });
      }
    });

    return Array.from(links);
  } catch (error) {
    logger.error(`链接发现失败: ${baseUrl}`, { error });
    return [];
  }
}

