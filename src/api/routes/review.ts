/**
 * Review 路由
 * 内容审查：GET/POST/PUT /api/reviews*
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { logger } from "../../utils/logger.js";
import type { ReviewDTO, ReviewStatus, ApiResp } from "../../gui/types/common.js";
import { listReviews, getReview, updateReviewStatus, batchUpdateReviewStatus, addChunk } from "../store.js";
import { chunkDocument } from "../../chunkers/text-chunker.js";
import type { ExtractedDocument } from "../../types/extractor.js";
import type { DocumentChunk } from "../../types/chunker.js";

/**
 * 将 ReviewDTO 转换为 ExtractedDocument
 */
function reviewToExtractedDocument(review: ReviewDTO): ExtractedDocument {
  return {
    title: review.title,
    url: review.url,
    content: review.content,
    lang: review.lang,
    sourceId: review.sourceId,
    version: review.version,
    metadata: review.metadata,
  };
}

export async function reviewRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // GET /api/reviews
  app.get<{
    Querystring: {
      status?: ReviewStatus;
      sourceId?: string;
      page?: number;
      pageSize?: number;
    };
  }>("/reviews", async (request, reply) => {
    try {
      const { status = "pending", sourceId, page = 1, pageSize = 50 } = request.query;
      const maxPageSize = Math.min(Number(pageSize), 200);

      const result = listReviews({
        status,
        sourceId,
        page: Number(page),
        pageSize: maxPageSize,
      });

      const response: ApiResp<{
        items: ReviewDTO[];
        page: number;
        pageSize: number;
        total: number;
      }> = {
        success: true,
        data: result,
      };
      return response;
    } catch (error) {
      logger.error("获取审查列表失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{
        items: ReviewDTO[];
        page: number;
        pageSize: number;
        total: number;
      }>;
    }
  });

  // GET /api/reviews/:id
  app.get<{ Params: { id: string } }>("/reviews/:id", async (request, reply) => {
    try {
      const { id } = request.params;
      const review = getReview(id);

      if (!review) {
        reply.code(404);
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "审查文档不存在" },
        } as ApiResp<ReviewDTO>;
      }

      return { success: true, data: review } as ApiResp<ReviewDTO>;
    } catch (error) {
      logger.error("获取审查文档失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<ReviewDTO>;
    }
  });

  // POST /api/reviews/:id/approve
  app.post<{ Params: { id: string } }>("/reviews/:id/approve", async (request, reply) => {
    try {
      const { id } = request.params;
      const review = getReview(id);

      if (!review) {
        reply.code(404);
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "审查文档不存在" },
        } as ApiResp<{ approved: boolean }>;
      }

      // 记录当前状态用于调试
      logger.debug(`批准审查文档: ${id}`, { currentStatus: review.status });

      if (review.status !== "pending") {
        logger.warn(`尝试批准非待审查文档: ${id}`, { currentStatus: review.status });
        reply.code(400);
        return {
          success: false,
          error: { 
            code: "INVALID_STATUS", 
            message: `只能批准待审查的文档，当前状态: ${review.status}` 
          },
        } as ApiResp<{ approved: boolean }>;
      }

      // 更新状态为已批准（在分片和上传之前）
      const updateSuccess = updateReviewStatus(id, "approved");
      if (!updateSuccess) {
        logger.error(`更新审查文档状态失败: ${id}`);
        reply.code(500);
        return {
          success: false,
          error: {
            code: "UPDATE_FAILED",
            message: "更新审查文档状态失败",
          },
        } as ApiResp<{ approved: boolean }>;
      }

      // 重新获取更新后的审查文档（确保使用最新状态）
      const updatedReview = getReview(id);
      if (!updatedReview) {
        logger.error(`获取更新后的审查文档失败: ${id}`);
        reply.code(500);
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "获取更新后的审查文档失败",
          },
        } as ApiResp<{ approved: boolean }>;
      }

      // 进行分片并存储到 chunksStore（不直接上传）
      try {
        const doc = reviewToExtractedDocument(updatedReview);
        const chunks = chunkDocument(doc);

        if (chunks.length > 0) {
          // 将分片存储到 chunksStore，等待在上传菜单中手动上传
          let storedCount = 0;
          for (const chunk of chunks) {
            const chunkDTO = addChunk({
              sourceId: updatedReview.sourceId,
              title: updatedReview.title,
              url: updatedReview.url,
              content: chunk.content,
              version: updatedReview.version,
              lang: chunk.lang,
              meta: {
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                contentHash: chunk.contentHash,
              },
              status: "pending",
            });
            if (chunkDTO) {
              storedCount++;
            }
          }

          logger.info(`审查文档已批准，分片已存储到上传队列`, {
            reviewId: id,
            chunksCount: chunks.length,
            storedCount,
          });
        } else {
          logger.warn(`审查文档批准但无分片: ${id}`);
        }

        return { success: true, data: { approved: true } } as ApiResp<{ approved: boolean }>;
      } catch (error) {
        logger.error(`批准文档后存储分片失败: ${id}`, { error });
        // 即使存储失败，也标记为已批准（状态已经更新）
        return { success: true, data: { approved: true } } as ApiResp<{ approved: boolean }>;
      }
    } catch (error) {
      logger.error("批准审查文档失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ approved: boolean }>;
    }
  });

  // POST /api/reviews/:id/reject
  app.post<{ Params: { id: string } }>("/reviews/:id/reject", async (request, reply) => {
    try {
      const { id } = request.params;
      const review = getReview(id);

      if (!review) {
        reply.code(404);
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "审查文档不存在" },
        } as ApiResp<{ rejected: boolean }>;
      }

      if (review.status !== "pending") {
        reply.code(400);
        return {
          success: false,
          error: { code: "INVALID_STATUS", message: "只能拒绝待审查的文档" },
        } as ApiResp<{ rejected: boolean }>;
      }

      updateReviewStatus(id, "rejected");

      return { success: true, data: { rejected: true } } as ApiResp<{ rejected: boolean }>;
    } catch (error) {
      logger.error("拒绝审查文档失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ rejected: boolean }>;
    }
  });

  // POST /api/reviews/batch-approve
  app.post<{
    Body: { ids: string[] };
  }>("/reviews/batch-approve", async (request, reply) => {
    try {
      const { ids } = request.body;

      if (!ids || ids.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: { code: "INVALID_REQUEST", message: "ids 不能为空" },
        } as ApiResp<{ approved: number }>;
      }

      let approvedCount = 0;
      let totalStoredCount = 0;

      // 批量批准并存储分片到 chunksStore（不直接上传）
      for (const id of ids) {
        const review = getReview(id);
        if (review && review.status === "pending") {
          updateReviewStatus(id, "approved");
          approvedCount++;

          // 转换为文档并分片
          const doc = reviewToExtractedDocument(review);
          const chunks = chunkDocument(doc);

          // 将分片存储到 chunksStore，等待在上传菜单中手动上传
          for (const chunk of chunks) {
            const chunkDTO = addChunk({
              sourceId: review.sourceId,
              title: review.title,
              url: review.url,
              content: chunk.content,
              version: review.version,
              lang: chunk.lang,
              meta: {
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                contentHash: chunk.contentHash,
              },
              status: "pending",
            });
            if (chunkDTO) {
              totalStoredCount++;
            }
          }
        }
      }

      logger.info(`批量批准完成，分片已存储到上传队列`, {
        approvedCount,
        totalStoredCount,
      });

      return { success: true, data: { approved: approvedCount } } as ApiResp<{ approved: number }>;
    } catch (error) {
      logger.error("批量批准审查文档失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ approved: number }>;
    }
  });

  // POST /api/reviews/batch-reject
  app.post<{
    Body: { ids: string[] };
  }>("/reviews/batch-reject", async (request, reply) => {
    try {
      const { ids } = request.body;

      if (!ids || ids.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: { code: "INVALID_REQUEST", message: "ids 不能为空" },
        } as ApiResp<{ rejected: number }>;
      }

      const rejectedCount = batchUpdateReviewStatus(ids, "rejected");

      return { success: true, data: { rejected: rejectedCount } } as ApiResp<{ rejected: number }>;
    } catch (error) {
      logger.error("批量拒绝审查文档失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{ rejected: number }>;
    }
  });
}

