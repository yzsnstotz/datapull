/**
 * 模块名：DriveQuiz Client
 * 职责：封装 DriveQuiz API 调用
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */

import dotenv from "dotenv";
import axios, { AxiosError } from "axios";
import type { DocumentChunk } from "../types/chunker.js";
import type { IngestRequest, IngestResult } from "../types/ingester.js";
import { logger } from "../utils/logger.js";
import { retry } from "./retry-handler.js";

// 加载环境变量（确保 .env 文件被加载）
dotenv.config();

// 根据联调文档，开发环境默认端口为 8789（实际服务端口）
const API_URL = process.env.DRIVEQUIZ_API_URL || "http://localhost:8789/api/v1/rag";
const API_TOKEN = process.env.DRIVEQUIZ_API_TOKEN || "";

if (!API_TOKEN) {
  logger.warn("DRIVEQUIZ_API_TOKEN 未设置");
}

/**
 * DriveQuiz API 客户端
 */
export class DriveQuizClient {
  private baseURL: string;
  private token: string;

  constructor(baseURL: string = API_URL, token: string = API_TOKEN) {
    this.baseURL = baseURL;
    this.token = token;
  }

  /**
   * 从 URL 生成文档标题
   * @param url - 文档 URL
   * @returns 文档标题
   */
  private generateTitle(url: string): string {
    try {
      const urlObj = new URL(url);
      // 使用路径的最后部分作为标题，如果没有则使用域名
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1].slice(0, 500);
      }
      return urlObj.hostname.slice(0, 500);
    } catch {
      // 如果 URL 解析失败，使用原始 URL（截断到 500 字符）
      return url.slice(0, 500);
    }
  }

  /**
   * 上传单个文档
   * @param doc - 文档分片
   * @param version - 数据版本（可选，默认 2025Q1）
   * @returns 上传结果
   */
  async uploadSingle(
    doc: DocumentChunk,
    version: string = "2025Q1"
  ): Promise<{ docId: string; operationId: string }> {
    const url = `${this.baseURL}/docs`;

    // 根据联调文档，必须包含 title 字段
    const title = this.generateTitle(doc.parentUrl);

    const payload = {
      title,
      content: doc.content,
      url: doc.parentUrl,
      lang: doc.lang,
      version,
      meta: {
        sourceId: doc.sourceId,
        contentHash: doc.contentHash,
        chunkIndex: doc.chunkIndex,
        totalChunks: doc.totalChunks,
      },
    };

    const response = await retry(async () => {
      return await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        timeout: 30000,
      });
    });

    // 根据联调文档，响应格式使用 data 包裹
    const responseData = response.data.data || response.data;
    return {
      docId: responseData.docId || "",
      operationId: responseData.operationId || "",
    };
  }

  /**
   * 批量上传文档
   * @param request - 批量上传请求
   * @returns 上传结果
   */
  async uploadBatch(request: IngestRequest): Promise<IngestResult> {
    const url = `${this.baseURL}/docs/batch`;

    // 根据联调文档，每个文档必须包含 title、version、lang 字段
    const docs = request.docs.map((doc) => ({
      title: this.generateTitle(doc.parentUrl),
      content: doc.content,
      url: doc.parentUrl,
      lang: doc.lang,
      version: request.version,
      meta: {
        sourceId: doc.sourceId,
        contentHash: doc.contentHash,
        chunkIndex: doc.chunkIndex,
        totalChunks: doc.totalChunks,
      },
    }));

    const payload = {
      docs,
      sourceId: request.sourceId,
      batchMetadata: request.batchMetadata,
    };

    try {
      logger.info(`准备发送批量上传请求到 DriveQuiz API`, {
        url,
        docsCount: docs.length,
        sourceId: request.sourceId,
        version: request.version,
        hasToken: !!this.token,
        tokenLength: this.token.length,
        tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : "empty",
      });

      const response = await retry(async () => {
        const authHeader = `Bearer ${this.token}`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: authHeader,
        };
        
        // 详细记录请求信息
        logger.info(`发送 HTTP POST 请求详情`, {
          url,
          method: "POST",
          payloadSize: JSON.stringify(payload).length,
          authHeaderLength: authHeader.length,
          authHeaderValue: authHeader, // 完整记录 Authorization header
          tokenValue: this.token, // 完整记录 Token 值
          tokenLength: this.token.length,
          headers: {
            "Content-Type": headers["Content-Type"],
            Authorization: authHeader, // 完整记录
          },
        });
        
        return await axios.post(url, payload, {
          headers,
          timeout: 60000, // 批量上传可能需要更长时间
        });
      });

      logger.info(`收到 DriveQuiz API 响应`, {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
      });

      // 根据联调文档，响应格式使用 data 包裹
      const responseData = response.data.data || response.data;
      const result: IngestResult = {
        success: true,
        processed: responseData.processed || 0,
        failed: responseData.failed || 0,
        operationId: responseData.operationId || "",
        results: responseData.results || [],
      };

      logger.info(`批量上传成功`, {
        operationId: result.operationId,
        processed: result.processed,
        failed: result.failed,
      });

      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as any;
      
      logger.error(`批量上传失败`, {
        error: axiosError.message,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        errorCode: errorData?.error?.code,
        errorMessage: errorData?.error?.message,
        url,
        requestPayload: {
          docsCount: docs.length,
          sourceId: request.sourceId,
          version: request.version,
        },
        responseData: errorData,
        stack: axiosError.stack,
      });

      // 处理重复文档错误（409）
      if (axiosError.response?.status === 409) {
        logger.warn(`检测到重复文档，跳过`);
        return {
          success: false,
          processed: 0,
          failed: request.docs.length,
          operationId: "",
          results: request.docs.map((_, index) => ({
            index,
            status: "failed",
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: errorData?.error?.message || "文档已存在",
            },
          })),
        };
      }

      // 处理参数验证错误（400）
      if (axiosError.response?.status === 400) {
        const errorMessage = errorData?.error?.message || "参数验证失败";
        logger.error(`参数验证失败: ${errorMessage}`);
        throw new Error(`参数验证失败: ${errorMessage}`);
      }

      // 处理认证错误（401）
      if (axiosError.response?.status === 401) {
        logger.error(`认证失败: Token 无效或缺失`);
        throw new Error("认证失败: Token 无效或缺失");
      }

      throw error;
    }
  }

  /**
   * 获取操作记录
   * @param sourceId - 源 ID（可选）
   * @returns 操作记录数组
   */
  async getOperations(sourceId?: string): Promise<any[]> {
    const url = `${this.baseURL}/operations`;
    const params = sourceId ? { sourceId } : {};

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        params,
        timeout: 10000,
      });

      // 根据联调文档，响应格式使用 data 包裹
      const responseData = response.data.data || response.data;
      return Array.isArray(responseData) ? responseData : [];
    } catch (error) {
      logger.error(`获取操作记录失败`, { error });
      return [];
    }
  }

  /**
   * 健康检查
   * @returns 健康状态
   */
  async healthCheck(): Promise<boolean> {
    const url = `${this.baseURL}/health`;

    try {
      const response = await axios.get(url, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`健康检查失败`, { error });
      return false;
    }
  }
}

