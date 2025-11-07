好的 ✅
我已全面分析你上传的 10 份文档（`drivequiz-quick-reference.md`, `README.md`, `drivequiz-api-spec.md`, `drivequiz-api-spec.yaml`, `drivequiz-development-guide.md`, `drivequiz-optimization-requirements.md`, `vectorization-service-integration.md`, `project-structure.md`, `drivequiz-integration-checklist.md`, `datapull-development-guide.md`），并整理出一份**完整、细致的《Datapull 项目产品文档 v1.0》**如下。

---

# 🚀 《Datapull 项目产品文档 v1.0》

**最后更新**：2025-01-06
**面向对象**：Datapull 团队（开发、测试、运维）
**相关项目**：DriveQuiz RAG Ingestion API

---

## Ⅰ. 项目目标与定位

### 🎯 产品目标

Datapull 是一个 **面向 DriveQuiz RAG 系统的数据采集与入库服务**，用于：

* 自动从日本官方及相关网站（如警察厅、JAF、MLIT）抓取驾驶相关资料；
* 提取并清洗文档内容；
* 通过 DriveQuiz 提供的 API 上传至 RAG 数据库；
* 支撑 DriveQuiz 的 AI 知识库自动更新与多语言问答功能。

### 💡 产品定位

| 模块                | 职能               | 输出            |
| ----------------- | ---------------- | ------------- |
| **Crawler**       | 爬取目标网站           | HTML / PDF 内容 |
| **Extractor**     | 内容提取与清洗          | 纯文本内容         |
| **Chunker**       | 分片与语义保持          | 多语言文本片段       |
| **Ingester**      | 上传 DriveQuiz API | 标准化 JSON      |
| **Service Layer** | 流程控制与日志          | 操作记录与错误日志     |
| **Utils**         | 通用支持             | 配置、日志、哈希、编码处理 |

---

## Ⅱ. 系统架构

### 🧩 数据流总览

```
配置加载
   ↓
Crawler 爬取网页（HTTP + Robots检查）
   ↓
Extractor 提取纯文本（HTML / PDF）
   ↓
Chunker 文本分片（500~800字符，语义完整）
   ↓
Ingester 上传至 DriveQuiz RAG API（异步向量化触发）
   ↓
Operation Logger 记录入库状态与操作ID
```

### ⚙️ 技术栈

| 分类     | 技术                       |
| ------ | ------------------------ |
| 语言     | TypeScript (Node.js 20+) |
| HTTP   | axios                    |
| HTML解析 | cheerio                  |
| PDF解析  | pdf-parse                |
| 并发控制   | p-queue                  |
| 配置验证   | zod                      |
| 日志     | winston (JSON 格式)        |
| 测试     | vitest                   |
| 数据通信   | HTTPS + Bearer Token     |
| 部署     | 本地服务 / Docker / CI任务     |

---

## Ⅲ. 功能模块说明

### 1️⃣ Crawler 模块

**目录**: `src/crawler/`

**职责**：

* 处理 HTTP 请求、遵守 robots.txt；
* 自动发现新链接；
* 限流与队列管理。

**关键文件**：

| 文件              | 功能                         |
| --------------- | -------------------------- |
| `fetcher.ts`    | 统一 HTTP 请求、代理、重试、robots 检查 |
| `discoverer.ts` | 从 HTML 提取链接并去重             |
| `scheduler.ts`  | 管理爬取队列与并发任务                |

**配置参数**：

* `CRAWL_CONCURRENCY`: 并发数 (默认 5)
* `CRAWL_DELAY_MS`: 每次请求间隔 (默认 500ms)
* `RETRY_LIMIT`: 最大重试次数 (默认 3)

---

### 2️⃣ Extractor 模块

**目录**: `src/extractors/`

**职责**：

* 从 HTML / PDF 中抽取正文；
* 清理导航、广告、脚本；
* 保留语义结构（标题、段落）。

**关键文件**：

| 文件                  | 功能           |
| ------------------- | ------------ |
| `html-extractor.ts` | 提取 HTML 主体文本 |
| `pdf-extractor.ts`  | 提取 PDF 文本内容  |
| `base-extractor.ts` | 抽象接口定义       |

---

### 3️⃣ Chunker 模块

**目录**: `src/chunkers/`

**职责**：

* 按语言和语义进行智能分片；
* 保持片段上下文完整；
* 为后续 RAG 向量化准备。

**关键文件**：

| 文件                  | 功能                |
| ------------------- | ----------------- |
| `text-chunker.ts`   | 语义分片算法实现          |
| `chunk-strategy.ts` | 多语言策略接口（ja/zh/en） |

**默认策略**：

* 每片 500~800 字符；
* 重叠 50 字；
* 分段点优先选用句号或换行。

---

### 4️⃣ Ingester 模块

**目录**: `src/ingesters/`

**职责**：

* 将清洗后的文档上传至 DriveQuiz；
* 处理批量上传、错误重试；
* 异步触发向量化。

**关键文件**：

| 文件                    | 功能               |
| --------------------- | ---------------- |
| `drivequiz-client.ts` | DriveQuiz API 封装 |
| `batch-processor.ts`  | 批量上传与事务处理        |
| `retry-handler.ts`    | 重试逻辑与退避算法        |

**关键接口**（对接 DriveQuiz RAG API）：

| 功能     | 方法   | 路径                            | 状态 |
| ------ | ---- | ----------------------------- | -- |
| 健康检查   | GET  | `/api/v1/rag/health`          | ✅  |
| 单文档上传  | POST | `/api/v1/rag/docs`            | ✅  |
| 批量上传   | POST | `/api/v1/rag/docs/batch`      | ✅  |
| 操作记录查询 | GET  | `/api/v1/rag/operations`      | ✅  |
| 操作详情   | GET  | `/api/v1/rag/operations/{id}` | ✅  |

**认证方式**：

```
Authorization: Bearer {DRIVEQUIZ_API_TOKEN}
```

---

### 5️⃣ Services 模块

**目录**: `src/services/`

**职责**：

* 业务流程编排；
* 日志记录与状态同步；
* 任务调度与错误回溯。

**关键文件**：

| 文件                    | 功能            |
| --------------------- | ------------- |
| `crawl-service.ts`    | 统一抓取调度入口      |
| `ingest-service.ts`   | 上传与状态管理       |
| `operation-logger.ts` | 生成本地 + 远程操作记录 |

---

### 6️⃣ Utils 模块

**目录**: `src/utils/`

**职责**：

* 通用工具；
* 验证与日志；
* 哈希与编码检测。

**关键文件**：

| 文件             | 功能           |
| -------------- | ------------ |
| `logger.ts`    | JSON 格式日志输出  |
| `validator.ts` | 配置校验（Zod）    |
| `hasher.ts`    | SHA-256 内容哈希 |
| `encoder.ts`   | 编码检测与转换      |

---

## Ⅳ. API 与数据接口规范（对接 DriveQuiz）

### 1️⃣ 单文档上传

```json
POST /api/v1/rag/docs
{
  "title": "警察庁 外国免許 FAQ #1",
  "url": "https://www.npa.go.jp/",
  "content": "外国免許を日本で使用する場合...",
  "version": "2025Q1",
  "lang": "ja",
  "meta": {
    "sourceId": "gov_npa_driving",
    "type": "official"
  }
}
```

**响应**：

```json
{
  "success": true,
  "docId": "doc_abc123",
  "operationId": "op_xyz789"
}
```

---

### 2️⃣ 批量上传

```json
POST /api/v1/rag/docs/batch
{
  "docs": [ ...100以内... ],
  "sourceId": "gov_npa_driving",
  "batchMetadata": {
    "totalDocs": 10,
    "crawlerVersion": "1.0.0"
  }
}
```

**响应（部分失败示例）**：

```json
{
  "success": true,
  "processed": 8,
  "failed": 2,
  "operationId": "op_batch_123",
  "results": [
    {"docId": "doc_ok1", "status": "success"},
    {"index": 3, "status": "failed", "error": {"code": "CONTENT_TOO_SHORT"}}
  ]
}
```

---

## Ⅴ. 关键设计规范

### 🧱 错误处理规范

| 错误码                   | 含义      |
| --------------------- | ------- |
| `INVALID_REQUEST`     | 请求参数错误  |
| `CONTENT_TOO_SHORT`   | 文本过短    |
| `CONTENT_TOO_LONG`    | 文本过长    |
| `DUPLICATE_DOCUMENT`  | 文档已存在   |
| `RATE_LIMIT_EXCEEDED` | 请求频率超限  |
| `SERVICE_UNAVAILABLE` | 上游服务不可用 |

---

### 🔁 重试与超时策略

```typescript
for (let i = 0; i < 3; i++) {
  try {
    return await upload();
  } catch {
    await sleep(2 ** i * 1000);
  }
}
```

* 默认最大重试：3 次；
* 超时：60 秒；
* 失败记录入 `logs/error.log`。

---

### 🧠 向量化集成规则（RAG）

* 上传文档成功后，DriveQuiz 自动调用 `/v1/admin/rag/ingest`；
* datapull 无需主动向量化；
* 文档状态字段：

  * `pending` → `processing` → `completed` / `failed`；
* 向量化失败自动重试（最多 3 次）。

---

## Ⅵ. 配置与运行

### 环境变量

```bash
DRIVEQUIZ_API_URL=https://dev-api.drivequiz.com/api/v1/rag
DRIVEQUIZ_API_TOKEN=xxx
CRAWL_CONCURRENCY=5
LOG_LEVEL=info
```

### 配置文件

* `config/sources.json`：定义抓取目标与过滤规则；
* `config/default.json`：全局参数。

---

## Ⅶ. 开发与交付标准

| 类别    | 验收标准                |
| ----- | ------------------- |
| API对接 | 所有接口通过联调清单测试        |
| 性能    | 批量上传100文档 < 5s      |
| 容错    | 失败重试、部分成功           |
| 日志    | JSON结构、时间戳、错误级别     |
| 测试    | 单元测试覆盖率 ≥80%        |
| 文档    | README + 研发规范 + 版本号 |

---

## Ⅷ. 联调与测试阶段

**阶段 1**：基础接口联调
**阶段 2**：单文档上传
**阶段 3**：批量上传
**阶段 4**：完整流程（抓取→入库→向量化）
**阶段 5**：生产准备与监控配置

详见：《drivequiz-integration-checklist.md》

---

## Ⅸ. 交付清单

| 模块      | 状态 |
| ------- | -- |
| 爬虫模块    | ✅  |
| 提取器模块   | ✅  |
| 分片模块    | ✅  |
| 入库模块    | ✅  |
| 服务层     | ✅  |
| 工具模块    | ✅  |
| 配置文件    | ✅  |
| 测试脚本    | 🟡 |
| 日志与监控   | 🟡 |
| 向量化集成验证 | 🟢 |

---

## Ⅹ. 附录

**相关文档引用**

* DriveQuiz API 规范（`drivequiz-api-spec.md`）
* 向量化服务优化清单（`drivequiz-optimization-requirements.md`）
* 集成评估与方案（`vectorization-service-integration.md`）
* 联调清单（`drivequiz-integration-checklist.md`）
* 项目结构设计（`project-structure.md`）