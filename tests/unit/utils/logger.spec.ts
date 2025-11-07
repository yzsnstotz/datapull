import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLogger } from "../../../src/utils/logger.js";

describe("Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该创建logger实例", () => {
    const logger = createLogger("info");
    expect(logger).toBeDefined();
    expect(logger.level).toBe("info");
  });

  it("应该支持不同日志级别", () => {
    const debugLogger = createLogger("debug");
    const errorLogger = createLogger("error");
    
    expect(debugLogger.level).toBe("debug");
    expect(errorLogger.level).toBe("error");
  });

  it("应该包含结构化日志字段", () => {
    const logger = createLogger("info");
    const logSpy = vi.spyOn(logger, "info");
    
    logger.info("测试消息", {
      event: "test.event",
      sourceId: "test-source",
      operationId: "op-123",
      processed: 10,
    });

    expect(logSpy).toHaveBeenCalledWith(
      "测试消息",
      expect.objectContaining({
        event: "test.event",
        sourceId: "test-source",
        operationId: "op-123",
        processed: 10,
      })
    );
  });

  it("应该包含service元数据", () => {
    const logger = createLogger("info");
    expect(logger.defaultMeta).toHaveProperty("service", "datapull");
  });
});

