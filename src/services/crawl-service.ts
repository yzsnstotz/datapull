/**
 * 模块名：Crawl Service
 * 职责：协调爬取、提取、分片、上传全流程
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import { randomUUID } from "crypto";
import type { SourceConfig } from "../types/service.js";
import type { CrawlTask, CrawlResult } from "../types/crawler.js";
import type { ExtractedDocument } from "../types/extractor.js";
import type { DocumentChunk } from "../types/chunker.js";
import { startScheduler } from "../crawler/scheduler.js";
import { discoverLinks } from "../crawler/discoverer.js";
import { HtmlExtractor } from "../extractors/html-extractor.js";
import { PdfExtractor } from "../extractors/pdf-extractor.js";
import { chunkDocument } from "../chunkers/text-chunker.js";
import { IngestService } from "./ingest-service.js";
import { logger } from "../utils/logger.js";
import { addReview } from "../api/store.js";

/**
 * 爬取服务
 */
export class CrawlService {
  private ingestService: IngestService;
  private htmlExtractor: HtmlExtractor;
  private pdfExtractor: PdfExtractor;

  constructor() {
    this.ingestService = new IngestService();
    this.htmlExtractor = new HtmlExtractor();
    this.pdfExtractor = new PdfExtractor();
  }

  /**
   * 启动爬取任务
   * @param sourceId - 源 ID
   * @param config - 源配置
   * @returns 处理结果
   */
  async startCrawl(sourceId: string, config: SourceConfig): Promise<void> {
    logger.info(`开始爬取任务: ${sourceId}`, {
      seeds: config.seeds.length,
      maxDepth: config.maxDepth,
      maxPages: config.maxPages,
    });

    // 1. 构建初始任务队列
    const tasks: CrawlTask[] = config.seeds.map((url) => ({
      url,
      sourceId,
      priority: 1,
      auth: config.auth, // 传递认证配置
    }));

    const visitedUrls = new Set<string>(config.seeds);
    const allResults: CrawlResult[] = [];
    const allDocuments: ExtractedDocument[] = [];
    let depth = 0;

    // 2. 按深度爬取
    while (tasks.length > 0 && depth <= config.maxDepth && allResults.length < config.maxPages) {
      const currentTasks = tasks.splice(0, Math.min(tasks.length, config.maxPages - allResults.length));
      
      logger.info(`处理深度 ${depth}，任务数: ${currentTasks.length}`);

      // 3. 执行爬取
      const results = await startScheduler(currentTasks);

      for (const result of results) {
        if (result.error) {
          logger.warn(`爬取失败: ${result.url}`, { error: result.error });
          continue;
        }

        allResults.push(result);

        // 4. 提取内容
        try {
          const doc = await this.extractDocument(result, config);
          if (doc && doc.content.length >= 100) {
            allDocuments.push(doc);

            // 4.1. 保存到审查队列（分片之前）
            addReview({
              sourceId: doc.sourceId,
              title: doc.title,
              url: doc.url,
              content: doc.content,
              lang: doc.lang,
              version: doc.version,
              metadata: doc.metadata,
            });

            // 5. 发现新链接（如果未达到最大深度）
            if (depth < config.maxDepth && result.html) {
              const newLinks = discoverLinks(result.html, result.url, config);
              for (const link of newLinks) {
                if (!visitedUrls.has(link) && visitedUrls.size < config.maxPages) {
                  visitedUrls.add(link);
                  tasks.push({
                    url: link,
                    sourceId,
                    priority: depth + 1,
                    auth: config.auth, // 传递认证配置
                  });
                }
              }
            }
          }
        } catch (error) {
          logger.error(`提取失败: ${result.url}`, { error });
        }
      }

      depth++;
    }

    logger.info(`爬取完成`, {
      totalResults: allResults.length,
      totalDocuments: allDocuments.length,
    });

    // 注意：文档已保存到审查队列，等待用户审查后再进行分片和上传
    logger.info(`文档已保存到审查队列，等待审查`, {
      totalDocuments: allDocuments.length,
    });
  }

  /**
   * 提取文档
   * @param result - 爬取结果
   * @param config - 源配置
   * @returns 提取的文档
   */
  private async extractDocument(
    result: CrawlResult,
    config: SourceConfig
  ): Promise<ExtractedDocument | null> {
    if (result.html) {
      return await this.htmlExtractor.extract(
        result.url,
        result.html,
        config.id,
        config.version
      );
    } else if (result.buffer) {
      return await this.pdfExtractor.extract(
        result.url,
        result.buffer,
        config.id,
        config.version
      );
    }

    return null;
  }
}

