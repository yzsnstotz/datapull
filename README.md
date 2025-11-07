# Datapull

一个用于从各个目标网站抓取信息并上传到 DriveQuiz RAG 数据库的本地服务。

## 功能特性

- 🌐 多源网站抓取（JAF、警察厅、MLIT 等）
- 📄 支持 HTML 和 PDF 文档
- 🧩 智能文本分片（保持语义完整性）
- 📤 批量上传到 DriveQuiz API
- 📝 完整的操作记录和日志
- 🔄 自动重试和错误处理
- ⚙️ 配置驱动的抓取策略

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
DRIVEQUIZ_API_URL=https://your-drivequiz-domain.com/api/v1/rag
DRIVEQUIZ_API_TOKEN=your_api_token_here
CRAWL_CONCURRENCY=4
LOG_LEVEL=info
```

### 配置抓取源

编辑 `config/sources.json`，添加要抓取的网站配置。

### 运行

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm start

# Dry run（不实际上传）
DRY_RUN=1 pnpm start
```

## 项目结构

```
datapull/
├── src/              # 源代码
├── config/           # 配置文件
├── scripts/          # 脚本文件
├── docs/             # 文档
└── tests/            # 测试文件
```

详细结构请参考 [docs/project-structure.md](./docs/project-structure.md)

## API 规范

DriveQuiz API 规范请参考：
- [Markdown 文档](./docs/drivequiz-api-spec.md)
- [OpenAPI 规范](./docs/drivequiz-api-spec.yaml)

## 开发

### 运行测试

```bash
pnpm test
```

### 代码检查

```bash
pnpm lint
```

### 类型检查

```bash
pnpm type-check
```

## 许可证

MIT

