/**
 * 模块名：Encoder
 * 职责：提供字符编码检测和转换功能
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import iconv from "iconv-lite";

/**
 * 检测并转换 Buffer 编码
 * @param buffer - 要检测的 Buffer
 * @param defaultEncoding - 默认编码，默认为 UTF-8
 * @returns 转换后的字符串
 */
export function detectEncoding(
  buffer: Buffer,
  defaultEncoding: string = "utf-8"
): string {
  // 尝试检测常见编码
  const encodings = ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp"];

  for (const encoding of encodings) {
    try {
      const decoded = iconv.decode(buffer, encoding);
      // 简单验证：检查是否包含有效字符
      if (decoded.length > 0 && !decoded.includes("\uFFFD")) {
        return decoded;
      }
    } catch {
      // 继续尝试下一个编码
    }
  }

  // 如果都失败，使用默认编码
  try {
    return iconv.decode(buffer, defaultEncoding);
  } catch {
    // 最后尝试 UTF-8
    return buffer.toString("utf-8");
  }
}

