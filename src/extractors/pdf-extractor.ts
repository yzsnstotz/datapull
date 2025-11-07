/**
 * 模块名：PDF Extractor
 * 职责：从 PDF 中提取文本内容
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import pdfParse from "pdf-parse";
import type { ExtractedDocument } from "../types/extractor.js";
import type { BaseExtractor } from "./base-extractor.js";
import { logger } from "../utils/logger.js";
import { detectEncoding } from "../utils/encoder.js";

/**
 * PDF 提取器实现
 */
export class PdfExtractor implements BaseExtractor {
  canHandle(contentType: string): boolean {
    return (
      contentType.includes("application/pdf") ||
      contentType === "pdf"
    );
  }

  async extract(
    url: string,
    rawData: string | Buffer,
    sourceId: string,
    version: string
  ): Promise<ExtractedDocument> {
    const buffer = rawData instanceof Buffer ? rawData : Buffer.from(rawData);

    try {
      const data = await pdfParse(buffer);

      // 提取标题（从元数据或第一行）
      let title = data.info?.Title || "";
      if (!title && data.text) {
        const firstLine = data.text.split("\n")[0]?.trim();
        if (firstLine && firstLine.length < 200) {
          title = firstLine;
        }
      }

      // 提取文本内容
      let content = data.text || "";

      // 清理内容
      content = this.cleanContent(content);

      // 检测语言
      const lang = this.detectLanguage(content);

      if (content.length < 100) {
        logger.warn(`PDF 提取内容过短: ${url}`, { length: content.length });
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
          contentType: "pdf",
          pages: data.numpages,
        },
      };
    } catch (error) {
      logger.error(`PDF 提取失败: ${url}`, { error });
      throw new Error(`PDF 提取失败: ${error}`);
    }
  }

  /**
   * 清理内容：去除重复空行、控制符
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

