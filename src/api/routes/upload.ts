/**
 * Upload 路由
 * 上传中心：GET /api/chunks, POST /api/upload/batch
 */

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { logger } from "../../utils/logger.js";
import type { ChunkDTO, ChunkStatus, ApiResp } from "../../gui/types/common.js";
import { listChunks, getChunk, updateChunkStatus, findChunkByContentHash } from "../store.js";
import { IngestService } from "../../services/ingest-service.js";
import type { DocumentChunk } from "../../types/chunker.js";

const ingestService = new IngestService();

/**
 * 将 ChunkDTO 转换为 DocumentChunk
 */
function chunkDTOToDocumentChunk(chunk: ChunkDTO): DocumentChunk {
  return {
    chunkIndex: chunk.meta.chunkIndex,
    totalChunks: chunk.meta.totalChunks,
    content: chunk.content,
    lang: chunk.lang,
    contentHash: chunk.meta.contentHash,
    parentUrl: chunk.url,
    sourceId: chunk.sourceId,
  };
}

export async function uploadRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // GET /api/chunks
  app.get<{
    Querystring: {
      status?: ChunkStatus;
      sourceId?: string;
      page?: number;
      pageSize?: number;
    };
  }>("/chunks", async (request, reply) => {
    try {
      const { status = "pending", sourceId, page = 1, pageSize = 50 } = request.query;
      const maxPageSize = Math.min(pageSize, 200);

      const result = listChunks({
        status,
        sourceId,
        page: Number(page),
        pageSize: maxPageSize,
      });

      const response: ApiResp<{
        items: ChunkDTO[];
        page: number;
        pageSize: number;
        total: number;
      }> = {
        success: true,
        data: result,
      };
      return response;
    } catch (error) {
      logger.error("获取分片列表失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{
        items: ChunkDTO[];
        page: number;
        pageSize: number;
        total: number;
      }>;
    }
  });

  // POST /api/upload/batch
  app.post<{
    Body: {
      chunkIds: string[];
      mode?: "auto" | "manual";
    };
  }>("/upload/batch", async (request, reply) => {
    try {
      const { chunkIds, mode = "manual" } = request.body;

      if (!chunkIds || chunkIds.length === 0) {
        reply.code(400);
        return {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "chunkIds 不能为空",
          },
        } as ApiResp<{
          operationId: string;
          processed: number;
          failed: number;
          results: Array<{
            chunkId: string;
            status: "success" | "failed" | "duplicate";
            error?: { code: string; message: string };
          }>;
        }>;
      }

      if (chunkIds.length > 100) {
        reply.code(400);
        return {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "chunkIds 最多 100 个",
          },
        } as ApiResp<{
          operationId: string;
          processed: number;
          failed: number;
          results: Array<{
            chunkId: string;
            status: "success" | "failed" | "duplicate";
            error?: { code: string; message: string };
          }>;
        }>;
      }

      // 获取分片
      const chunks: ChunkDTO[] = [];
      for (const id of chunkIds) {
        const chunk = getChunk(id);
        if (chunk) {
          chunks.push(chunk);
        }
      }

      if (chunks.length === 0) {
        reply.code(404);
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "未找到指定的分片",
          },
        } as ApiResp<{
          operationId: string;
          processed: number;
          failed: number;
          results: Array<{
            chunkId: string;
            status: "success" | "failed" | "duplicate";
            error?: { code: string; message: string };
          }>;
        }>;
      }

      // 检查重复分片（根据 contentHash）
      const chunksToUpload: ChunkDTO[] = [];
      const duplicateChunks: ChunkDTO[] = [];
      
      for (const chunk of chunks) {
        // 检查是否已存在相同 contentHash 且已上传的分片
        const existingChunk = findChunkByContentHash(chunk.meta.contentHash);
        if (existingChunk && existingChunk.status === "uploaded" && existingChunk.id !== chunk.id) {
          duplicateChunks.push(chunk);
          logger.debug(`分片已存在且已上传，跳过重复上传`, {
            chunkId: chunk.id,
            contentHash: chunk.meta.contentHash,
            existingChunkId: existingChunk.id,
          });
        } else {
          chunksToUpload.push(chunk);
        }
      }

      // 更新重复分片的状态
      const results: Array<{
        chunkId: string;
        status: "success" | "failed" | "duplicate";
        error?: { code: string; message: string };
      }> = [];

      for (const chunk of duplicateChunks) {
        updateChunkStatus(chunk.id, "uploaded");
        results.push({
          chunkId: chunk.id,
          status: "duplicate",
          error: {
            code: "DUPLICATE_CHUNK",
            message: `分片编号 ${chunk.meta.contentHash.substring(0, 16)}... 已存在且已上传`,
          },
        });
      }

      // 如果有需要上传的分片，进行批量上传
      if (chunksToUpload.length > 0) {
        logger.info(`准备上传分片`, {
          totalChunks: chunks.length,
          duplicateCount: duplicateChunks.length,
          uploadCount: chunksToUpload.length,
        });

        // 转换为 DocumentChunk
        const documentChunks = chunksToUpload.map(chunkDTOToDocumentChunk);
        const sourceId = chunksToUpload[0].sourceId;
        const version = chunksToUpload[0].version;

        logger.info(`开始调用 IngestService.process`, {
          sourceId,
          version,
          documentChunksCount: documentChunks.length,
        });

        // 批量上传
        try {
          const result = await ingestService.process(sourceId, version, documentChunks);
          
          logger.info(`IngestService.process 完成`, {
            operationId: result.operationId,
            processed: result.processed,
            failed: result.failed,
          });

          // 更新分片状态
          // 这里简化处理，假设所有分片都成功
          // 实际应该根据 DriveQuiz 返回的结果更新状态
          for (const chunk of chunksToUpload) {
            updateChunkStatus(chunk.id, "uploaded");
            results.push({
              chunkId: chunk.id,
              status: "success",
            });
          }

          const response: ApiResp<{
            operationId: string;
            processed: number;
            failed: number;
            results: Array<{
              chunkId: string;
              status: "success" | "failed" | "duplicate";
              error?: { code: string; message: string };
            }>;
          }> = {
            success: true,
            data: {
              operationId: result.operationId,
              processed: result.processed + duplicateChunks.length,
              failed: result.failed,
              results,
            },
          };
          return response;
        } catch (error) {
          logger.error(`IngestService.process 失败`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            sourceId,
            version,
            chunksCount: chunksToUpload.length,
          });

          // 上传失败，更新分片状态
          for (const chunk of chunksToUpload) {
            updateChunkStatus(
              chunk.id,
              "failed",
              error instanceof Error ? error.message : String(error)
            );
            results.push({
              chunkId: chunk.id,
              status: "failed",
              error: {
                code: "UPLOAD_FAILED",
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }

          // 即使部分失败，也返回结果（包含重复和失败的分片）
          const response: ApiResp<{
            operationId: string;
            processed: number;
            failed: number;
            results: Array<{
              chunkId: string;
              status: "success" | "failed" | "duplicate";
              error?: { code: string; message: string };
            }>;
          }> = {
            success: true,
            data: {
              operationId: "",
              processed: duplicateChunks.length,
              failed: chunksToUpload.length,
              results,
            },
          };
          return response;
        }
      } else {
        // 所有分片都是重复的
        logger.info(`所有分片都是重复的，跳过上传`, {
          duplicateCount: duplicateChunks.length,
        });

        const response: ApiResp<{
          operationId: string;
          processed: number;
          failed: number;
          results: Array<{
            chunkId: string;
            status: "success" | "failed" | "duplicate";
            error?: { code: string; message: string };
          }>;
        }> = {
          success: true,
          data: {
            operationId: "",
            processed: duplicateChunks.length,
            failed: 0,
            results,
          },
        };
        return response;
      }
    } catch (error) {
      logger.error("批量上传失败", { error });
      reply.code(500);
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
      } as ApiResp<{
        operationId: string;
        processed: number;
        failed: number;
        results: Array<{
          chunkId: string;
          status: "success" | "failed" | "duplicate";
          error?: { code: string; message: string };
        }>;
      }>;
    }
  });
}

