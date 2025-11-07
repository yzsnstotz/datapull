# DriveQuiz API 401 认证失败问题报告

## 问题描述

datapull 服务在调用 DriveQuiz API 批量上传接口时，所有请求都返回 `401 Unauthorized` 错误，错误信息为 `"Invalid or missing token"`。

## 问题详情

### 1. 请求信息

- **接口**: `POST /api/v1/rag/docs/batch`
- **服务地址**: `http://localhost:8789/api/v1/rag`
- **请求头**:
  ```
  Content-Type: application/json
  Authorization: Bearer datapull_drivequiz_api_token_2025_secure_key_v1
  ```

### 2. Token 信息

- **Token 值**: `datapull_drivequiz_api_token_2025_secure_key_v1`
- **Token 长度**: 47 个字符
- **Authorization Header**: `Bearer datapull_drivequiz_api_token_2025_secure_key_v1` (54 个字符)
- **环境变量**: `DRIVEQUIZ_API_TOKEN=datapull_drivequiz_api_token_2025_secure_key_v1`

### 3. 测试结果

#### 3.1 curl 测试
```bash
curl -X POST http://localhost:8789/api/v1/rag/docs/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer datapull_drivequiz_api_token_2025_secure_key_v1" \
  -d '{"docs":[...],"sourceId":"test_source"}'
```

**结果**: 返回 `401 Unauthorized`

#### 3.2 代码测试
- 使用 datapull 测试脚本进行测试
- Token 正确传递到 Authorization header
- 所有请求都返回 `401 Unauthorized`

### 4. DriveQuiz API 服务端日志

从 drivequiz-api 服务端日志可以看到：

```json
{"level":"info","time":1762516738386,"pid":42665,"hostname":"Leos-Air.lan","event":"auth.unauthorized","timestamp":"2025-11-07T11:58:58.386Z","path":"/api/v1/rag/docs/batch","method":"POST"}
{"level":30,"time":1762516738386,"pid":42665,"hostname":"Leos-Air.lan","reqId":"req-d","res":{"statusCode":401},"responseTime":0.8501243591308594,"msg":"request completed"}
```

**关键信息**:
- 所有请求都触发了 `auth.unauthorized` 事件
- 返回 `401` 状态码
- 请求路径: `/api/v1/rag/docs/batch`
- 请求方法: `POST`

### 5. datapull 客户端日志

从 datapull 客户端日志可以看到：

```json
{
  "level": "info",
  "message": "发送 HTTP POST 请求详情",
  "url": "http://localhost:8789/api/v1/rag/docs/batch",
  "method": "POST",
  "authHeaderValue": "Bearer datapull_drivequiz_api_token_2025_secure_key_v1",
  "tokenValue": "datapull_drivequiz_api_token_2025_secure_key_v1",
  "tokenLength": 47,
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer datapull_drivequiz_api_token_2025_secure_key_v1"
  }
}
```

**关键信息**:
- Token 值正确传递
- Authorization header 格式正确
- 请求头设置正确

## 已确认的信息

✅ **客户端（datapull）**:
- Token 值正确设置
- Authorization header 格式正确（`Bearer <token>`）
- 请求头正确传递
- 网络连接正常（健康检查通过）

❌ **服务端（drivequiz-api）**:
- 所有请求都返回 `401 Unauthorized`
- 触发 `auth.unauthorized` 事件
- 错误信息: `"Invalid or missing token"`

## 可能的原因

1. **Token 值不匹配**
   - drivequiz-api 服务期望的 Token 值可能不是 `datapull_drivequiz_api_token_2025_secure_key_v1`
   - 需要确认服务端配置的 Token 值

2. **环境变量配置问题**
   - 服务端可能未正确读取 Token 配置
   - 环境变量名称可能不匹配（客户端使用 `DRIVEQUIZ_API_TOKEN`，文档提到 `DRIVEQUIZ_API_TOKEN_SECRET`）

3. **Token 验证逻辑问题**
   - 服务端的 Token 验证逻辑可能有 bug
   - Token 格式要求可能不同（如需要前缀/后缀）

4. **Token 格式问题**
   - 服务端可能期望不同的 Token 格式
   - 可能有大小写敏感或其他格式要求

## 需要检查的点

### 1. 服务端 Token 配置
- [ ] 确认 drivequiz-api 服务期望的 Token 值
- [ ] 检查服务端环境变量配置
- [ ] 确认环境变量名称（`DRIVEQUIZ_API_TOKEN` vs `DRIVEQUIZ_API_TOKEN_SECRET`）

### 2. Token 验证逻辑
- [ ] 检查 Token 验证代码实现
- [ ] 确认 Token 比较逻辑（是否区分大小写、是否有 trim 等）
- [ ] 检查 Authorization header 解析逻辑

### 3. 日志和调试
- [ ] 在服务端添加更详细的认证日志
- [ ] 记录接收到的 Authorization header 值
- [ ] 记录 Token 比较过程

## 测试环境

- **客户端**: datapull (本地运行)
- **服务端**: drivequiz-api (本地运行，端口 8789)
- **网络**: 本地回环（127.0.0.1）
- **测试时间**: 2025-11-07

## 建议的排查步骤

1. **检查服务端 Token 配置**
   ```bash
   # 检查环境变量
   echo $DRIVEQUIZ_API_TOKEN
   # 或
   echo $DRIVEQUIZ_API_TOKEN_SECRET
   ```

2. **添加服务端调试日志**
   - 记录接收到的 Authorization header
   - 记录 Token 比较过程
   - 记录验证失败的原因

3. **测试不同的 Token 值**
   - 尝试使用其他 Token 值进行测试
   - 确认服务端期望的 Token 格式

## 联系方式

如有问题，请联系 datapull 团队进行进一步排查。

---

**报告生成时间**: 2025-11-07  
**问题状态**: 待 drivequiz-api 团队排查

