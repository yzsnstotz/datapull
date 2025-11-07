import { describe, it, expect, beforeAll } from "vitest";
import { fetchPage } from "../../src/crawler/fetcher.js";
import { HtmlExtractor } from "../../src/extractors/html-extractor.js";
import { chunkDocument } from "../../src/chunkers/text-chunker.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import type { CrawlTask } from "../../src/types/crawler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "../../../..");

describe("集成测试：抓取-提取-分片流程", () => {
  it("应该完成HTML抓取、提取和分片的完整流程", async () => {
    // 1. 模拟抓取（使用本地文件）
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-ja.html"),
      "utf-8"
    );

    // 2. 提取内容
    const extractor = new HtmlExtractor();
    const extracted = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(extracted.title).toBeDefined();
    expect(extracted.content.length).toBeGreaterThan(100);
    expect(extracted.lang).toBe("ja");

    // 3. 分片
    const chunks = chunkDocument(extracted);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content.length).toBeGreaterThanOrEqual(100);
    expect(chunks[0].content.length).toBeLessThanOrEqual(800);
  });

  it("应该处理多语言文档", async () => {
    const languages = ["ja", "zh", "en"];
    const files = [
      "sample-ja.html",
      "sample-zh.html",
      "sample-en.html",
    ];

    for (let i = 0; i < languages.length; i++) {
      const html = readFileSync(
        join(__dirname, `tests/fixtures/${files[i]}`),
        "utf-8"
      );
      const extractor = new HtmlExtractor();
      const extracted = await extractor.extract(
        `https://example.com/${languages[i]}`,
        html,
        "test-source",
        "2025Q1"
      );

      expect(extracted.lang).toBe(languages[i]);
      const chunks = chunkDocument(extracted);
      expect(chunks.length).toBeGreaterThan(0);
    }
  });

  it("应该过滤噪音内容（广告、脚本等）", async () => {
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-ja.html"),
      "utf-8"
    );
    const extractor = new HtmlExtractor();
    const extracted = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(extracted.content).not.toContain("広告エリア");
    expect(extracted.content).not.toContain("Tracking script");
    expect(extracted.content).not.toContain("ホーム");
  });
});

