# 📋 DriveQuiz API 产品需求清单

**文档版本**: v1.0.0  
**创建日期**: 2025-01-07  
**适用范围**: DriveQuiz 开发团队  
**对接项目**: Datapull 数据抓取与入库服务

---

## 📌 概述

本文档列出了 DriveQuiz 团队需要配合实现的 API 产品需求，用于与 datapull 项目对接，实现 RAG 数据入库功能。

**Base URL**: `https://your-drivequiz-domain.com/api/v1/rag`  
**API Version**: `v1`  
**通信方式**: HTTPS REST API  
**数据格式**: JSON  
**认证方式**: Bearer Token（必需）或 API Key（可选）

---

## 🎯 核心功能需求（P0 - 必须实现）

### 1. 健康检查接口

**优先级**: P0（最高）  
**接口**: `GET /api/v1/rag/health`

**功能要求**:
- ✅ 检查 API 服务是否可用
- ✅ 返回服务状态和版本信息
- ✅ 响应时间 < 100ms
- ✅ 不需要认证即可访问
- ✅ 可用于负载均衡健康检查

**响应格式**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T12:00:00Z",
  "version": "v1"
}
```

**验收标准**:
- [ ] 接口可访问
- [ ] 返回格式正确
- [ ] 响应时间 < 100ms
- [ ] 不需要认证

---

### 2. 单文档上传接口

**优先级**: P0（最高）  
**接口**: `POST /api/v1/rag/docs`

**功能要求**:
- ✅ 接收单个文档分片
- ✅ 验证文档内容（长度、格式等）
- ✅ 存储文档到数据库
- ✅ 触发向量化（异步）
- ✅ 返回文档 ID 和操作 ID
- ✅ 支持内容去重（基于 contentHash）
- ✅ 支持版本管理（基于 version）

**请求格式**:
```json
{
  "title": "文档标题",
  "url": "https://example.com",
  "content": "文档内容（100-2000字符）",
  "version": "2025Q1",
  "lang": "ja",
  "meta": {
    "sourceId": "gov_npa_driving",
    "type": "official",
    "chunkIndex": 1,
    "totalChunks": 3,
    "contentHash": "sha256:abc123..."
  }
}
```

**字段验证要求**:
- `title` (string, required): 文档标题
- `url` (string, required): 源 URL
- `content` (string, required): 文档内容（100-2000 字符）
- `version` (string, required): 版本标识（如 "2025Q1"）
- `lang` (string, required): 语言代码（"ja" | "zh" | "en"）
- `meta` (object, optional): 元数据

**响应格式** (200 OK):
```json
{
  "success": true,
  "docId": "doc_abc123",
  "message": "Document ingested successfully",
  "operationId": "op_xyz789"
}
```

**错误响应**:
- `400 INVALID_REQUEST`: 请求参数错误
- `400 CONTENT_TOO_SHORT`: 内容过短（< 100 字符）
- `400 CONTENT_TOO_LONG`: 内容过长（> 2000 字符）
- `401 UNAUTHORIZED`: 认证失败
- `409 DUPLICATE_DOCUMENT`: 文档已存在（基于 url + contentHash + version）
- `500 INTERNAL_ERROR`: 服务器内部错误

**验收标准**:
- [ ] 字段验证正确
- [ ] 内容长度验证正确
- [ ] contentHash 计算正确（SHA-256）
- [ ] 去重检查正确（url + contentHash + version）
- [ ] 数据库存储正确
- [ ] 操作记录创建正确
- [ ] 异步触发向量化
- [ ] 错误处理完整

---

### 3. 批量文档上传接口

**优先级**: P0（最高）  
**接口**: `POST /api/v1/rag/docs/batch`

**功能要求**:
- ✅ 接收最多 100 个文档分片
- ✅ 批量处理和验证
- ✅ 支持部分成功（返回 207 Multi-Status）
- ✅ 返回批量操作 ID 和每个文档的处理结果
- ✅ 使用事务保证数据一致性
- ✅ 批量处理提高效率

**请求格式**:
```json
{
  "docs": [
    {
      "title": "文档1",
      "url": "https://example.com/1",
      "content": "内容1...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "gov_npa_driving",
        "type": "official",
        "chunkIndex": 1,
        "totalChunks": 3
      }
    },
    {
      "title": "文档2",
      "url": "https://example.com/2",
      "content": "内容2...",
      "version": "2025Q1",
      "lang": "ja",
      "meta": {
        "sourceId": "gov_npa_driving",
        "type": "official",
        "chunkIndex": 2,
        "totalChunks": 3
      }
    }
  ],
  "sourceId": "gov_npa_driving",
  "batchMetadata": {
    "totalDocs": 2,
    "crawledAt": "2025-01-06T12:00:00Z",
    "crawlerVersion": "1.0.0"
  }
}
```

**响应格式** (200 OK):
```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "operationId": "op_batch_xyz789",
  "results": [
    {
      "docId": "doc_abc123",
      "status": "success"
    },
    {
      "docId": "doc_def456",
      "status": "success"
    }
  ]
}
```

**响应格式** (207 Multi-Status):
```json
{
  "success": true,
  "processed": 1,
  "failed": 1,
  "operationId": "op_batch_xyz789",
  "results": [
    {
      "docId": "doc_abc123",
      "status": "success"
    },
    {
      "index": 1,
      "status": "failed",
      "error": {
        "code": "INVALID_CONTENT",
        "message": "Content too short"
      }
    }
  ]
}
```

**验收标准**:
- [ ] 文档数量限制正确（最多 100 个）
- [ ] 批量验证正确
- [ ] 事务处理正确
- [ ] 部分成功处理正确（返回 207）
- [ ] 操作记录关联正确
- [ ] 返回详细的处理结果
- [ ] 错误处理完整

---

### 4. 操作记录查询接口

**优先级**: P1（高）  
**接口**: `GET /api/v1/rag/operations`

**功能要求**:
- ✅ 查询历史操作记录
- ✅ 支持多种过滤条件（sourceId、status、日期范围等）
- ✅ 支持分页查询
- ✅ 高效的查询性能（索引优化）

**查询参数**:
- `sourceId` (string, optional): 按源 ID 过滤
- `status` (string, optional): 按状态过滤（"success" | "failed" | "pending"）
- `startDate` (string, optional): 开始日期（ISO 8601）
- `endDate` (string, optional): 结束日期（ISO 8601）
- `page` (number, optional): 页码（默认 1）
- `limit` (number, optional): 每页数量（默认 20，最大 100）

**响应格式** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "operationId": "op_xyz789",
      "sourceId": "gov_npa_driving",
      "status": "success",
      "docsCount": 15,
      "failedCount": 0,
      "createdAt": "2025-01-06T12:00:00Z",
      "completedAt": "2025-01-06T12:05:00Z",
      "duration": 300,
      "metadata": {
        "version": "2025Q1",
        "lang": "ja"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**验收标准**:
- [ ] 过滤条件支持正确
- [ ] 分页功能正确
- [ ] 查询性能优化（索引）
- [ ] 返回格式正确

---

### 5. 操作详情查询接口

**优先级**: P1（高）  
**接口**: `GET /api/v1/rag/operations/{operationId}`

**功能要求**:
- ✅ 查询单个操作的详细信息
- ✅ 包含操作中的所有文档列表
- ✅ 包含操作统计信息（成功数、失败数等）
- ✅ 关联查询操作和文档

**响应格式** (200 OK):
```json
{
  "success": true,
  "data": {
    "operationId": "op_xyz789",
    "sourceId": "gov_npa_driving",
    "status": "success",
    "docsCount": 15,
    "failedCount": 0,
    "createdAt": "2025-01-06T12:00:00Z",
    "completedAt": "2025-01-06T12:05:00Z",
    "duration": 300,
    "metadata": {
      "version": "2025Q1",
      "lang": "ja",
      "crawlerVersion": "1.0.0"
    },
    "documents": [
      {
        "docId": "doc_abc123",
        "title": "文档标题",
        "url": "https://example.com",
        "status": "success",
        "ingestedAt": "2025-01-06T12:00:05Z"
      }
    ]
  }
}
```

**验收标准**:
- [ ] 操作基本信息正确
- [ ] 文档列表关联正确
- [ ] 统计信息正确
- [ ] 操作不存在时返回 404

---

## 🔧 辅助功能需求（P1-P3）

### 6. 版本替换接口

**优先级**: P2（中）  
**接口**: `POST /api/v1/rag/docs/versions/{version}/replace`

**功能要求**:
- ✅ 用新版本替换旧版本的所有文档
- ✅ 支持 dry-run 模式
- ✅ 返回替换的文档数量
- ✅ 软删除旧版本文档
- ✅ 支持回滚机制

**请求格式**:
```json
{
  "sourceIds": ["gov_npa_driving", "org_jaf_guideline"],
  "dryRun": false
}
```

**响应格式** (200 OK):
```json
{
  "success": true,
  "operationId": "op_replace_xyz789",
  "replacedCount": 150,
  "message": "Version replacement initiated"
}
```

---

### 7. 文档查询接口（调试用）

**优先级**: P3（低）  
**接口**: `GET /api/v1/rag/docs`

**功能要求**:
- ✅ 查询已上传的文档
- ✅ 支持多种过滤条件
- ✅ 支持分页查询
- ✅ 仅用于调试和验证
- ✅ 可限制返回内容大小

**查询参数**:
- `sourceId` (string, optional)
- `url` (string, optional)
- `version` (string, optional)
- `page` (number, optional)
- `limit` (number, optional)

---

## 🗄️ 数据库设计需求

### 1. `rag_documents` 表

**功能**: 存储文档内容和元数据

**表结构**:
```sql
CREATE TABLE rag_documents (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash
  version VARCHAR(50) NOT NULL,
  lang VARCHAR(10) NOT NULL,  -- 'ja', 'zh', 'en'
  source_id VARCHAR(100),
  doc_type VARCHAR(50),  -- 'official', 'organization', 'education'
  
  -- 元数据（JSON）
  metadata JSONB,
  
  -- 向量化相关
  vector_id VARCHAR(255),  -- 向量数据库中的 ID
  vectorized_at TIMESTAMP,
  vectorization_status VARCHAR(50),  -- 'pending', 'processing', 'completed', 'failed'
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 唯一约束
  UNIQUE (url, content_hash, version)
);

-- 索引
CREATE INDEX idx_url_hash_version ON rag_documents(url, content_hash, version);
CREATE INDEX idx_source_id ON rag_documents(source_id);
CREATE INDEX idx_version ON rag_documents(version);
CREATE INDEX idx_vector_status ON rag_documents(vectorization_status);
CREATE INDEX idx_created_at ON rag_documents(created_at);
```

**验收标准**:
- [ ] 表结构创建完成
- [ ] 索引创建完成
- [ ] 唯一约束正确
- [ ] 字段类型正确

---

### 2. `rag_operations` 表

**功能**: 存储操作记录

**表结构**:
```sql
CREATE TABLE rag_operations (
  id VARCHAR(255) PRIMARY KEY,
  source_id VARCHAR(100),
  operation_type VARCHAR(50) NOT NULL,  -- 'single', 'batch', 'replace'
  status VARCHAR(50) NOT NULL,  -- 'pending', 'processing', 'success', 'failed'
  
  -- 统计信息
  docs_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- 元数据（JSON）
  metadata JSONB,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  
  -- 错误信息
  error_message TEXT,
  error_details JSONB,
  
  -- 索引
  INDEX idx_source_id (source_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_operation_type (operation_type)
);
```

**验收标准**:
- [ ] 表结构创建完成
- [ ] 索引创建完成
- [ ] 字段类型正确

---

### 3. `rag_operation_documents` 表

**功能**: 关联操作和文档（用于批量操作）

**表结构**:
```sql
CREATE TABLE rag_operation_documents (
  id VARCHAR(255) PRIMARY KEY,
  operation_id VARCHAR(255) NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,  -- 'success', 'failed', 'duplicate'
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  FOREIGN KEY (operation_id) REFERENCES rag_operations(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE,
  
  INDEX idx_operation_id (operation_id),
  INDEX idx_document_id (document_id)
);
```

**验收标准**:
- [ ] 表结构创建完成
- [ ] 外键约束正确
- [ ] 索引创建完成

---

## 🔐 认证系统需求

### 1. Token 生成

**功能要求**:
- ✅ 在 DriveQuiz 管理后台提供 Token 生成功能
- ✅ 支持 JWT Token（推荐）或简单 API Key
- ✅ Token 过期时间设置
- ✅ Token 撤销功能
- ✅ Token 使用记录（可选）

**Token 格式** (JWT):
```json
{
  "sub": "datapull_service",
  "iat": 1704542400,
  "exp": 1704628800,
  "scope": "rag:ingest"
}
```

**验收标准**:
- [ ] Token 生成功能实现
- [ ] Token 管理界面（可选）
- [ ] Token 过期机制
- [ ] Token 撤销功能

---

### 2. Token 验证

**功能要求**:
- ✅ Bearer Token 验证实现
- ✅ API Key 验证实现（可选）
- ✅ 错误处理（401）
- ✅ 从数据库或缓存中验证 token

**HTTP Header**:
```
Authorization: Bearer {API_TOKEN}
```

**验收标准**:
- [ ] Bearer Token 验证正确
- [ ] API Key 验证正确（可选）
- [ ] 无效 Token 返回 401
- [ ] 过期 Token 返回 401

---

## 🤖 向量化集成需求

### 1. 向量化触发机制

**功能要求**:
- ✅ 文档上传后自动触发向量化（异步）
- ✅ 不阻塞 API 响应
- ✅ 维护向量化状态（pending/processing/completed/failed）
- ✅ 调用现有向量化服务 `POST /v1/admin/rag/ingest`

**向量化状态**:
- `pending`: 等待向量化
- `processing`: 正在向量化
- `completed`: 向量化完成
- `failed`: 向量化失败

**验收标准**:
- [ ] 文档上传后自动触发向量化
- [ ] 异步处理不阻塞响应
- [ ] 向量化状态更新正确
- [ ] 错误记录和重试机制

---

### 2. 向量化服务优化需求

**现有服务**: `POST /v1/admin/rag/ingest`

**需要优化的功能** (P0 - 必须实现):

1. **支持可选 docId**
   - 问题：datapull 上传文档时还没有 `docId`
   - 需求：支持可选 `docId`，如果没有提供则自动生成

2. **添加 lang 字段支持**
   - 问题：缺少语言代码字段
   - 需求：添加 `lang` 字段，支持 "ja" | "zh" | "en"

3. **添加 meta 字段支持**
   - 问题：缺少元数据字段（sourceId, type 等）
   - 需求：添加 `meta` 字段，支持任意元数据对象

4. **统一响应格式**
   - 问题：使用 `{ok: true, data: {...}}`，与 datapull API 设计不一致
   - 需求：统一响应格式，使用 `{success: true, docId: "...", ...}` 或保持兼容

5. **添加超时控制**
   - 问题：向量化可能长时间等待
   - 需求：设置超时（30-60秒）

6. **实现重试机制**
   - 问题：OpenAI API 或 Supabase 临时故障时直接失败
   - 需求：实现指数退避重试（最多3次）

**建议优化的功能** (P1 - 建议实现):

7. **添加关键日志**
   - 需求：记录向量化开始、完成、失败等关键操作

8. **记录处理指标**
   - 需求：记录处理时间、分片数量等指标

9. **实现速率限制**
   - 需求：实现请求队列/限流（最多10个并发）

**验收标准**:
- [ ] 支持可选 docId
- [ ] 支持 lang 和 meta 字段
- [ ] 响应格式统一
- [ ] 超时控制正确
- [ ] 重试机制正确

---

## ⚠️ 错误处理需求

### 1. 错误码定义

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `UNAUTHORIZED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `INVALID_REQUEST` | 400 | 请求参数错误 |
| `INVALID_CONTENT` | 400 | 内容格式错误 |
| `CONTENT_TOO_SHORT` | 400 | 内容过短（< 100 字符） |
| `CONTENT_TOO_LONG` | 400 | 内容过长（> 2000 字符） |
| `DUPLICATE_DOCUMENT` | 409 | 文档已存在（基于 contentHash） |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务暂时不可用 |

**验收标准**:
- [ ] 所有错误码实现完成
- [ ] 错误响应格式统一
- [ ] 错误信息清晰明确

---

### 2. 错误响应格式

**标准格式**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Missing required field: content",
    "details": {
      "field": "content",
      "reason": "content is required and must be non-empty"
    }
  }
}
```

**验收标准**:
- [ ] 错误响应格式统一
- [ ] 错误信息包含 code、message、details
- [ ] 错误信息清晰明确

---

## 🚦 速率限制需求

### 1. 速率限制规则

| 操作类型 | 限制 | 说明 |
|---------|------|------|
| 单文档上传 | 100 次/分钟 | 单个文档上传频率 |
| 批量上传 | 10 次/分钟 | 批量上传频率 |
| 查询操作 | 200 次/分钟 | 查询操作频率 |

**响应头**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704542400
```

**验收标准**:
- [ ] 速率限制实现正确
- [ ] 响应头包含限制信息
- [ ] 超过限制时返回 429 错误

---

## 📊 性能需求

### 1. 响应时间要求

| 操作类型 | 响应时间要求 | 说明 |
|---------|------------|------|
| 健康检查 | < 100ms | 快速响应 |
| 单文档上传 | < 500ms | 单个文档上传 |
| 批量上传（100个文档） | < 5s | 批量上传 |
| 操作记录查询 | < 200ms | 查询操作 |

**验收标准**:
- [ ] 响应时间满足要求
- [ ] 支持并发请求（至少 10 个并发）
- [ ] 性能测试通过

---

## 🧪 测试需求

### 1. 单元测试

**要求**:
- ✅ 每个 API 端点都有单元测试
- ✅ 测试覆盖率达到 80% 以上
- ✅ 测试各种边界情况

**验收标准**:
- [ ] 单元测试完成
- [ ] 测试覆盖率 ≥ 80%
- [ ] 边界情况测试完成

---

### 2. 集成测试

**要求**:
- ✅ 测试完整的文档上传流程
- ✅ 测试批量上传流程
- ✅ 测试操作记录查询
- ✅ 测试错误处理

**验收标准**:
- [ ] 集成测试完成
- [ ] 完整流程测试通过
- [ ] 错误处理测试通过

---

### 3. 性能测试

**要求**:
- ✅ 单文档上传响应时间 < 500ms
- ✅ 批量上传（100 个文档）响应时间 < 5s
- ✅ 支持并发请求（至少 10 个并发）

**验收标准**:
- [ ] 性能测试完成
- [ ] 响应时间满足要求
- [ ] 并发处理正常

---

## 🔄 数据去重需求

### 1. 去重策略

**去重键**: `url + contentHash + version`

**更新策略**:
- **跳过**（默认）：不更新已存在的文档，返回 409 或成功但不创建新记录
- **覆盖**：更新已存在的文档（需要显式指定 `replace: true`）

**验收标准**:
- [ ] 去重逻辑正确
- [ ] 基于 url + contentHash + version 判断重复
- [ ] 重复文档正确处理

---

## 📝 日志需求

### 1. 日志格式

**要求**:
- ✅ 结构化日志（JSON 格式）
- ✅ 包含关键字段（event, sourceId, operationId, processed 等）
- ✅ 记录关键操作（上传、向量化、错误等）

**日志示例**:
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

**验收标准**:
- [ ] 日志格式统一（JSON）
- [ ] 关键字段包含完整
- [ ] 关键操作记录完整

---

## 🔒 安全需求

### 1. HTTPS 要求

**要求**:
- ✅ 所有 API 调用必须使用 HTTPS
- ✅ 禁止使用 HTTP

**验收标准**:
- [ ] HTTPS 配置完成
- [ ] HTTP 请求被拒绝

---

### 2. Token 安全

**要求**:
- ✅ Token 过期时间设置
- ✅ Token 轮换机制
- ✅ Token 撤销功能
- ✅ 禁止明文日志输出 Token

**验收标准**:
- [ ] Token 安全机制实现
- [ ] Token 不在日志中明文输出

---

## 📦 交付清单

### 必须交付（P0）

- [ ] 所有核心 API 端点实现完成
- [ ] 数据库表结构创建完成
- [ ] 认证系统实现完成
- [ ] 向量化集成完成
- [ ] 操作记录功能完成
- [ ] 错误处理完成
- [ ] 单元测试和集成测试完成
- [ ] API 文档更新完成

### 建议交付（P1-P2）

- [ ] 性能测试报告
- [ ] 监控仪表盘
- [ ] 部署文档
- [ ] 运维手册

---

## 🔗 相关文档

- [API 规范文档](../cursor_gen/drivequiz-api-spec.md)
- [开发指南](../cursor_gen/drivequiz-development-guide.md)
- [集成联调清单](../cursor_gen/drivequiz-integration-checklist.md)
- [OpenAPI 规范](../cursor_gen/drivequiz-api-spec.yaml)

---

**文档版本**: v1.0.0  
**最后更新**: 2025-01-07

