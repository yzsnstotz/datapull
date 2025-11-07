import { describe, it, expect } from "vitest";
import { chunkDocument } from "../../../src/chunkers/text-chunker.js";
import type { ExtractedDocument } from "../../../src/types/extractor.js";

describe("TextChunker", () => {
  it("应该对日语文本进行分片", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "これはテストです。これは長い文章です。これは別の文章です。".repeat(20),
      lang: "ja",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].lang).toBe("ja");
    expect(chunks[0].parentUrl).toBe(doc.url);
    expect(chunks[0].sourceId).toBe("test-source");
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(100);
    expect(chunks[0].content.length).toBeLessThanOrEqual(800);
  });

  it("应该对中文文本进行分片", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "这是测试。这是长文章。这是另一段文字。".repeat(20),
      lang: "zh",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].lang).toBe("zh");
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(100);
    expect(chunks[0].content.length).toBeLessThanOrEqual(800);
  });

  it("应该对英文文本进行分片", () => {
    const doc: ExtractedDocument = {
      title: "Test Document",
      url: "https://example.com/test",
      content: "This is a test. This is a long sentence. This is another sentence. ".repeat(20),
      lang: "en",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].lang).toBe("en");
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(100);
    expect(chunks[0].content.length).toBeLessThanOrEqual(800);
  });

  it("应该为每个分片生成contentHash", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "这是测试内容。".repeat(30),
      lang: "zh",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    chunks.forEach((chunk) => {
      expect(chunk.contentHash).toBeDefined();
      expect(chunk.contentHash.length).toBeGreaterThan(0);
    });
  });

  it("应该正确设置chunkIndex和totalChunks", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "这是测试内容。".repeat(50),
      lang: "zh",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBeGreaterThan(0);
    
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index + 1);
      expect(chunk.totalChunks).toBe(chunks.length);
    });
  });

  it("应该拒绝过短的内容（<100字符）", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "短文本",
      lang: "zh",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    expect(chunks.length).toBe(0);
  });

  it("分片大小应该在500-800字符范围内", () => {
    const doc: ExtractedDocument = {
      title: "测试文档",
      url: "https://example.com/test",
      content: "这是测试内容。".repeat(100),
      lang: "zh",
      sourceId: "test-source",
      version: "2025Q1",
      metadata: {},
    };

    const chunks = chunkDocument(doc);
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeGreaterThanOrEqual(100);
      expect(chunk.content.length).toBeLessThanOrEqual(800);
    });
  });
});

