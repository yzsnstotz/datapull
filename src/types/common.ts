/**
 * 模块名：Common Types
 * 职责：定义通用类型和枚举
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

/** 通用状态枚举 */
export type TaskStatus = "pending" | "processing" | "completed" | "failed";

/** 语言代码 */
export type LangCode = "ja" | "zh" | "en";

/** 通用时间戳 */
export type ISODate = string;

/** 内容类型 */
export type ContentType = "html" | "pdf" | "unknown";

