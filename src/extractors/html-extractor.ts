/**
 * 模块名：HTML Extractor
 * 职责：从 HTML 中提取正文、标题，去除脚注、广告
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import * as cheerio from "cheerio";
import type { ExtractedDocument } from "../types/extractor.js";
import type { BaseExtractor } from "./base-extractor.js";
import { logger } from "../utils/logger.js";

/**
 * HTML 提取器实现
 */
export class HtmlExtractor implements BaseExtractor {
  canHandle(contentType: string): boolean {
    return (
      contentType.includes("text/html") ||
      contentType.includes("text/xhtml") ||
      contentType === "html"
    );
  }

  async extract(
    url: string,
    rawData: string | Buffer,
    sourceId: string,
    version: string
  ): Promise<ExtractedDocument> {
    const html = typeof rawData === "string" ? rawData : rawData.toString("utf-8");
    const $ = cheerio.load(html);

    // 移除不需要的元素
    $("script, style, nav, footer, header, aside, .ad, .advertisement, .ads").remove();

    // 提取标题
    let title =
      $("title").first().text() ||
      $("h1").first().text() ||
      $("meta[property='og:title']").attr("content") ||
      "";

    // 尝试从主要内容区域提取
    const mainContent =
      $("main, article, .content, .main-content, #content, .post-content").first();

    let content = "";
    if (mainContent.length > 0) {
      content = mainContent.text();
    } else {
      // 如果没有找到主要内容区域，提取 body 文本
      $("body").find("script, style, nav, footer, header, aside").remove();
      content = $("body").text();
    }

    // 清理内容
    content = this.cleanContent(content);

    // 检测语言（简单检测）
    const lang = this.detectLanguage(content);

    if (content.length < 100) {
      logger.warn(`提取内容过短: ${url}`, { length: content.length });
    }

    return {
      title: title.trim() || url,
      url,
      content: content.trim(),
      lang,
      sourceId,
      version,
      metadata: {
        extractedAt: new Date().toISOString(),
        contentType: "html",
      },
    };
  }

  /**
   * 清理内容：去除重复空行、HTML实体、控制符
   */
  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, " ") // 合并多个空白字符
      .replace(/\n\s*\n\s*\n/g, "\n\n") // 去除多余空行
      .replace(/[\x00-\x1F\x7F]/g, "") // 去除控制字符
      .trim();
  }

  /**
   * 简单语言检测
   */
  private detectLanguage(content: string): "ja" | "zh" | "en" {
    // 检测日语字符
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(content)) {
      // 进一步区分中文和日文
      if (/[\u4E00-\u9FAF]/.test(content) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(content)) {
        return "zh";
      }
      return "ja";
    }
    return "en";
  }
}

