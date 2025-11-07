/**
 * 模块名：Main Entry
 * 职责：主入口文件
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import dotenv from "dotenv";
import { logger } from "./utils/logger.js";

// 加载环境变量
dotenv.config();

logger.info("Datapull 服务启动");

// 主入口逻辑由 CLI 脚本调用
export {};

