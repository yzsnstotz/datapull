/**
 * 模块名：Hasher
 * 职责：提供哈希计算功能
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import crypto from "crypto";

/**
 * 计算字符串的 SHA256 哈希值
 * @param text - 要哈希的文本
 * @returns SHA256 哈希值（十六进制字符串）
 */
export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

