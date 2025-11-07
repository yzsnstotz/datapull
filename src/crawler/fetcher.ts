/**
 * 模块名：Fetcher
 * 职责：发起 HTTP 请求，识别 Content-Type，校验 robots.txt
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import axios, { AxiosError } from "axios";
import RobotsParser from "robots-parser";
import type { CrawlTask, CrawlResult } from "../types/crawler.js";
import type { AuthConfig } from "../types/service.js";
import { logger } from "../utils/logger.js";
import { detectEncoding } from "../utils/encoder.js";

const DEFAULT_USER_AGENT =
  "Datapull/1.0 (+https://github.com/datapull/crawler)";

/**
 * 检查目标网站是否允许爬取
 * @param url - 目标 URL
 * @returns 是否允许爬取
 */
export async function checkRobots(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

    const response = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });

    const robots = RobotsParser(robotsUrl, response.data);
    return robots.isAllowed(url, DEFAULT_USER_AGENT);
  } catch (error) {
    // 如果 robots.txt 不存在或无法访问，默认允许
    logger.debug(`无法获取 robots.txt: ${url}`, { error });
    return true;
  }
}

/**
 * 发起 HTTP 请求并返回 HTML 或 PDF 内容
 * @param task - 爬取任务
 * @returns 爬取结果
 */
export async function fetchPage(task: CrawlTask): Promise<CrawlResult> {
  const { url } = task;
  const fetchedAt = new Date().toISOString();

  try {
    // 检查 robots.txt
    const isAllowed = await checkRobots(url);
    if (!isAllowed) {
      return {
        url,
        status: 403,
        fetchedAt,
        error: "robots.txt disallows crawling",
      };
    }

    // 构建请求头
    const headers: Record<string, string> = {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/pdf,*/*",
    };

    // 添加认证信息（如果提供）
    if (task.auth) {
      if (task.auth.cookies) {
        headers["Cookie"] = task.auth.cookies;
      }
      if (task.auth.authorization) {
        headers["Authorization"] = task.auth.authorization;
      }
      if (task.auth.headers) {
        Object.assign(headers, task.auth.headers);
      }
    }

    // 发起请求
    const response = await axios.get(url, {
      timeout: 30000,
      headers,
      responseType: "arraybuffer",
      maxRedirects: 5,
    });

    const contentType = response.headers["content-type"] || "";
    let contentTypeEnum: "html" | "pdf" | "unknown" = "unknown";

    if (contentType.includes("text/html") || contentType.includes("text/xhtml")) {
      contentTypeEnum = "html";
      const buffer = Buffer.from(response.data);
      const html = detectEncoding(buffer);
      return {
        url,
        html,
        contentType: contentTypeEnum,
        status: response.status,
        fetchedAt,
      };
    } else if (contentType.includes("application/pdf")) {
      contentTypeEnum = "pdf";
      return {
        url,
        buffer: Buffer.from(response.data),
        contentType: contentTypeEnum,
        status: response.status,
        fetchedAt,
      };
    } else {
      // 尝试根据 URL 扩展名判断
      if (url.toLowerCase().endsWith(".pdf")) {
        contentTypeEnum = "pdf";
        return {
          url,
          buffer: Buffer.from(response.data),
          contentType: contentTypeEnum,
          status: response.status,
          fetchedAt,
        };
      }

      // 默认尝试作为 HTML 处理
      const buffer = Buffer.from(response.data);
      const html = detectEncoding(buffer);
      return {
        url,
        html,
        contentType: "html",
        status: response.status,
        fetchedAt,
      };
    }
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status || 500;
    const errorMessage = axiosError.message || "Unknown error";

    logger.error(`抓取失败: ${url}`, { error: errorMessage, status });

    return {
      url,
      status,
      fetchedAt,
      error: errorMessage,
    };
  }
}

