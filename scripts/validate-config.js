/**
 * 模块名：Validate Config Script
 * 职责：校验配置文件
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { validateConfig } from "../src/utils/validator.js";
import { logger } from "../src/utils/logger.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
/**
 * 主函数
 */
async function main() {
    try {
        const configPath = join(__dirname, "../config/sources.json");
        const configContent = readFileSync(configPath, "utf-8");
        const config = JSON.parse(configContent);
        const validatedConfig = validateConfig(config);
        logger.info(`✅ 配置验证通过: ${validatedConfig.length} 个源`);
        validatedConfig.forEach((source) => {
            logger.info(`  - ${source.id}: ${source.title} (${source.lang})`);
        });
        process.exit(0);
    }
    catch (error) {
        logger.error("❌ 配置验证失败", { error });
        process.exit(1);
    }
}
// 执行主函数
main().catch((error) => {
    logger.error("未捕获的错误", { error });
    process.exit(1);
});
//# sourceMappingURL=validate-config.js.map