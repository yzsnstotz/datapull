/**
 * 模块名：Extractor Types
 * 职责：定义提取器模块相关类型
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { LangCode } from "./common.js";

export interface ExtractedDocument {
  title: string;
  url: string;
  content: string;
  lang: LangCode;
  sourceId: string;
  version: string;
  metadata?: Record<string, string>;
}

