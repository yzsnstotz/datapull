import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPage, checkRobots } from "../../../src/crawler/fetcher.js";
import type { CrawlTask } from "../../../src/types/crawler.js";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("Fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkRobots", () => {
    it("应该允许访问允许的URL", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(true),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      mockedAxios.get.mockResolvedValueOnce({
        data: "User-agent: *\nAllow: /",
      });

      const result = await checkRobots("https://example.com/page");
      expect(result).toBe(true);
    });

    it("应该禁止访问被禁止的URL", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(false),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      mockedAxios.get.mockResolvedValueOnce({
        data: "User-agent: *\nDisallow: /",
      });

      const result = await checkRobots("https://example.com/page");
      expect(result).toBe(false);
    });

    it("应该在robots.txt不存在时默认允许", async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error("Not found"));

      const result = await checkRobots("https://example.com/page");
      expect(result).toBe(true);
    });
  });

  describe("fetchPage", () => {
    it("应该成功抓取HTML页面", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(true),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      const htmlContent = "<html><body>Test</body></html>";
      mockedAxios.get
        .mockResolvedValueOnce({
          data: "User-agent: *\nAllow: /",
        })
        .mockResolvedValueOnce({
          status: 200,
          data: Buffer.from(htmlContent),
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        });

      const task: CrawlTask = {
        url: "https://example.com/test",
        sourceId: "test-source",
      };

      const result = await fetchPage(task);
      expect(result.status).toBe(200);
      expect(result.contentType).toBe("html");
      expect(result.html).toBeDefined();
    });

    it("应该成功抓取PDF文件", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(true),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      const pdfBuffer = Buffer.from("%PDF-1.4");
      mockedAxios.get
        .mockResolvedValueOnce({
          data: "User-agent: *\nAllow: /",
        })
        .mockResolvedValueOnce({
          status: 200,
          data: pdfBuffer,
          headers: {
            "content-type": "application/pdf",
          },
        });

      const task: CrawlTask = {
        url: "https://example.com/test.pdf",
        sourceId: "test-source",
      };

      const result = await fetchPage(task);
      expect(result.status).toBe(200);
      expect(result.contentType).toBe("pdf");
      expect(result.buffer).toBeDefined();
    });

    it("应该处理HTTP错误", async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: "User-agent: *\nAllow: /",
        })
        .mockRejectedValueOnce({
          response: {
            status: 404,
          },
          message: "Not Found",
        });

      const task: CrawlTask = {
        url: "https://example.com/notfound",
        sourceId: "test-source",
      };

      const result = await fetchPage(task);
      expect(result.status).toBe(404);
      expect(result.error).toBeDefined();
    });

    it("应该在robots.txt禁止时返回403", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(false),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      mockedAxios.get.mockResolvedValueOnce({
        data: "User-agent: *\nDisallow: /",
      });

      const task: CrawlTask = {
        url: "https://example.com/test",
        sourceId: "test-source",
      };

      const result = await fetchPage(task);
      expect(result.status).toBe(403);
      expect(result.error).toContain("robots.txt");
    });

    it("应该识别PDF文件（通过URL扩展名）", async () => {
      const mockRobots = {
        isAllowed: vi.fn().mockReturnValue(true),
      };
      vi.doMock("robots-parser", () => ({
        RobotsParser: vi.fn().mockReturnValue(mockRobots),
      }));

      const pdfBuffer = Buffer.from("%PDF-1.4");
      mockedAxios.get
        .mockResolvedValueOnce({
          data: "User-agent: *\nAllow: /",
        })
        .mockResolvedValueOnce({
          status: 200,
          data: pdfBuffer,
          headers: {
            "content-type": "application/octet-stream",
          },
        });

      const task: CrawlTask = {
        url: "https://example.com/test.pdf",
        sourceId: "test-source",
      };

      const result = await fetchPage(task);
      expect(result.contentType).toBe("pdf");
    });
  });
});

