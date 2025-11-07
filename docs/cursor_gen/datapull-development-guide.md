# Datapull 开发指南

本文档面向 datapull 开发团队，用于实现从各个目标网站抓取信息并上传到 DriveQuiz RAG 数据库的服务。

## 📋 目录

1. [概述](#概述)
2. [需要实现的功能](#需要实现的功能)
3. [架构设计](#架构设计)
4. [模块实现清单](#模块实现清单)
5. [DriveQuiz API 集成](#drivequiz-api-集成)
6. [文档审核功能](#文档审核功能)
7. [配置管理](#配置管理)
8. [错误处理](#错误处理)
9. [测试要求](#测试要求)
10. [开发流程](#开发流程)
11. [部署指南](#部署指南)

---

## 概述

### 项目背景

datapull 是一个本地服务，用于从各个目标网站（JAF、警察厅、MLIT 等）抓取信息，然后通过 API 上传到 DriveQuiz 的 RAG 数据库。

### 核心功能

- 🌐 **多源网站抓取**: 支持从多个目标网站抓取内容
- 📄 **多格式支持**: 支持 HTML 和 PDF 文档
- 🧩 **智能文本分片**: 保持语义完整性的文本分片
- ✅ **文档审核功能**: 每个文档上传前需要人工审核和批准
- 📤 **批量上传**: 批量上传到 DriveQuiz API
- 📝 **操作记录**: 完整的操作记录和日志
- 🔄 **自动重试**: 完善的错误处理和重试机制
- ⚙️ **配置驱动**: 通过配置文件控制行为

### 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript 5+
- **HTTP 客户端**: axios
- **HTML 解析**: cheerio
- **PDF 解析**: pdf-parse
- **配置验证**: zod
- **日志**: winston
- **队列**: p-queue
- **测试**: vitest

### 相关文档

请参考：
- [项目结构文档](./project-structure.md)
- [DriveQuiz API 规范](./drivequiz-api-spec.md)
- [DriveQuiz 集成联调清单](./drivequiz-integration-checklist.md)

---

## 需要实现的功能

### 核心功能（必须实现）

#### 1. 网站爬取功能 ✅

**优先级**: P0（最高）

**功能要求**:
- 支持多源网站抓取（JAF、警察厅、MLIT 等）
- 遵守 robots.txt
- 支持链接发现和队列管理
- 支持爬取深度和页面数量限制
- 限流和重试机制

**实现要点**:
- HTTP 请求和响应处理
- Robots.txt 检查
- 链接发现和过滤
- 爬取调度和限流

---

#### 2. 内容提取功能 ✅

**优先级**: P0（最高）

**功能要求**:
- HTML 到纯文本转换
- PDF 文本提取
- 内容清理和去噪（去除导航、脚本、广告等）
- 编码检测和转换（UTF-8、Shift-JIS 等）

**实现要点**:
- 提取主要内容，去除噪音
- 支持多种编码格式
- 保持文本完整性

---

#### 3. 文本分片功能 ✅

**优先级**: P0（最高）

**功能要求**:
- 智能文本分片（500-800字符/片）
- 保持语义完整性（在句号、换行处裁切）
- 支持多语言（日文、中文、英文）
- 支持重叠（避免截断句子）

**实现要点**:
- 按字符数分片（中文/日文按字符、英文按词边界）
- 尽量在句号/换行处裁切
- 支持分片重叠

---

#### 4. DriveQuiz API 集成 ✅

**优先级**: P0（最高）

**功能要求**:
- 单文档上传
- 批量文档上传（推荐）
- 操作记录查询
- 错误处理和重试

**实现要点**:
- 与 DriveQuiz API 交互
- 批量处理和上传
- 指数退避重试机制
- 完整的错误处理

---

#### 5. 文档审核功能 ✅

**优先级**: P0（最高）

**功能要求**:
- 抓取后保存到审核队列
- 人工审核每个文档
- 批准/拒绝文档
- 批准后批量上传
- 生成预览报告

**实现要点**:
- 审核队列存储（SQLite 或文件）
- 审核服务模块（ReviewService）
- 审核命令行工具（CLI）
- 审核状态管理（pending/approved/rejected）

---

#### 6. 操作记录功能 ✅

**优先级**: P1（高）

**功能要求**:
- 记录每次抓取操作
- 记录上传结果
- 查询操作历史
- 本地日志存储

**实现要点**:
- 操作记录存储（本地或数据库）
- 结构化日志
- 查询和统计功能

---

### 辅助功能（建议实现）

#### 7. 配置验证功能

**优先级**: P1（高）

**功能要求**:
- 配置文件验证
- 环境变量验证
- 错误提示清晰

**实现要点**:
- 使用 zod 进行配置验证
- 提供清晰的错误信息

---

#### 8. 缓存功能

**优先级**: P2（中）

**功能要求**:
- 已抓取页面缓存
- 避免重复抓取
- 支持缓存失效

**实现要点**:
- 本地文件缓存或数据库缓存
- 基于 URL 和内容哈希的缓存键

---

#### 9. 监控和统计

**优先级**: P2（中）

**功能要求**:
- 抓取统计（成功数、失败数等）
- 性能指标（处理时间、吞吐量等）
- 错误统计

**实现要点**:
- 记录关键指标
- 提供统计接口

---

## 架构设计

### 整体架构

```
配置加载 → 爬取 → 提取 → 分片 → 入库 → 记录操作
   ↓         ↓      ↓      ↓      ↓       ↓
sources.json HTTP  HTML  文本   API   本地日志
            robots PDF  分片  上传   数据库
```

### 模块划分

#### 1. Crawler（爬虫模块）

**职责**:
- HTTP 请求和响应处理
- Robots.txt 检查
- 链接发现和队列管理
- 爬取调度和限流

**关键文件**:
- `src/crawler/fetcher.ts`: HTTP 请求和 robots.txt 检查
- `src/crawler/discoverer.ts`: 链接发现和过滤
- `src/crawler/scheduler.ts`: 爬取调度和限流

---

#### 2. Extractors（提取器模块）

**职责**:
- HTML 到纯文本转换
- PDF 文本提取
- 内容清理和去噪

**关键文件**:
- `src/extractors/html-extractor.ts`: HTML 提取
- `src/extractors/pdf-extractor.ts`: PDF 提取
- `src/extractors/base-extractor.ts`: 基础提取器接口

---

#### 3. Chunkers（分片模块）

**职责**:
- 文本智能分片
- 保持语义完整性
- 支持多语言分片策略

**关键文件**:
- `src/chunkers/text-chunker.ts`: 文本分片逻辑
- `src/chunkers/chunk-strategy.ts`: 分片策略接口

---

#### 4. Ingesters（入库模块）

**职责**:
- 与 DriveQuiz API 交互
- 批量上传处理
- 错误处理和重试

**关键文件**:
- `src/ingesters/drivequiz-client.ts`: DriveQuiz API 客户端
- `src/ingesters/batch-processor.ts`: 批量处理
- `src/ingesters/retry-handler.ts`: 重试逻辑

---

#### 5. Services（服务模块）

**职责**:
- 业务流程编排
- 操作记录管理
- 错误处理和日志记录
- 文档审核管理

**关键文件**:
- `src/services/crawl-service.ts`: 爬取服务
- `src/services/ingest-service.ts`: 入库服务
- `src/services/operation-logger.ts`: 操作记录服务
- `src/services/review-service.ts`: 审核服务

---

#### 6. Utils（工具模块）

**职责**:
- 通用工具函数
- 日志记录
- 配置验证

**关键文件**:
- `src/utils/logger.ts`: 结构化日志
- `src/utils/validator.ts`: 配置验证
- `src/utils/hasher.ts`: 内容哈希计算
- `src/utils/encoder.ts`: 编码检测和转换

---

## 模块实现清单

### 1. Crawler 模块

#### 1.1 Fetcher（HTTP 请求和 robots.txt 检查）

**实现检查项**:
- [ ] 实现 HTTP 请求功能（使用 axios）
- [ ] 实现 robots.txt 检查（使用 robots-parser）
- [ ] 支持编码检测和转换（UTF-8、Shift-JIS）
- [ ] 支持超时控制（15秒）
- [ ] 支持重定向（最多3次）
- [ ] 错误处理和重试

**实现要求**:
```typescript
// 伪代码示例
interface FetchOptions {
  url: string;
  timeout?: number;
  maxRedirects?: number;
  userAgent?: string;
}

async function fetchWithRobotsCheck(options: FetchOptions): Promise<Buffer> {
  // 1. 检查 robots.txt
  const canFetch = await checkRobotsTxt(options.url);
  if (!canFetch) {
    throw new Error('Blocked by robots.txt');
  }
  
  // 2. 发送 HTTP 请求
  const response = await axios.get(options.url, {
    timeout: options.timeout || 15000,
    maxRedirects: options.maxRedirects || 3,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': options.userAgent || 'DatapullBot/1.0'
    }
  });
  
  // 3. 返回 Buffer
  return Buffer.from(response.data);
}
```

**验收标准**:
- [ ] 正确处理 HTTP 请求
- [ ] robots.txt 检查正常工作
- [ ] 编码检测和转换正确
- [ ] 超时控制正常工作
- [ ] 错误处理完整

---

#### 1.2 Discoverer（链接发现和过滤）

**实现检查项**:
- [ ] 从 HTML 中发现链接（使用 cheerio）
- [ ] 过滤链接（基于包含/排除规则）
- [ ] 链接去重
- [ ] 支持相对链接转绝对链接
- [ ] 支持深度限制

**实现要求**:
```typescript
// 伪代码示例
interface DiscoverOptions {
  html: string;
  baseUrl: string;
  include?: string[];
  exclude?: string[];
  maxDepth?: number;
}

function discoverLinks(options: DiscoverOptions): string[] {
  const $ = cheerio.load(options.html);
  const links = new Set<string>();
  
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      return;
    }
    
    try {
      const absoluteUrl = new URL(href, options.baseUrl).toString();
      
      // 过滤链接
      if (shouldInclude(absoluteUrl, options)) {
        links.add(absoluteUrl);
      }
    } catch (e) {
      // 忽略无效链接
    }
  });
  
  return Array.from(links);
}
```

**验收标准**:
- [ ] 正确发现链接
- [ ] 过滤规则正常工作
- [ ] 链接去重正确
- [ ] 相对链接转绝对链接正确

---

#### 1.3 Scheduler（爬取调度和限流）

**实现检查项**:
- [ ] 实现队列管理（使用 p-queue）
- [ ] 支持并发控制
- [ ] 支持限流（请求间隔）
- [ ] 支持爬取深度限制
- [ ] 支持页面数量限制

**实现要求**:
```typescript
// 伪代码示例
import pQueue from 'p-queue';

class CrawlScheduler {
  private queue: pQueue;
  private visited: Set<string>;
  
  constructor(concurrency: number = 4, delay: number = 400) {
    this.queue = new pQueue({
      concurrency,
      interval: delay,
      intervalCap: 1
    });
    this.visited = new Set();
  }
  
  async schedule(url: string, options: CrawlOptions): Promise<void> {
    if (this.visited.has(url)) {
      return;
    }
    
    if (options.depth > options.maxDepth) {
      return;
    }
    
    this.visited.add(url);
    
    await this.queue.add(async () => {
      await this.crawl(url, options);
    });
  }
}
```

**验收标准**:
- [ ] 队列管理正常工作
- [ ] 并发控制正确
- [ ] 限流正常工作
- [ ] 深度限制正确
- [ ] 页面数量限制正确

---

### 2. Extractors 模块

#### 2.1 HTML Extractor（HTML 提取）

**实现检查项**:
- [ ] 提取 HTML 主要内容
- [ ] 去除导航、脚本、样式等噪音
- [ ] 提取标题和正文
- [ ] 清理空白字符

**实现要求**:
```typescript
// 伪代码示例
interface ExtractResult {
  title: string;
  text: string;
}

function extractFromHTML(html: string, baseUrl: string): ExtractResult {
  const $ = cheerio.load(html);
  
  // 删除噪音元素
  ['script', 'style', 'nav', 'footer', 'noscript'].forEach(selector => {
    $(selector).remove();
  });
  
  // 删除噪音类
  const noiseClasses = ['breadcrumb', 'sidebar', 'sns', 'share', 'footer', 'header'];
  noiseClasses.forEach(className => {
    $(`[class*="${className}"]`).remove();
    $(`[id*="${className}"]`).remove();
  });
  
  // 提取标题
  const title = $('title').text().trim() || baseUrl;
  
  // 提取正文
  const text = $('body').text()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return { title, text };
}
```

**验收标准**:
- [ ] 正确提取标题和正文
- [ ] 噪音元素已去除
- [ ] 文本清理正确

---

#### 2.2 PDF Extractor（PDF 提取）

**实现检查项**:
- [ ] 提取 PDF 文本内容
- [ ] 提取 PDF 元数据（标题等）
- [ ] 处理编码问题

**实现要求**:
```typescript
// 伪代码示例
import pdfParse from 'pdf-parse';

async function extractFromPDF(buffer: Buffer): Promise<ExtractResult> {
  const pdf = await pdfParse(buffer);
  
  const title = pdf.info?.Title || 'Untitled';
  const text = (pdf.text || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return { title, text };
}
```

**验收标准**:
- [ ] 正确提取 PDF 文本
- [ ] 元数据提取正确

---

#### 2.3 Base Extractor（基础提取器接口）

**实现检查项**:
- [ ] 定义提取器接口
- [ ] 支持多种内容类型
- [ ] 统一提取结果格式

**实现要求**:
```typescript
// 伪代码示例
interface Extractor {
  canExtract(url: string, buffer: Buffer): boolean;
  extract(url: string, buffer: Buffer): Promise<ExtractResult>;
}

function detectContentType(url: string, buffer: Buffer): 'html' | 'pdf' | 'other' {
  if (url.toLowerCase().endsWith('.pdf')) {
    return 'pdf';
  }
  
  const head = buffer.subarray(0, 256).toString('utf8').toLowerCase();
  if (head.includes('<html') || head.includes('<!doctype html')) {
    return 'html';
  }
  
  return 'other';
}
```

**验收标准**:
- [ ] 接口定义清晰
- [ ] 内容类型检测正确

---

### 3. Chunkers 模块

#### 3.1 Text Chunker（文本分片）

**实现检查项**:
- [ ] 实现文本分片算法
- [ ] 支持多语言分片策略
- [ ] 保持语义完整性
- [ ] 支持重叠

**实现要求**:
```typescript
// 伪代码示例
interface ChunkOptions {
  minSize?: number;  // 默认 500
  maxSize?: number;  // 默认 800
  overlap?: number;  // 默认 50
}

function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const minSize = options.minSize || 500;
  const maxSize = options.maxSize || 800;
  const overlap = options.overlap || 50;
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxSize, text.length);
    let cut = end;
    
    // 尽量在句号/换行处裁切
    const slice = text.slice(start, end);
    const lastPeriod = slice.lastIndexOf('。');
    const lastDot = slice.lastIndexOf('.');
    const lastNewline = slice.lastIndexOf('\n');
    
    const cutIndex = Math.max(
      lastPeriod >= minSize ? lastPeriod + 1 : -1,
      lastDot >= minSize ? lastDot + 1 : -1,
      lastNewline >= minSize ? lastNewline + 1 : -1
    );
    
    if (cutIndex >= minSize) {
      cut = start + cutIndex;
    }
    
    chunks.push(text.slice(start, cut).trim());
    start = cut - overlap;  // 重叠
  }
  
  return chunks.filter(chunk => chunk.length >= minSize);
}
```

**验收标准**:
- [ ] 分片大小正确（500-800字符）
- [ ] 在句号/换行处裁切
- [ ] 重叠处理正确
- [ ] 多语言支持正确

---

### 4. Ingesters 模块

#### 4.1 DriveQuiz Client（DriveQuiz API 客户端）

**实现检查项**:
- [ ] 实现 DriveQuiz API 客户端
- [ ] 支持单文档上传
- [ ] 支持批量文档上传
- [ ] 支持操作记录查询
- [ ] 错误处理完整

**实现要求**:
```typescript
// 伪代码示例
interface DriveQuizClientOptions {
  baseUrl: string;
  token: string;
  timeout?: number;
}

class DriveQuizClient {
  constructor(private options: DriveQuizClientOptions) {}
  
  async uploadDocument(doc: Document): Promise<UploadResponse> {
    const response = await axios.post(
      `${this.options.baseUrl}/docs`,
      doc,
      {
        headers: {
          'Authorization': `Bearer ${this.options.token}`,
          'Content-Type': 'application/json'
        },
        timeout: this.options.timeout || 15000
      }
    );
    
    return response.data;
  }
  
  async uploadBatch(docs: Document[]): Promise<BatchUploadResponse> {
    const response = await axios.post(
      `${this.options.baseUrl}/docs/batch`,
      { docs },
      {
        headers: {
          'Authorization': `Bearer ${this.options.token}`,
          'Content-Type': 'application/json'
        },
        timeout: this.options.timeout || 30000
      }
    );
    
    return response.data;
  }
}
```

**验收标准**:
- [ ] API 客户端正常工作
- [ ] 单文档上传成功
- [ ] 批量上传成功
- [ ] 错误处理正确

---

#### 4.2 Batch Processor（批量处理）

**实现检查项**:
- [ ] 批量文档处理
- [ ] 批量上传到 DriveQuiz API
- [ ] 支持部分成功
- [ ] 错误统计

**实现要求**:
```typescript
// 伪代码示例
class BatchProcessor {
  constructor(
    private client: DriveQuizClient,
    private batchSize: number = 50
  ) {}
  
  async processBatch(docs: Document[]): Promise<BatchResult> {
    const batches = this.chunkArray(docs, this.batchSize);
    const results: BatchResult = {
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const batch of batches) {
      try {
        const response = await this.client.uploadBatch(batch);
        results.success += response.processed || 0;
        results.failed += response.failed || 0;
      } catch (error) {
        results.failed += batch.length;
        results.errors.push(error);
      }
    }
    
    return results;
  }
}
```

**验收标准**:
- [ ] 批量处理正确
- [ ] 部分成功处理正确
- [ ] 错误统计正确

---

#### 4.3 Retry Handler（重试处理）

**实现检查项**:
- [ ] 实现指数退避重试
- [ ] 支持最大重试次数
- [ ] 记录重试日志
- [ ] 错误分类（可重试/不可重试）

**实现要求**:
```typescript
// 伪代码示例
interface RetryOptions {
  maxRetries?: number;  // 默认 3
  baseDelay?: number;   // 默认 1000ms
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      
      if (!isRetryableError(error)) {
        throw error;
      }
      
      const delay = Math.pow(2, i) * baseDelay;
      await sleep(delay);
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

**验收标准**:
- [ ] 重试机制正常工作
- [ ] 指数退避正确
- [ ] 错误分类正确

---

### 5. Services 模块

#### 5.1 Crawl Service（爬取服务）

**实现检查项**:
- [ ] 协调爬取流程
- [ ] 调用 Crawler、Extractor、Chunker 模块
- [ ] 错误处理和日志记录

**实现要求**:
```typescript
// 伪代码示例
class CrawlService {
  constructor(
    private fetcher: Fetcher,
    private extractor: Extractor,
    private chunker: TextChunker,
    private scheduler: CrawlScheduler
  ) {}
  
  async crawlSource(source: SourceConfig): Promise<Document[]> {
    const documents: Document[] = [];
    const queue = [...source.seeds];
    
    while (queue.length > 0) {
      const url = queue.shift()!;
      
      try {
        // 1. 抓取
        const buffer = await this.fetcher.fetch(url);
        
        // 2. 提取
        const { title, text } = await this.extractor.extract(url, buffer);
        
        // 3. 分片
        const chunks = this.chunker.chunk(text);
        
        // 4. 创建文档
        chunks.forEach((content, index) => {
          documents.push({
            title: `${title} #${index + 1}`,
            url,
            content,
            version: source.version,
            lang: source.lang,
            meta: {
              sourceId: source.id,
              type: source.type,
              chunkIndex: index + 1,
              totalChunks: chunks.length
            }
          });
        });
        
        // 5. 发现链接（仅 HTML）
        if (this.extractor.canExtract(url, buffer)) {
          const links = await this.discoverer.discover(url, buffer);
          links.forEach(link => {
            if (!this.scheduler.isVisited(link)) {
              queue.push(link);
            }
          });
        }
      } catch (error) {
        logger.error('Crawl failed', { url, error });
      }
    }
    
    return documents;
  }
}
```

**验收标准**:
- [ ] 爬取流程正常
- [ ] 错误处理正确
- [ ] 日志记录完整

---

#### 5.2 Ingest Service（入库服务）

**实现检查项**:
- [ ] 协调入库流程
- [ ] 调用 DriveQuiz Client
- [ ] 操作记录管理
- [ ] 错误处理

**实现要求**:
```typescript
// 伪代码示例
class IngestService {
  constructor(
    private client: DriveQuizClient,
    private batchProcessor: BatchProcessor,
    private logger: OperationLogger
  ) {}
  
  async ingestDocuments(documents: Document[], sourceId: string): Promise<IngestResult> {
    const operationId = generateOperationId();
    
    try {
      // 1. 批量上传
      const result = await this.batchProcessor.processBatch(documents);
      
      // 2. 记录操作
      await this.logger.logOperation({
        operationId,
        sourceId,
        status: 'success',
        docsCount: documents.length,
        successCount: result.success,
        failedCount: result.failed
      });
      
      return {
        operationId,
        success: result.success,
        failed: result.failed
      };
    } catch (error) {
      // 记录失败
      await this.logger.logOperation({
        operationId,
        sourceId,
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
}
```

**验收标准**:
- [ ] 入库流程正常
- [ ] 操作记录正确
- [ ] 错误处理正确

---

#### 5.3 Operation Logger（操作记录服务）

**实现检查项**:
- [ ] 记录操作历史
- [ ] 查询操作记录
- [ ] 本地日志存储

**实现要求**:
```typescript
// 伪代码示例
interface Operation {
  operationId: string;
  sourceId: string;
  status: 'success' | 'failed';
  docsCount: number;
  successCount: number;
  failedCount: number;
  createdAt: Date;
  error?: string;
}

class OperationLogger {
  private operations: Operation[] = [];
  
  async logOperation(operation: Operation): Promise<void> {
    this.operations.push(operation);
    
    // 保存到本地文件或数据库
    await this.saveToFile(operation);
  }
  
  async getOperations(filter?: OperationFilter): Promise<Operation[]> {
    // 查询操作记录
    return this.operations.filter(op => {
      if (filter?.sourceId && op.sourceId !== filter.sourceId) {
        return false;
      }
      if (filter?.status && op.status !== filter.status) {
        return false;
      }
      return true;
    });
  }
}
```

**验收标准**:
- [ ] 操作记录正确
- [ ] 查询功能正常
- [ ] 本地存储正确

---

### 6. Utils 模块

#### 6.1 Logger（日志工具）

**实现检查项**:
- [ ] 结构化日志（使用 winston）
- [ ] 支持多个日志级别
- [ ] 日志文件输出
- [ ] 日志格式统一（JSON）

**实现要求**:
```typescript
// 伪代码示例
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export default logger;
```

**验收标准**:
- [ ] 日志记录正确
- [ ] 日志级别正确
- [ ] 日志文件输出正确

---

#### 6.2 Validator（配置验证）

**实现检查项**:
- [ ] 配置文件验证（使用 zod）
- [ ] 环境变量验证
- [ ] 清晰的错误信息

**实现要求**:
```typescript
// 伪代码示例
import { z } from 'zod';

const SourceConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['official', 'organization', 'education']),
  lang: z.enum(['ja', 'zh', 'en']),
  version: z.string(),
  seeds: z.array(z.string().url()),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  maxDepth: z.number().optional(),
  maxPages: z.number().optional()
});

export function validateSourceConfig(config: unknown): SourceConfig {
  return SourceConfigSchema.parse(config);
}
```

**验收标准**:
- [ ] 配置验证正确
- [ ] 错误信息清晰

---

#### 6.3 Hasher（内容哈希）

**实现检查项**:
- [ ] 计算内容哈希（SHA-256）
- [ ] 用于去重

**实现要求**:
```typescript
// 伪代码示例
import crypto from 'crypto';

export function hashContent(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
```

**验收标准**:
- [ ] 哈希计算正确
- [ ] 用于去重正确

---

#### 6.4 Encoder（编码检测和转换）

**实现检查项**:
- [ ] 检测编码（UTF-8、Shift-JIS）
- [ ] 编码转换

**实现要求**:
```typescript
// 伪代码示例
import iconv from 'iconv-lite';

export function detectEncoding(buffer: Buffer): 'utf8' | 'shift-jis' {
  const head = buffer.subarray(0, 256).toString('utf8');
  
  if (/charset=shift_jis|shift-jis|sjis/i.test(head)) {
    return 'shift-jis';
  }
  
  return 'utf8';
}

export function convertEncoding(buffer: Buffer, encoding: string): string {
  if (encoding === 'utf8') {
    return buffer.toString('utf8');
  }
  
  return iconv.decode(buffer, encoding);
}
```

**验收标准**:
- [ ] 编码检测正确
- [ ] 编码转换正确

---

## DriveQuiz API 集成

### API 端点

**Base URL**: `https://your-drivequiz-domain.com/api/v1/rag`

**核心端点**:
1. `GET /health` - 健康检查
2. `POST /docs` - 单文档上传
3. `POST /docs/batch` - 批量文档上传（推荐）
4. `GET /operations` - 操作记录查询
5. `GET /operations/{operationId}` - 操作详情查询

详细规范见：[DriveQuiz API 规范](./drivequiz-api-spec.md)

### 认证方式

**Bearer Token**:
```
Authorization: Bearer {API_TOKEN}
```

**环境变量**:
```bash
DRIVEQUIZ_API_URL=https://your-drivequiz-domain.com/api/v1/rag
DRIVEQUIZ_API_TOKEN=your_api_token_here
```

### 集成流程

```
1. 抓取文档 → 提取内容 → 分片
2. 批量上传到 DriveQuiz API
3. 记录操作结果
4. 查询操作状态（可选）
```

### 错误处理

**重试策略**:
- 指数退避重试（最多3次）
- 可重试错误：网络错误、5xx 错误
- 不可重试错误：4xx 错误（认证失败等）

**错误响应**:
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

---

## 文档审核功能

### 功能概述

**需求**: 每个文档在上传前需要人工审核和批准。

**流程**:
```
爬取 → 提取 → 分片 → 保存到审核队列 → 人工审核 → 批准上传 → 批量上传
```

### 审核模式

#### 模式 1: 预览模式（推荐）

**特点**:
- 抓取后保存到审核队列（本地数据库/文件）
- 生成预览报告
- 用户审核每个文档
- 批准后批量上传

**环境变量**:
```bash
PREVIEW_MODE=true  # 启用预览模式
REVIEW_REQUIRED=true  # 需要审核
```

---

### 审核存储设计

#### 1. 审核数据库表结构

```sql
CREATE TABLE review_queue (
  id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(100) NOT NULL,
  
  -- 文档信息
  title VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  version VARCHAR(50) NOT NULL,
  lang VARCHAR(10) NOT NULL,
  
  -- 元数据
  metadata JSONB,
  
  -- 审核状态
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(100),
  review_notes TEXT,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 索引
  INDEX idx_source_id (source_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### 2. 本地文件存储（可选）

**目录结构**:
```
data/
├── review/
│   ├── pending/          # 待审核文档
│   │   ├── {source_id}_{timestamp}.json
│   ├── approved/         # 已批准文档（待上传）
│   │   ├── {source_id}_{timestamp}.json
│   └── rejected/         # 已拒绝文档
│       ├── {source_id}_{timestamp}.json
```

---

### 审核流程实现

#### 1. 审核服务模块

**文件**: `src/services/review-service.ts`

**实现检查项**:
- [ ] 保存文档到审核队列
- [ ] 查询待审核文档
- [ ] 批准/拒绝文档
- [ ] 生成预览报告
- [ ] 批量导出已批准文档

**实现要求**:
```typescript
// 伪代码示例
interface ReviewDocument {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  content: string;
  contentHash: string;
  version: string;
  lang: string;
  meta: object;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

class ReviewService {
  // 保存到审核队列
  async saveForReview(documents: Document[], sourceId: string): Promise<void> {
    for (const doc of documents) {
      await this.reviewQueue.save({
        ...doc,
        sourceId,
        status: 'pending'
      });
    }
  }
  
  // 查询待审核文档
  async getPendingDocuments(sourceId?: string): Promise<ReviewDocument[]> {
    return this.reviewQueue.find({
      status: 'pending',
      ...(sourceId && { sourceId })
    });
  }
  
  // 批准文档
  async approveDocument(documentId: string, reviewedBy: string, notes?: string): Promise<void> {
    await this.reviewQueue.update(documentId, {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNotes: notes
    });
  }
  
  // 拒绝文档
  async rejectDocument(documentId: string, reviewedBy: string, reason: string): Promise<void> {
    await this.reviewQueue.update(documentId, {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy,
      reviewNotes: reason
    });
  }
  
  // 批量批准
  async approveBatch(documentIds: string[], reviewedBy: string): Promise<void> {
    for (const id of documentIds) {
      await this.approveDocument(id, reviewedBy);
    }
  }
  
  // 获取已批准文档（用于上传）
  async getApprovedDocuments(sourceId?: string): Promise<ReviewDocument[]> {
    return this.reviewQueue.find({
      status: 'approved',
      ...(sourceId && { sourceId })
    });
  }
  
  // 生成预览报告
  async generatePreviewReport(sourceId?: string): Promise<PreviewReport> {
    const pending = await this.getPendingDocuments(sourceId);
    const approved = await this.getApprovedDocuments(sourceId);
    const rejected = await this.reviewQueue.find({
      status: 'rejected',
      ...(sourceId && { sourceId })
    });
    
    return {
      total: pending.length + approved.length + rejected.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      documents: pending.map(doc => ({
        id: doc.id,
        title: doc.title,
        url: doc.url,
        contentLength: doc.content.length,
        preview: doc.content.substring(0, 200) + '...'
      }))
    };
  }
}
```

**验收标准**:
- [ ] 文档正确保存到审核队列
- [ ] 查询功能正常
- [ ] 批准/拒绝功能正常
- [ ] 预览报告生成正确

---

### 审核界面设计

#### 方案 1: 命令行界面（CLI）

**实现检查项**:
- [ ] 列出待审核文档
- [ ] 查看单个文档详情
- [ ] 批准/拒绝文档
- [ ] 批量操作
- [ ] 导出预览报告

**实现要求**:
```typescript
// 伪代码示例
// src/scripts/review-cli.ts

import { Command } from 'commander';
import { ReviewService } from '../services/review-service';

const program = new Command();
const reviewService = new ReviewService();

program
  .command('list')
  .description('列出待审核文档')
  .option('-s, --source <sourceId>', '按源过滤')
  .action(async (options) => {
    const docs = await reviewService.getPendingDocuments(options.source);
    console.table(docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
      contentLength: doc.content.length
    })));
  });

program
  .command('view <id>')
  .description('查看文档详情')
  .action(async (id) => {
    const doc = await reviewService.getDocument(id);
    console.log('标题:', doc.title);
    console.log('URL:', doc.url);
    console.log('内容长度:', doc.content.length);
    console.log('\n内容预览:');
    console.log(doc.content.substring(0, 500));
  });

program
  .command('approve <id>')
  .description('批准文档')
  .option('-n, --notes <notes>', '审核备注')
  .action(async (id, options) => {
    await reviewService.approveDocument(id, getCurrentUser(), options.notes);
    console.log('文档已批准');
  });

program
  .command('reject <id>')
  .description('拒绝文档')
  .requiredOption('-r, --reason <reason>', '拒绝原因')
  .action(async (id, options) => {
    await reviewService.rejectDocument(id, getCurrentUser(), options.reason);
    console.log('文档已拒绝');
  });

program
  .command('batch-approve')
  .description('批量批准')
  .option('-s, --source <sourceId>', '按源过滤')
  .action(async (options) => {
    const docs = await reviewService.getPendingDocuments(options.source);
    const ids = docs.map(d => d.id);
    await reviewService.approveBatch(ids, getCurrentUser());
    console.log(`已批准 ${ids.length} 个文档`);
  });

program
  .command('report')
  .description('生成预览报告')
  .option('-o, --output <file>', '输出文件路径')
  .action(async (options) => {
    const report = await reviewService.generatePreviewReport();
    const output = JSON.stringify(report, null, 2);
    
    if (options.output) {
      fs.writeFileSync(options.output, output);
      console.log(`报告已保存到 ${options.output}`);
    } else {
      console.log(output);
    }
  });

program.parse();
```

**使用示例**:
```bash
# 列出待审核文档
pnpm review list

# 查看文档详情
pnpm review view doc_123

# 批准文档
pnpm review approve doc_123 --notes "内容相关，批准上传"

# 拒绝文档
pnpm review reject doc_123 --reason "内容不相关"

# 批量批准某个源的所有文档
pnpm review batch-approve --source gov_npa_driving

# 生成预览报告
pnpm review report --output report.json
```

**验收标准**:
- [ ] CLI 命令正常工作
- [ ] 文档列表显示正确
- [ ] 文档详情查看正确
- [ ] 批准/拒绝功能正常
- [ ] 批量操作正常

---

#### 方案 2: Web 界面（可选）

**实现检查项**:
- [ ] Web 界面显示待审核文档
- [ ] 文档详情查看
- [ ] 批准/拒绝操作
- [ ] 批量操作
- [ ] 预览报告展示

**技术栈建议**:
- 前端：React/Vue + 简单 UI 框架
- 后端：Express/Koa（提供 API）
- 数据库：SQLite/PostgreSQL

---

### 审核后的上传流程

#### 修改后的主流程

```typescript
// 伪代码示例
async function main() {
  const sources = loadSources();
  const reviewService = new ReviewService();
  const ingestService = new IngestService();
  
  for (const source of sources) {
    // 1. 爬取
    const documents = await crawlService.crawlSource(source);
    
    // 2. 如果启用预览模式，保存到审核队列
    if (process.env.PREVIEW_MODE === 'true') {
      await reviewService.saveForReview(documents, source.id);
      console.log(`已保存 ${documents.length} 个文档到审核队列`);
      console.log('请使用 review 命令审核文档');
      continue;
    }
    
    // 3. 如果不需要审核，直接上传
    if (process.env.REVIEW_REQUIRED !== 'true') {
      await ingestService.ingestDocuments(documents, source.id);
      continue;
    }
    
    // 4. 如果需要审核，等待审核完成
    // 这部分可以通过定时任务或手动触发
  }
  
  // 5. 上传已批准的文档
  if (process.env.UPLOAD_APPROVED === 'true') {
    for (const source of sources) {
      const approvedDocs = await reviewService.getApprovedDocuments(source.id);
      if (approvedDocs.length > 0) {
        await ingestService.ingestDocuments(approvedDocs, source.id);
        console.log(`已上传 ${approvedDocs.length} 个已批准文档`);
      }
    }
  }
}
```

---

### 审核功能配置

#### 环境变量

```bash
# 审核模式配置
PREVIEW_MODE=true          # 启用预览模式（抓取后保存到审核队列）
REVIEW_REQUIRED=true       # 需要审核（默认 false）
UPLOAD_APPROVED=true       # 上传已批准的文档（默认 false）

# 审核数据库配置
REVIEW_DB_PATH=./data/review.db  # SQLite 数据库路径
REVIEW_STORAGE=file              # 存储方式：'file' 或 'database'
```

#### package.json 脚本

```json
{
  "scripts": {
    "crawl": "tsx scripts/crawl-and-ingest.ts",
    "crawl:preview": "PREVIEW_MODE=true tsx scripts/crawl-and-ingest.ts",
    "review": "tsx scripts/review-cli.ts",
    "review:list": "tsx scripts/review-cli.ts list",
    "review:approve": "tsx scripts/review-cli.ts approve",
    "review:report": "tsx scripts/review-cli.ts report",
    "upload:approved": "UPLOAD_APPROVED=true tsx scripts/upload-approved.ts"
  }
}
```

---

### 审核功能实现清单

#### 核心功能（必须实现）

- [ ] **ReviewService**: 审核服务模块
  - [ ] 保存文档到审核队列
  - [ ] 查询待审核文档
  - [ ] 批准/拒绝文档
  - [ ] 批量批准
  - [ ] 获取已批准文档
  - [ ] 生成预览报告

- [ ] **审核存储**: 本地数据库或文件存储
  - [ ] SQLite 数据库（推荐）
  - [ ] 或 JSON 文件存储

- [ ] **审核 CLI**: 命令行审核工具
  - [ ] 列出待审核文档
  - [ ] 查看文档详情
  - [ ] 批准/拒绝文档
  - [ ] 批量操作
  - [ ] 生成预览报告

#### 辅助功能（建议实现）

- [ ] **预览报告**: 生成 HTML/JSON 预览报告
- [ ] **审核统计**: 统计审核数量、通过率等
- [ ] **审核历史**: 记录审核历史

#### 可选功能（长期优化）

- [ ] **Web 界面**: 提供 Web 审核界面
- [ ] **审核规则**: 自动审核规则（基于关键词等）
- [ ] **审核通知**: 审核完成通知

---

### 审核工作流程

#### 完整流程

```
1. 抓取阶段
   pnpm crawl:preview
   → 抓取文档
   → 保存到审核队列
   → 生成预览报告

2. 审核阶段
   pnpm review list          # 查看待审核文档
   pnpm review view <id>     # 查看文档详情
   pnpm review approve <id>  # 批准文档
   pnpm review reject <id>   # 拒绝文档
   pnpm review report        # 生成预览报告

3. 上传阶段
   pnpm upload:approved      # 上传已批准的文档
   → 批量上传到 DriveQuiz API
   → 记录操作历史
```

---

### 审核功能测试要求

#### 单元测试

- [ ] ReviewService 单元测试
- [ ] 审核存储单元测试
- [ ] 审核 CLI 单元测试

#### 集成测试

- [ ] 完整审核流程测试
- [ ] 审核后上传测试

#### 验收标准

- [ ] 文档正确保存到审核队列
- [ ] 审核功能正常工作
- [ ] 预览报告生成正确
- [ ] 已批准文档正确上传

---

## 配置管理

### 配置文件

#### 1. sources.json（抓取源配置）

```json
[
  {
    "id": "gov_npa_driving",
    "title": "警察庁 外国免許 FAQ",
    "type": "official",
    "lang": "ja",
    "version": "2025Q1",
    "seeds": [
      "https://www.npa.go.jp/bureau/traffic/license/"
    ],
    "include": ["license", "menkyo", "faq"],
    "exclude": ["search", "pdficon"],
    "maxDepth": 2,
    "maxPages": 50
  }
]
```

#### 2. default.json（默认配置）

```json
{
  "crawler": {
    "concurrency": 4,
    "delayMs": 400,
    "maxRetries": 3,
    "timeoutMs": 15000,
    "userAgent": "DatapullBot/1.0"
  },
  "chunking": {
    "minSize": 500,
    "maxSize": 800,
    "overlap": 50
  },
  "ingestion": {
    "batchSize": 50,
    "maxRetries": 3,
    "retryDelayMs": 1000
  }
}
```

### 环境变量

```bash
# DriveQuiz API 配置
DRIVEQUIZ_API_URL=https://your-drivequiz-domain.com/api/v1/rag
DRIVEQUIZ_API_TOKEN=your_api_token_here

# 爬虫配置
CRAWL_CONCURRENCY=4
CRAWL_DELAY_MS=400
CRAWL_MAX_RETRIES=3
CRAWL_TIMEOUT_MS=15000

# 分片配置
CHUNK_MIN_SIZE=500
CHUNK_MAX_SIZE=800

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/datapull.log

# 运行时配置
DRY_RUN=false
MAX_PAGES_PER_SOURCE=100
MAX_CRAWL_DEPTH=3
```

---

## 错误处理

### 错误分类

**网络错误**:
- 连接超时
- DNS 解析失败
- 网络不可达

**HTTP 错误**:
- 4xx: 客户端错误（认证失败、参数错误等）
- 5xx: 服务器错误（可重试）

**内容错误**:
- 编码错误
- 提取失败
- 内容为空

### 错误处理策略

**重试机制**:
- 指数退避重试（1s, 2s, 4s）
- 最多重试3次
- 可重试错误：网络错误、5xx 错误

**错误记录**:
- 记录错误日志
- 记录操作失败
- 支持错误查询

---

## 测试要求

### 单元测试

- [ ] 每个模块都有单元测试
- [ ] 测试覆盖率达到 80% 以上
- [ ] 测试各种边界情况

### 集成测试

- [ ] 测试完整的抓取流程
- [ ] 测试 DriveQuiz API 集成
- [ ] 测试错误处理

### 端到端测试

- [ ] 测试完整流程（抓取 → 提取 → 分片 → 上传）
- [ ] 测试多个抓取源
- [ ] 测试批量上传

### 性能测试

- [ ] 测试并发抓取性能
- [ ] 测试批量上传性能
- [ ] 测试内存使用

---

## 开发流程

### 1. 环境准备

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 配置抓取源
# 编辑 config/sources.json
```

### 2. 开发

```bash
# 开发模式（热重载）
pnpm dev

# 类型检查
pnpm type-check

# 代码检查
pnpm lint

# 格式化代码
pnpm format
```

### 3. 测试

```bash
# 运行测试
pnpm test

# 测试覆盖率
pnpm test:coverage
```

### 4. 构建

```bash
# 构建项目
pnpm build

# 运行生产版本
pnpm start

# Dry run（不实际上传）
DRY_RUN=1 pnpm start
```

---

## 部署指南

### 本地部署

```bash
# 1. 克隆代码
git clone <repository-url>
cd datapull

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 配置抓取源
# 编辑 config/sources.json

# 5. 构建
pnpm build

# 6. 运行
pnpm start
```

### Docker 部署

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .
RUN pnpm build

CMD ["pnpm", "start"]
```

### 定时任务

使用 cron 或 systemd timer 定期运行：

```bash
# 每天凌晨 2 点运行
0 2 * * * cd /path/to/datapull && pnpm start
```

---

## 交付清单

### 必须交付

- [ ] 所有核心模块实现完成
- [ ] Crawler 模块（Fetcher、Discoverer、Scheduler）
- [ ] Extractors 模块（HTML、PDF、Base）
- [ ] Chunkers 模块（Text Chunker）
- [ ] Ingesters 模块（DriveQuiz Client、Batch Processor、Retry Handler）
- [ ] Services 模块（Crawl Service、Ingest Service、Operation Logger）
- [ ] Utils 模块（Logger、Validator、Hasher、Encoder）
- [ ] DriveQuiz API 集成完成
- [ ] 配置验证完成
- [ ] 错误处理完成
- [ ] 单元测试和集成测试完成
- [ ] 文档更新完成

### 建议交付

- [ ] 性能测试报告
- [ ] 部署文档
- [ ] 运维手册

---

## 附录

### A. 参考文档

- [项目结构文档](./project-structure.md)
- [DriveQuiz API 规范](./drivequiz-api-spec.md)
- [DriveQuiz 集成联调清单](./drivequiz-integration-checklist.md)

### B. 示例代码

请参考各模块的实现要求部分。

### C. 常见问题

#### Q: 如何处理编码问题？

A: 使用 `encoder.ts` 模块检测和转换编码，支持 UTF-8 和 Shift-JIS。

#### Q: 如何处理重复内容？

A: 使用 `hasher.ts` 计算内容哈希，基于 URL + contentHash + version 判断重复。

#### Q: 如何调试爬取问题？

A: 设置 `LOG_LEVEL=debug` 查看详细日志，使用 `DRY_RUN=1` 测试不实际上传。

---

**文档版本**: v1.0.0  
**最后更新**: 2025-01-06

