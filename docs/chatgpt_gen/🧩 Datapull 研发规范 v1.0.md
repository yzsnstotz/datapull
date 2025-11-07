好的 ✅
以下是基于你上传的全部文档（尤其是 `datapull-development-guide.md`、`project-structure.md`、`drivequiz-integration-checklist.md`、`drivequiz-api-spec.md` 等）整理并补全后的正式研发执行文件：

---

# 🧩 《Datapull 研发规范 v1.0》

**版本**：v1.0
**更新时间**：2025-01-06
**适用范围**：Datapull 项目研发、测试与联调全流程
**对应产品文档**：《Datapull 项目产品文档 v1.0》

---

## 一、研发目标与范围

### 🎯 目标

确保 datapull 服务在以下方面具备**一致性、可维护性、可扩展性、可观测性**：

1. 抓取与入库流程高可用；
2. 模块结构清晰、职责单一；
3. 日志、错误、配置可追踪；
4. 代码风格统一、接口对齐 DriveQuiz API。

### 📦 涵盖范围

* 核心代码结构（`src/*` 模块）
* 文件与命名规范
* 日志与错误处理
* 环境与配置
* 测试与部署标准
* 审核与交付流程

---

## 二、目录与模块结构规范

### 🗂️ 目录结构标准

```
datapull/
├── src/
│   ├── crawler/              # 爬虫逻辑层
│   ├── extractors/           # 内容提取层
│   ├── chunkers/             # 文本分片层
│   ├── ingesters/            # 上传入库层
│   ├── services/             # 业务编排层
│   ├── utils/                # 通用工具层
│   ├── types/                # 类型定义层
│   └── main.ts               # 主入口
├── config/                   # 全局配置
├── scripts/                  # 执行脚本
├── tests/                    # 单元与集成测试
├── docs/                     # 文档与规范
├── .env.example              # 环境变量样例
└── package.json
```

---

## 三、文件命名规范

| 文件类型  | 命名规则         | 示例                       |
| ----- | ------------ | ------------------------ |
| 源代码文件 | 全小写、短横线分词    | `crawl-service.ts`       |
| 接口定义  | `*-types.ts` | `document-types.ts`      |
| 脚本文件  | 动作式动词命名      | `crawl-and-ingest.ts`    |
| 配置文件  | 简明业务命名       | `sources.json`           |
| 测试文件  | `*.test.ts`  | `crawler.test.ts`        |
| 日志文件  | 日期+模块名       | `2025-01-06-crawler.log` |

---

## 四、代码风格与语言规范

### 基础规范

* 使用 **TypeScript 5+**
* 强制启用 **ESLint + Prettier**
* 严格类型化 (`noImplicitAny`, `strictNullChecks`)
* 变量命名采用 **camelCase**
* 类与接口命名采用 **PascalCase**
* 常量命名采用 **UPPER_SNAKE_CASE**

### 注释标准

每个文件必须包含头部块注释：

```ts
/**
 * 模块名：CrawlService
 * 职责：协调爬虫任务调度与数据提取
 * 作者：Datapull Team
 * 创建日期：2025-01-06
 * 对应文档：《Datapull 研发规范 v1.0》
 */
```

函数注释采用 JSDoc 格式：

```ts
/**
 * 从目标 URL 抓取 HTML 内容
 * @param url - 目标网址
 * @returns Promise<string> - 返回 HTML 文本
 */
async function fetchHtml(url: string): Promise<string> { ... }
```

---

## 五、模块开发规范

### 1️⃣ Crawler 模块

**文件**：`src/crawler/*`

| 规范项        | 要求                                 |
| ---------- | ---------------------------------- |
| 并发         | 使用 p-queue 控制（默认 5）                |
| robots.txt | 使用 robots-txt-parse 校验             |
| 重试         | 最多 3 次，指数退避算法                      |
| 限流         | 每请求间隔 ≥500ms                       |
| 输出         | `{ url, html, status, fetchedAt }` |

---

### 2️⃣ Extractor 模块

**文件**：`src/extractors/*`

| 规范项  | 要求                                 |
| ---- | ---------------------------------- |
| 输入   | HTML / PDF 文件路径或字符串                |
| 输出   | `{ title, content, metadata }`     |
| HTML | 过滤 `<script>`, `<nav>`, `<footer>` |
| PDF  | 使用 `pdf-parse` 提取文本                |
| 清理规则 | 去除重复空行、HTML实体、控制符                  |

---

### 3️⃣ Chunker 模块

**文件**：`src/chunkers/*`

| 规范项  | 要求                 |
| ---- | ------------------ |
| 分片大小 | 500-800 字符         |
| 重叠   | 50 字符              |
| 分割点  | 优先 `。`、`！`、`\n`    |
| 输出   | 数组 `[ChunkObject]` |
| 校验   | 每片必须 ≥100 字符       |

---

### 4️⃣ Ingester 模块

**文件**：`src/ingesters/*`

| 规范项    | 要求                                      |
| ------ | --------------------------------------- |
| API 封装 | `drivequiz-client.ts` 统一封装              |
| 认证     | Bearer Token (`DRIVEQUIZ_API_TOKEN`)    |
| 批量上传   | 每次 ≤100 文档                              |
| 失败重试   | 最多 3 次，2^n 退避                           |
| 入库结果   | 返回 `operationId`, `processed`, `failed` |
| 哈希防重   | `sha256(content)` 去重上传                  |

---

### 5️⃣ Services 模块

**文件**：`src/services/*`

| 规范项   | 要求                            |
| ----- | ----------------------------- |
| 入口服务  | `crawl-service.ts` 调度全流程      |
| 事务一致性 | 保证单批次任务原子性                    |
| 日志记录  | 使用 `operation-logger.ts` 统一接口 |
| 失败回滚  | 自动跳过失败批次并记录错误                 |

---

### 6️⃣ Utils 模块

**文件**：`src/utils/*`

| 工具           | 功能    | 说明                     |
| ------------ | ----- | ---------------------- |
| logger.ts    | 结构化日志 | 日志分级 info/warn/error   |
| validator.ts | 配置校验  | 使用 zod 检查 sources.json |
| hasher.ts    | 哈希函数  | 使用 SHA256 去重           |
| encoder.ts   | 字符集检测 | 支持 UTF-8/Shift_JIS     |

---

## 六、日志与可观测性规范

| 分类 | 级别      | 输出位置                       |
| -- | ------- | -------------------------- |
| 调试 | `debug` | console + logs/dev.log     |
| 信息 | `info`  | console + logs/runtime.log |
| 警告 | `warn`  | logs/runtime.log           |
| 错误 | `error` | logs/error.log             |

### 日志格式（JSON）

```json
{
  "timestamp": "2025-01-06T12:00:00Z",
  "level": "info",
  "module": "ingest-service",
  "message": "Uploaded batch successfully",
  "meta": { "sourceId": "gov_npa", "count": 12 }
}
```

### 操作记录日志

* 每个批量任务生成唯一 `operationId`
* 保存至 `logs/operations/{operationId}.json`
* 与 DriveQuiz `/operations` 保持一致结构

---

## 七、错误与异常处理规范

### 错误响应结构

```ts
{
  ok: false,
  errorCode: "INVALID_CONTENT",
  message: "Content too short (<100 chars)",
  details?: { field: string, reason: string }
}
```

### 关键策略

* **外部接口错误**：重试 3 次
* **本地提取错误**：记录并跳过
* **配置错误**：阻断启动
* **API 限流**：读取 `X-RateLimit-Reset` 等待

---

## 八、配置与环境规范

### 环境变量

| 名称                    | 示例                                                                                   | 说明              |
| --------------------- | ------------------------------------------------------------------------------------ | --------------- |
| `DRIVEQUIZ_API_URL`   | [https://dev-api.drivequiz.com/api/v1/rag](https://dev-api.drivequiz.com/api/v1/rag) | API 基础路径        |
| `DRIVEQUIZ_API_TOKEN` | sk_test_123                                                                          | DriveQuiz Token |
| `CRAWL_CONCURRENCY`   | 5                                                                                    | 并发数             |
| `LOG_LEVEL`           | info                                                                                 | 日志级别            |
| `CACHE_DIR`           | ./data/cache                                                                         | 缓存目录            |

### 配置文件验证

执行：

```bash
pnpm tsx scripts/validate-config.ts
```

返回：

```bash
✅ Config validated: 5 sources loaded
```

---

## 九、测试与验证规范

### 测试框架

使用 **Vitest + Supertest**：

* `tests/unit`：模块单元测试
* `tests/integration`：完整流程（爬取→提取→分片→上传）

### 验收指标

| 项目      | 指标          |
| ------- | ----------- |
| 单元测试覆盖率 | ≥80%        |
| 批量上传性能  | 100 文档 < 5s |
| API 成功率 | ≥99.5%      |
| 抓取错误率   | ≤3%         |

### 测试命令

```bash
pnpm test
pnpm test:integration
```

---

## 十、交付与审查标准

| 阶段   | 审查内容             | 通过标准             |
| ---- | ---------------- | ---------------- |
| 开发完成 | 模块功能对齐规范         | ✅ 所有 API 测试通过    |
| 联调阶段 | 与 DriveQuiz 对接成功 | ✅ 无错误返回          |
| 上线前  | 性能 + 日志 + 容错验证   | ✅ 全部通过 checklist |
| 上线后  | 监控与异常追踪          | ✅ 告警系统运行正常       |

---

## 十一、版本与更新机制

| 项目   | 文件              | 说明            |
| ---- | --------------- | ------------- |
| 版本号  | `package.json`  | 语义化版本（semver） |
| 构建号  | `BUILD_ID` 环境变量 | 由 CI 注入       |
| 日志保留 | `logs/` 目录      | 保留 14 天自动轮换   |

---

## 十二、附录 · 联调接口对齐（来自 DriveQuiz）

| 功能   | 请求方式 | 路径                            | 状态 |
| ---- | ---- | ----------------------------- | -- |
| 健康检查 | GET  | `/api/v1/rag/health`          | ✅  |
| 文档上传 | POST | `/api/v1/rag/docs`            | ✅  |
| 批量上传 | POST | `/api/v1/rag/docs/batch`      | ✅  |
| 操作查询 | GET  | `/api/v1/rag/operations`      | ✅  |
| 操作详情 | GET  | `/api/v1/rag/operations/{id}` | ✅  |

---

## 📎 附件与引用

* 《Datapull 项目产品文档 v1.0》
* 《DriveQuiz API 规范 v1.0》
* 《DriveQuiz 集成联调清单 v1.0》
* 《DriveQuiz 向量化优化需求 v1.0》
* 《Project Structure 文档 v1.0》

