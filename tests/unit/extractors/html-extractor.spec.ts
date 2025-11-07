import { describe, it, expect } from "vitest";
import { HtmlExtractor } from "../../../src/extractors/html-extractor.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "../../../..");

describe("HtmlExtractor", () => {
  const extractor = new HtmlExtractor();

  it("应该识别HTML内容类型", () => {
    expect(extractor.canHandle("text/html")).toBe(true);
    expect(extractor.canHandle("text/xhtml")).toBe(true);
    expect(extractor.canHandle("html")).toBe(true);
    expect(extractor.canHandle("application/pdf")).toBe(false);
  });

  it("应该从日语HTML中提取内容", async () => {
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-ja.html"),
      "utf-8"
    );
    const result = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(result.title).toContain("外国免許証");
    expect(result.content).toContain("外国免許証");
    expect(result.content).not.toContain("広告エリア");
    expect(result.content).not.toContain("Tracking script");
    expect(result.lang).toBe("ja");
    expect(result.url).toBe("https://example.com/test");
    expect(result.sourceId).toBe("test-source");
    expect(result.version).toBe("2025Q1");
  });

  it("应该从中文HTML中提取内容", async () => {
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-zh.html"),
      "utf-8"
    );
    const result = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(result.title).toContain("外国驾照");
    expect(result.content).toContain("外国驾照");
    expect(result.content).not.toContain("广告区域");
    expect(result.lang).toBe("zh");
  });

  it("应该从英文HTML中提取内容", async () => {
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-en.html"),
      "utf-8"
    );
    const result = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(result.title).toContain("Foreign Driver");
    expect(result.content).toContain("foreign driver");
    expect(result.content).not.toContain("Advertisement");
    expect(result.lang).toBe("en");
  });

  it("应该过滤script、nav、footer等元素", async () => {
    const html = readFileSync(
      join(__dirname, "tests/fixtures/sample-ja.html"),
      "utf-8"
    );
    const result = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(result.content).not.toContain("ホーム");
    expect(result.content).not.toContain("Tracking script");
    expect(result.content).not.toContain("広告エリア");
  });

  it("应该清理多余空白字符", async () => {
    const html = "<html><body><p>  测试   内容  </p></body></html>";
    const result = await extractor.extract(
      "https://example.com/test",
      html,
      "test-source",
      "2025Q1"
    );

    expect(result.content).not.toMatch(/\s{3,}/);
  });
});

