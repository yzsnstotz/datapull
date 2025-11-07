import { describe, it, expect, beforeAll, vi } from "vitest";
import { DriveQuizClient } from "../../src/ingesters/drivequiz-client.js";
import type { DocumentChunk } from "../../src/types/chunker.js";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("集成测试：DriveQuiz API", () => {
  let client: DriveQuizClient;

  beforeAll(() => {
    client = new DriveQuizClient("https://api.example.com", "test-token");
  });

  it("应该完成批量上传流程", async () => {
    const docs: DocumentChunk[] = [
      {
        chunkIndex: 1,
        totalChunks: 2,
        content: "这是第一段内容。".repeat(20),
        lang: "zh",
        contentHash: "hash1",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      },
      {
        chunkIndex: 2,
        totalChunks: 2,
        content: "这是第二段内容。".repeat(20),
        lang: "zh",
        contentHash: "hash2",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      },
    ];

    // 根据联调文档，响应格式使用 data 包裹
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          processed: 2,
          failed: 0,
          operationId: "op-123",
          results: [
            { index: 0, status: "success", docId: "doc-1" },
            { index: 1, status: "success", docId: "doc-2" },
          ],
        },
      },
    });

    const result = await client.uploadBatch({
      docs,
      sourceId: "test-source",
      version: "2025Q1",
      batchMetadata: {},
    });

    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.operationId).toBe("op-123");
  });

  it("应该处理409重复文档错误", async () => {
    const docs: DocumentChunk[] = [
      {
        chunkIndex: 1,
        totalChunks: 1,
        content: "重复内容",
        lang: "zh",
        contentHash: "duplicate-hash",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      },
    ];

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

    const result = await client.uploadBatch({
      docs,
      sourceId: "test-source",
      version: "2025Q1",
      batchMetadata: {},
    });

    expect(result.success).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("应该处理401认证错误", async () => {
    const docs: DocumentChunk[] = [
      {
        chunkIndex: 1,
        totalChunks: 1,
        content: "测试内容",
        lang: "zh",
        contentHash: "hash1",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      },
    ];

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

    await expect(
      client.uploadBatch({
        docs,
        sourceId: "test-source",
        version: "2025Q1",
        batchMetadata: {},
      })
    ).rejects.toThrow();
  });

  it("应该处理429限流错误", async () => {
    const docs: DocumentChunk[] = [
      {
        chunkIndex: 1,
        totalChunks: 1,
        content: "测试内容",
        lang: "zh",
        contentHash: "hash1",
        parentUrl: "https://example.com/test",
        sourceId: "test-source",
      },
    ];

    // 根据联调文档，错误响应格式使用 error 包裹
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
          },
        },
      },
      message: "Too Many Requests",
    } as any);

    await expect(
      client.uploadBatch({
        docs,
        sourceId: "test-source",
        version: "2025Q1",
        batchMetadata: {},
      })
    ).rejects.toThrow();
  });
});

