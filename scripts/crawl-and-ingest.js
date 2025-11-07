/**
 * 模块名：Crawl and Ingest Script
 * 职责：提供爬取和上传的 CLI 入口
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { CrawlService } from "../src/services/crawl-service.js";
import { validateConfig } from "../src/utils/validator.js";
import { logger } from "../src/utils/logger.js";
// 加载环境变量
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const sourceId = args.find((arg) => arg.startsWith("--source="))?.split("=")[1];
    try {
        // 1. 加载配置
        const configPath = join(__dirname, "../config/sources.json");
        const configContent = readFileSync(configPath, "utf-8");
        const configs = validateConfig(JSON.parse(configContent));
        logger.info(`加载配置成功，共 ${configs.length} 个源`);
        // 2. 过滤源（如果指定了 sourceId）
        const sourcesToProcess = sourceId
            ? configs.filter((c) => c.id === sourceId)
            : configs;
        if (sourcesToProcess.length === 0) {
            logger.error(`未找到源配置: ${sourceId || "all"}`);
            process.exit(1);
        }
        // 3. 执行爬取
        const crawlService = new CrawlService();
        for (const config of sourcesToProcess) {
            logger.info(`开始处理源: ${config.id}`, {
                title: config.title,
                seeds: config.seeds.length,
            });
            if (dryRun) {
                logger.info(`[DRY RUN] 模拟处理源: ${config.id}`);
                logger.info(`[DRY RUN] 种子 URL: ${config.seeds.join(", ")}`);
                logger.info(`[DRY RUN] 最大深度: ${config.maxDepth}`);
                logger.info(`[DRY RUN] 最大页面: ${config.maxPages}`);
                continue;
            }
            try {
                await crawlService.startCrawl(config.id, config);
                logger.info(`源处理完成: ${config.id}`);
            }
            catch (error) {
                logger.error(`源处理失败: ${config.id}`, { error });
            }
        }
        logger.info("所有任务完成");
    }
    catch (error) {
        logger.error("执行失败", { error });
        process.exit(1);
    }
}
// 执行主函数
main().catch((error) => {
    logger.error("未捕获的错误", { error });
    process.exit(1);
});
//# sourceMappingURL=crawl-and-ingest.js.map