import { describe, it, expect, vi, beforeEach } from "vitest";
import { DriveQuizClient } from "../../../src/ingesters/drivequiz-client.js";
import type { DocumentChunk } from "../../../src/types/chunker.js";
import type { IngestRequest } from "../../../src/types/ingester.js";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("DriveQuizClient", () => {
  let client: DriveQuizClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DriveQuizClient("https://api.example.com", "test-token");
  });

  describe("uploadSingle", () => {
    it("应该成功上传单个文档", async () => {
      const doc: DocumentChunk = {
        chunkIndex: 1,
        totalChunks: 1,
        content: "测试内容",
        lang: "zh",
        contentHash: "hash123",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      };

      // 根据联调文档，响应格式使用 data 包裹
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            docId: "doc-123",
            operationId: "op-456",
          },
        },
      });

      const result = await client.uploadSingle(doc);
      expect(result.docId).toBe("doc-123");
      expect(result.operationId).toBe("op-456");
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.example.com/docs",
        expect.objectContaining({
          title: expect.any(String), // 根据联调文档，必须包含 title 字段
          content: "测试内容",
          url: "https://example.com/test",
          lang: "zh",
          version: "2025Q1",
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });
  });

  describe("uploadBatch", () => {
    it("应该成功批量上传文档", async () => {
      const request: IngestRequest = {
        docs: [
          {
            chunkIndex: 1,
            totalChunks: 2,
            content: "内容1",
            lang: "zh",
            contentHash: "hash1",
            parentUrl: "https://example.com/test",
            sourceId: "test-source",
          },
          {
            chunkIndex: 2,
            totalChunks: 2,
            content: "内容2",
            lang: "zh",
            contentHash: "hash2",
            parentUrl: "https://example.com/test",
            sourceId: "test-source",
          },
        ],
        sourceId: "test-source",
        version: "2025Q1",
        batchMetadata: {},
      };

      // 根据联调文档，响应格式使用 data 包裹
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            processed: 2,
            failed: 0,
            operationId: "op-789",
            results: [
              { index: 0, status: "success", docId: "doc-1" },
              { index: 1, status: "success", docId: "doc-2" },
            ],
          },
        },
      });

      const result = await client.uploadBatch(request);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.operationId).toBe("op-789");
    });

    it("应该处理409重复文档错误", async () => {
      const request: IngestRequest = {
        docs: [
          {
            chunkIndex: 1,
            totalChunks: 1,
            content: "重复内容",
            lang: "zh",
            contentHash: "hash-duplicate",
            parentUrl: "https://example.com/test",
            sourceId: "test-source",
          },
        ],
        sourceId: "test-source",
        version: "2025Q1",
        batchMetadata: {},
      };

      // 根据联调文档，错误响应格式使用 error 包裹
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            success: false,
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: "Document already exists",
            },
          },
        },
        message: "Conflict",
      } as any);

      const result = await client.uploadBatch(request);
      expect(result.success).toBe(false);
      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
    });

    it("应该处理401认证错误", async () => {
      const request: IngestRequest = {
        docs: [
          {
            chunkIndex: 1,
            totalChunks: 1,
            content: "测试内容",
            lang: "zh",
            contentHash: "hash1",
            parentUrl: "https://example.com/test",
            sourceId: "test-source",
          },
        ],
        sourceId: "test-source",
        version: "2025Q1",
        batchMetadata: {},
      };

      // 根据联调文档，错误响应格式使用 error 包裹
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid or missing token",
            },
          },
        },
        message: "Unauthorized",
      } as any);

      await expect(client.uploadBatch(request)).rejects.toThrow();
    });
  });

  describe("healthCheck", () => {
    it("应该返回true当健康检查成功", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://api.example.com/health",
        expect.any(Object)
      );
    });

    it("应该返回false当健康检查失败", async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("getOperations", () => {
    it("应该获取操作记录", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [
            { operationId: "op-1", status: "success" },
            { operationId: "op-2", status: "processing" },
          ],
        },
      });

      const result = await client.getOperations();
      expect(result.length).toBe(2);
      expect(result[0].operationId).toBe("op-1");
    });

    it("应该支持按sourceId过滤", async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [{ operationId: "op-1", sourceId: "test-source" }],
        },
      });

      const result = await client.getOperations("test-source");
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://api.example.com/operations",
        expect.objectContaining({
          params: { sourceId: "test-source" },
        })
      );
    });
  });
});

