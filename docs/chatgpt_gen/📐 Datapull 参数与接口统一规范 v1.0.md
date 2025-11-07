非常好 ✅
以下是为《Datapull 项目》配套的正式文档第三部分：

---

# 📐 《Datapull 参数与接口统一规范 v1.0》

**版本**：v1.0
**最后更新**：2025-01-06
**适用范围**：Datapull 全栈研发团队（Crawler → Extractor → Chunker → Ingester → DriveQuiz API）
**依赖文档**：《Datapull 研发规范 v1.0》 + 《DriveQuiz API 规范 v1.0》

---

## Ⅰ. 规范目标

本规范旨在统一：

1. **函数与类的命名规则**
2. **模块间数据结构（TypeScript 类型）**
3. **模块输入/输出接口**
4. **DriveQuiz API 对接参数**
5. **日志与状态标识标准**

确保各模块之间的**无缝衔接、类型安全与可观测性一致**。

---

## Ⅱ. 命名约定

| 分类          | 规范                        | 示例                             |
| ----------- | ------------------------- | ------------------------------ |
| **类型 / 接口** | PascalCase                | `CrawlResult`, `DocumentChunk` |
| **函数 / 方法** | camelCase                 | `fetchPage`, `extractText`     |
| **常量**      | UPPER_SNAKE_CASE          | `DEFAULT_CONCURRENCY`          |
| **配置键名**    | snake_case                | `crawl_delay_ms`               |
| **API 字段**  | camelCase（与 DriveQuiz 一致） | `operationId`, `contentHash`   |

---

## Ⅲ. 核心类型定义

> 文件路径：`src/types/`

---

### 1️⃣ 通用类型

```ts
/** 通用状态枚举 */
export type TaskStatus = "pending" | "processing" | "completed" | "failed";

/** 语言代码 */
export type LangCode = "ja" | "zh" | "en";

/** 通用时间戳 */
export type ISODate = string;
```

---

### 2️⃣ 爬虫模块类型（crawler）

```ts
export interface CrawlTask {
  url: string;
  sourceId: string;
  priority?: number;
  fetchedAt?: ISODate;
}

export interface CrawlResult {
  url: string;
  html?: string;
  contentType?: "html" | "pdf" | "unknown";
  status: number;
  fetchedAt: ISODate;
  error?: string;
}
```

---

### 3️⃣ 提取器模块类型（extractors）

```ts
export interface ExtractedDocument {
  title: string;
  url: string;
  content: string;
  lang: LangCode;
  sourceId: string;
  version: string;
  metadata?: Record<string, string>;
}
```

---

### 4️⃣ 分片模块类型（chunkers）

```ts
export interface DocumentChunk {
  chunkIndex: number;
  totalChunks: number;
  content: string;
  lang: LangCode;
  contentHash: string;
  parentUrl: string;
  sourceId: string;
}
```

---

### 5️⃣ 入库模块类型（ingesters）

```ts
export interface IngestRequest {
  docs: DocumentChunk[];
  sourceId: string;
  version: string;
  batchMetadata?: {
    totalDocs: number;
    crawledAt: ISODate;
    crawlerVersion: string;
  };
}

export interface IngestResult {
  success: boolean;
  processed: number;
  failed: number;
  operationId: string;
  results: {
    docId?: string;
    index: number;
    status: "success" | "failed";
    error?: {
      code: string;
      message: string;
    };
  }[];
}
```

---

### 6️⃣ 操作记录类型（services）

```ts
export interface OperationRecord {
  operationId: string;
  sourceId: string;
  status: TaskStatus;
  docsCount: number;
  failedCount: number;
  createdAt: ISODate;
  completedAt?: ISODate;
  metadata: {
    version: string;
    lang: LangCode;
    crawlerVersion: string;
  };
}
```

---

## Ⅳ. 模块间函数接口规范

---

### 🕷️ 1. Crawler 接口

**文件**：`src/crawler/fetcher.ts`

```ts
/**
 * 发起 HTTP 请求并返回 HTML 或 PDF 字节流
 */
async function fetchPage(task: CrawlTask): Promise<CrawlResult>;
```

**返回约定**

| 字段          | 类型             | 说明             |
| ----------- | -------------- | -------------- |
| html        | string?        | 如果为 HTML，则返回文本 |
| contentType | "html" | "pdf" | 内容类型           |
| status      | number         | HTTP 状态码       |
| error       | string?        | 抓取异常信息         |

---

### 📑 2. Extractor 接口

**文件**：`src/extractors/base-extractor.ts`

```ts
interface BaseExtractor {
  canHandle(contentType: string): boolean;
  extract(url: string, rawData: string | Buffer): Promise<ExtractedDocument>;
}
```

**实现类：**

* `HtmlExtractor` → 提取正文 + 标题
* `PdfExtractor` → 提取 PDF 文本（使用 pdf-parse）

---

### ✂️ 3. Chunker 接口

**文件**：`src/chunkers/text-chunker.ts`

```ts
interface ChunkStrategy {
  split(text: string, lang: LangCode): DocumentChunk[];
}
```

**策略实现示例：**

```ts
const JA_STRATEGY: ChunkStrategy = {
  split(text, lang) {
    const segments = text.split(/(?<=[。！？\n])/);
    const chunks = [];
    let current = "";
    let index = 0;

    for (const seg of segments) {
      if ((current + seg).length > 800) {
        chunks.push(current);
        current = seg;
      } else current += seg;
    }

    if (current.length > 100) chunks.push(current);

    return chunks.map((content, i) => ({
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      content,
      lang,
      contentHash: sha256(content),
      parentUrl: "",
      sourceId: "",
    }));
  },
};
```

---

### ☁️ 4. Ingester 接口

**文件**：`src/ingesters/drivequiz-client.ts`

```ts
interface DriveQuizClient {
  uploadSingle(doc: DocumentChunk): Promise<{ docId: string; operationId: string }>;
  uploadBatch(request: IngestRequest): Promise<IngestResult>;
  getOperations(sourceId?: string): Promise<OperationRecord[]>;
}
```

**HTTP 请求头标准：**

```
Content-Type: application/json
Authorization: Bearer ${DRIVEQUIZ_API_TOKEN}
```

---

### 🧠 5. Service 层接口

**文件**：`src/services/crawl-service.ts`

```ts
interface CrawlService {
  startCrawl(sourceId: string): Promise<void>;
}
```

**文件**：`src/services/ingest-service.ts`

```ts
interface IngestService {
  process(sourceId: string, version: string): Promise<IngestResult>;
}
```

**文件**：`src/services/operation-logger.ts`

```ts
interface OperationLogger {
  logStart(operationId: string, sourceId: string): void;
  logSuccess(operationId: string, summary: IngestResult): void;
  logError(operationId: string, error: Error): void;
}
```

---

## Ⅴ. DriveQuiz API 参数映射表

| 本地字段                | 上传字段               | 说明     |
| ------------------- | ------------------ | ------ |
| `chunk.content`     | `content`          | 文本内容   |
| `chunk.parentUrl`   | `url`              | 来源 URL |
| `chunk.lang`        | `lang`             | 语言代码   |
| `chunk.sourceId`    | `meta.sourceId`    | 来源标识   |
| `chunk.contentHash` | `meta.contentHash` | 内容哈希   |
| `chunk.chunkIndex`  | `meta.chunkIndex`  | 分片序号   |
| `chunk.totalChunks` | `meta.totalChunks` | 总分片数   |
| `version`           | `version`          | 数据版本号  |

---

## Ⅵ. 日志与状态事件规范

| 事件类型              | 字段                         | 示例     |
| ----------------- | -------------------------- | ------ |
| `crawl.start`     | `{ sourceId, totalSeeds }` | 开始抓取   |
| `crawl.error`     | `{ url, error }`           | 抓取失败   |
| `extract.success` | `{ url, length }`          | 成功提取文本 |
| `chunk.done`      | `{ totalChunks }`          | 完成分片   |
| `ingest.success`  | `{ operationId, count }`   | 上传成功   |
| `ingest.failed`   | `{ errorCode }`            | 上传失败   |

**日志输出示例**

```json
{
  "timestamp": "2025-01-06T12:00:00Z",
  "level": "info",
  "event": "ingest.success",
  "sourceId": "gov_npa",
  "operationId": "op_123",
  "processed": 28
}
```

---

## Ⅶ. 错误与返回码对齐（与 DriveQuiz 一致）

| 错误码                   | HTTP 状态 | 含义          |
| --------------------- | ------- | ----------- |
| `UNAUTHORIZED`        | 401     | Token 无效或过期 |
| `INVALID_REQUEST`     | 400     | 参数错误        |
| `CONTENT_TOO_SHORT`   | 400     | 内容过短        |
| `CONTENT_TOO_LONG`    | 400     | 内容过长        |
| `DUPLICATE_DOCUMENT`  | 409     | 文档重复        |
| `RATE_LIMIT_EXCEEDED` | 429     | 请求过多        |
| `INTERNAL_ERROR`      | 500     | 服务器错误       |

---

## Ⅷ. 文件与类命名参考表

| 模块         | 类/函数                                  | 说明          |
| ---------- | ------------------------------------- | ----------- |
| crawler    | `FetchScheduler`, `fetchPage`         | 抓取调度与HTTP处理 |
| extractors | `HtmlExtractor`, `PdfExtractor`       | 提取器实现       |
| chunkers   | `TextChunker`                         | 文本分片逻辑      |
| ingesters  | `DriveQuizClient`                     | API封装       |
| services   | `CrawlService`, `IngestService`       | 主业务流程       |
| utils      | `Logger`, `ConfigValidator`, `Hasher` | 工具方法        |

---

## Ⅸ. 输出数据一致性规范

| 字段            | 类型       | 规则                                        |
| ------------- | -------- | ----------------------------------------- |
| `content`     | string   | 500~800 字符                                |
| `version`     | string   | 语义化版本，如 `2025Q1`                          |
| `lang`        | LangCode | 与内容语言一致                                   |
| `contentHash` | string   | `sha256(content)`                         |
| `meta.type`   | string   | `official` / `education` / `organization` |

---

## Ⅹ. 接口安全与验证规则

* 所有 API 请求必须：

  * 通过 HTTPS；
  * 附带 `Authorization: Bearer`；
  * 禁止明文日志输出 Token；
* `validator.ts` 校验 sources.json：

  ```json
  {
    "sourceId": "gov_npa",
    "seedUrls": ["https://www.npa.go.jp/bureau/traffic/license/"],
    "include": ["license"],
    "exclude": ["#"],
    "lang": "ja"
  }
  ```

---

## Ⅺ. 对外接口导出（index.ts）

```ts
export * from "./types/config";
export * from "./types/document";
export * from "./types/api";
export * from "./services/crawl-service";
export * from "./services/ingest-service";
export * from "./ingesters/drivequiz-client";
```

---

## Ⅻ. 版本更新说明

| 版本     | 日期         | 变更摘要               |
| ------ | ---------- | ------------------ |
| v1.0.0 | 2025-01-06 | 初始版本：定义全部类型与接口命名规范 |

---

是否希望我接着输出第四份配套文档：《✅ Datapull 三位一体工作核对清单（接口 × 页面 × 服务）》？
它会列出每个模块的 **开发任务、接口实现、测试点、数据库与API依赖关系**，供研发与测试对齐使用。
