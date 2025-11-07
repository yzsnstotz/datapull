/**
 * API 状态存储
 * 管理任务状态、分片记录等
 */

import type { TaskStatusDTO, ChunkDTO, ChunkStatus, ReviewDTO, ReviewStatus } from "../gui/types/common.js";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");

// 任务状态
let taskStatus: TaskStatusDTO = {
  status: "idle",
  runningSources: [],
};

// 分片存储（内存）
const chunksStore = new Map<string, ChunkDTO>();

// 审查文档存储（内存）
const reviewsStore = new Map<string, ReviewDTO>();

// 确保数据目录存在
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    logger.error(`创建数据目录失败`, { error });
  }
}

// 保存审查数据到文件
async function saveReviewsToFile(): Promise<void> {
  try {
    await ensureDataDir();
    const reviews = Array.from(reviewsStore.values());
    const tempFile = REVIEWS_FILE + ".tmp";
    await fs.writeFile(tempFile, JSON.stringify(reviews, null, 2), "utf-8");
    // 原子性替换：先写临时文件，再重命名
    await fs.rename(tempFile, REVIEWS_FILE);
  } catch (error) {
    logger.error(`保存审查数据失败`, { error });
  }
}

// 从文件加载审查数据
export async function loadReviewsFromFile(): Promise<void> {
  try {
    const content = await fs.readFile(REVIEWS_FILE, "utf-8");
    const reviews: ReviewDTO[] = JSON.parse(content);
    reviewsStore.clear();
    for (const review of reviews) {
      reviewsStore.set(review.id, review);
    }
    logger.info(`加载审查数据成功`, { count: reviews.length });
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // 文件不存在，这是正常的（首次运行）
      logger.debug("审查数据文件不存在，使用空数据");
    } else {
      logger.error(`加载审查数据失败`, { error });
    }
  }
}

/**
 * 获取任务状态
 */
export function getTaskStatus(): TaskStatusDTO {
  return { ...taskStatus };
}

/**
 * 更新任务状态
 */
export function updateTaskStatus(updates: Partial<TaskStatusDTO>): void {
  taskStatus = { ...taskStatus, ...updates };
}

/**
 * 根据 contentHash 查找分片
 */
export function findChunkByContentHash(contentHash: string): ChunkDTO | undefined {
  for (const chunk of chunksStore.values()) {
    if (chunk.meta.contentHash === contentHash) {
      return chunk;
    }
  }
  return undefined;
}

/**
 * 添加分片
 * 如果已存在相同 contentHash 的分片，则返回已存在的分片，不重复添加
 */
export function addChunk(chunk: Omit<ChunkDTO, "id" | "createdAt" | "updatedAt">): ChunkDTO {
  // 检查是否已存在相同 contentHash 的分片
  const existingChunk = findChunkByContentHash(chunk.meta.contentHash);
  if (existingChunk) {
    logger.debug(`分片已存在，跳过重复添加`, {
      contentHash: chunk.meta.contentHash,
      existingChunkId: existingChunk.id,
    });
    return existingChunk;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const chunkDTO: ChunkDTO = {
    ...chunk,
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  chunksStore.set(id, chunkDTO);
  return chunkDTO;
}

/**
 * 获取分片
 */
export function getChunk(id: string): ChunkDTO | undefined {
  return chunksStore.get(id);
}

/**
 * 更新分片状态
 */
export function updateChunkStatus(id: string, status: ChunkStatus, errorMessage?: string): boolean {
  const chunk = chunksStore.get(id);
  if (!chunk) return false;
  
  chunk.status = status;
  chunk.updatedAt = new Date().toISOString();
  if (errorMessage) {
    chunk.errorMessage = errorMessage;
  }
  chunksStore.set(id, chunk);
  return true;
}

/**
 * 列出分片
 */
export function listChunks(filters: {
  status?: ChunkStatus;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}): { items: ChunkDTO[]; total: number; page: number; pageSize: number } {
  let items = Array.from(chunksStore.values());

  // 过滤
  if (filters.status) {
    items = items.filter((c) => c.status === filters.status);
  }
  if (filters.sourceId) {
    items = items.filter((c) => c.sourceId === filters.sourceId);
  }

  const total = items.length;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  items = items.slice(start, end);

  return { items, total, page, pageSize };
}

/**
 * 清空分片（用于测试）
 */
export function clearChunks(): void {
  chunksStore.clear();
}

/**
 * 添加审查文档
 */
export function addReview(review: Omit<ReviewDTO, "id" | "createdAt" | "updatedAt">): ReviewDTO {
  const id = randomUUID();
  const now = new Date().toISOString();
  const reviewDTO: ReviewDTO = {
    ...review,
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  reviewsStore.set(id, reviewDTO);
  // 异步保存到文件（不阻塞）
  saveReviewsToFile().catch((error) => {
    logger.error("保存审查数据失败", { error });
  });
  return reviewDTO;
}

/**
 * 获取审查文档
 */
export function getReview(id: string): ReviewDTO | undefined {
  const review = reviewsStore.get(id);
  if (review) {
    // 返回副本，避免外部修改
    return { ...review };
  }
  return undefined;
}

/**
 * 更新审查文档状态
 */
export function updateReviewStatus(id: string, status: ReviewStatus): boolean {
  const review = reviewsStore.get(id);
  if (!review) return false;
  
  review.status = status;
  review.updatedAt = new Date().toISOString();
  reviewsStore.set(id, review);
  // 异步保存到文件（不阻塞）
  saveReviewsToFile().catch((error) => {
    logger.error("保存审查数据失败", { error });
  });
  return true;
}

/**
 * 列出审查文档
 */
export function listReviews(filters: {
  status?: ReviewStatus;
  sourceId?: string;
  page?: number;
  pageSize?: number;
}): { items: ReviewDTO[]; total: number; page: number; pageSize: number } {
  let items = Array.from(reviewsStore.values());

  // 过滤
  if (filters.status) {
    items = items.filter((r) => r.status === filters.status);
  }
  if (filters.sourceId) {
    items = items.filter((r) => r.sourceId === filters.sourceId);
  }

  const total = items.length;
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  // 按创建时间倒序排列
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  items = items.slice(start, end);

  return { items, total, page, pageSize };
}

/**
 * 批量更新审查文档状态
 */
export function batchUpdateReviewStatus(ids: string[], status: ReviewStatus): number {
  let count = 0;
  for (const id of ids) {
    if (updateReviewStatus(id, status)) {
      count++;
    }
  }
  // 批量操作后保存一次即可
  saveReviewsToFile().catch((error) => {
    logger.error("保存审查数据失败", { error });
  });
  return count;
}

/**
 * 清空审查文档（用于测试）
 */
export function clearReviews(): void {
  reviewsStore.clear();
}

