/**
 * 模块名：Text Chunker
 * 职责：实现多语言文本分片策略
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import type { DocumentChunk, LangCode } from "../types/chunker.js";
import type { ExtractedDocument } from "../types/extractor.js";
import type { ChunkStrategy } from "./chunk-strategy.js";
import { sha256 } from "../utils/hasher.js";
import { logger } from "../utils/logger.js";

const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 800;
const TARGET_CHUNK_SIZE = 600;
const OVERLAP_SIZE = 50;

/**
 * 日语分片策略：基于句号（。！？）和换行符
 */
class JaChunkStrategy implements ChunkStrategy {
  split(
    text: string,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk[] {
    // 按句号、感叹号、问号分割
    const segments = text.split(/(?<=[。！？\n])/);
    const chunks: DocumentChunk[] = [];
    let current = "";
    let index = 0;

    for (const seg of segments) {
      const trimmedSeg = seg.trim();
      if (!trimmedSeg) continue;

      if ((current + trimmedSeg).length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
        // 保存当前分片
        chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
        index++;
        // 保留重叠部分
        const overlap = current.slice(-OVERLAP_SIZE);
        current = overlap + trimmedSeg;
      } else {
        current += trimmedSeg;
      }
    }

    // 处理最后一个分片
    if (current.length >= MIN_CHUNK_SIZE) {
      chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
    } else if (chunks.length > 0) {
      // 如果最后一个分片太短，合并到前一个
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += current;
      lastChunk.contentHash = sha256(lastChunk.content);
    }

    // 更新 totalChunks
    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  private createChunk(
    content: string,
    index: number,
    totalChunks: number,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk {
    return {
      chunkIndex: index + 1,
      totalChunks,
      content: content.trim(),
      lang,
      contentHash: sha256(content.trim()),
      parentUrl,
      sourceId,
    };
  }
}

/**
 * 中文分片策略：基于换行符和句号
 */
class ZhChunkStrategy implements ChunkStrategy {
  split(
    text: string,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk[] {
    // 按换行符和句号分割
    const segments = text.split(/(?<=[。\n])/);
    const chunks: DocumentChunk[] = [];
    let current = "";
    let index = 0;

    for (const seg of segments) {
      const trimmedSeg = seg.trim();
      if (!trimmedSeg) continue;

      if ((current + trimmedSeg).length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
        chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
        index++;
        const overlap = current.slice(-OVERLAP_SIZE);
        current = overlap + trimmedSeg;
      } else {
        current += trimmedSeg;
      }
    }

    if (current.length >= MIN_CHUNK_SIZE) {
      chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
    } else if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += current;
      lastChunk.contentHash = sha256(lastChunk.content);
    }

    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  private createChunk(
    content: string,
    index: number,
    totalChunks: number,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk {
    return {
      chunkIndex: index + 1,
      totalChunks,
      content: content.trim(),
      lang,
      contentHash: sha256(content.trim()),
      parentUrl,
      sourceId,
    };
  }
}

/**
 * 英文分片策略：基于句子断句
 */
class EnChunkStrategy implements ChunkStrategy {
  split(
    text: string,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk[] {
    // 按句号、问号、感叹号和换行符分割
    const segments = text.split(/(?<=[.!?\n])/);
    const chunks: DocumentChunk[] = [];
    let current = "";
    let index = 0;

    for (const seg of segments) {
      const trimmedSeg = seg.trim();
      if (!trimmedSeg) continue;

      if ((current + trimmedSeg).length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
        chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
        index++;
        const overlap = current.slice(-OVERLAP_SIZE);
        current = overlap + trimmedSeg;
      } else {
        current += trimmedSeg;
      }
    }

    if (current.length >= MIN_CHUNK_SIZE) {
      chunks.push(this.createChunk(current, index, chunks.length + 1, lang, parentUrl, sourceId));
    } else if (chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      lastChunk.content += current;
      lastChunk.contentHash = sha256(lastChunk.content);
    }

    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  private createChunk(
    content: string,
    index: number,
    totalChunks: number,
    lang: LangCode,
    parentUrl: string,
    sourceId: string
  ): DocumentChunk {
    return {
      chunkIndex: index + 1,
      totalChunks,
      content: content.trim(),
      lang,
      contentHash: sha256(content.trim()),
      parentUrl,
      sourceId,
    };
  }
}

// 分片策略映射
const STRATEGIES: Record<LangCode, ChunkStrategy> = {
  ja: new JaChunkStrategy(),
  zh: new ZhChunkStrategy(),
  en: new EnChunkStrategy(),
};

/**
 * 将文档分片
 * @param doc - 提取的文档
 * @returns 分片数组
 */
export function chunkDocument(doc: ExtractedDocument): DocumentChunk[] {
  const { content, lang, url, sourceId } = doc;

  if (content.length < MIN_CHUNK_SIZE) {
    logger.warn(`内容过短，无法分片: ${url}`, { length: content.length });
    return [];
  }

  const strategy = STRATEGIES[lang];
  if (!strategy) {
    logger.warn(`未找到语言策略: ${lang}，使用默认策略`);
    return STRATEGIES.en.split(content, lang, url, sourceId);
  }

  const chunks = strategy.split(content, lang, url, sourceId);

  logger.debug(`文档分片完成: ${url}`, {
    totalChunks: chunks.length,
    lang,
  });

  return chunks;
}

