/**
 * 模块名：Crawler Types
 * 职责：定义爬虫模块相关类型
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { ISODate, ContentType } from "./common.js";
import type { AuthConfig } from "./service.js";

export interface CrawlTask {
  url: string;
  sourceId: string;
  priority?: number;
  fetchedAt?: ISODate;
  /** 认证配置（可选），用于需要登录的网站 */
  auth?: AuthConfig;
}

export interface CrawlResult {
  url: string;
  html?: string;
  buffer?: Buffer;
  contentType?: ContentType;
  status: number;
  fetchedAt: ISODate;
  error?: string;
}

