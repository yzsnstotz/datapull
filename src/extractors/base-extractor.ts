/**
 * 模块名：Base Extractor
 * 职责：定义提取器通用接口
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { ExtractedDocument } from "../types/extractor.js";

/**
 * 提取器基础接口
 */
export interface BaseExtractor {
  /**
   * 判断是否可以处理该内容类型
   * @param contentType - 内容类型
   * @returns 是否可以处理
   */
  canHandle(contentType: string): boolean;

  /**
   * 提取文档内容
   * @param url - 文档 URL
   * @param rawData - 原始数据（字符串或 Buffer）
   * @param sourceId - 源 ID
   * @param version - 版本号
   * @returns 提取的文档
   */
  extract(
    url: string,
    rawData: string | Buffer,
    sourceId: string,
    version: string
  ): Promise<ExtractedDocument>;
}

