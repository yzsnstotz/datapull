# DriveQuiz API 401 认证失败问题 - 简要报告

## 问题概述

datapull 调用 DriveQuiz API 批量上传接口时，所有请求返回 `401 Unauthorized`，错误信息：`"Invalid or missing token"`。

## 关键信息

### 客户端（datapull）发送的请求

- **接口**: `POST http://localhost:8789/api/v1/rag/docs/batch`
- **Authorization Header**: `Bearer datapull_drivequiz_api_token_2025_secure_key_v1`
- **Token 值**: `datapull_drivequiz_api_token_2025_secure_key_v1` (47 字符)
- **环境变量**: `DRIVEQUIZ_API_TOKEN=datapull_drivequiz_api_token_2025_secure_key_v1`

### 服务端（drivequiz-api）响应

- **状态码**: `401 Unauthorized`
- **事件**: `auth.unauthorized`
- **错误信息**: `"Invalid or missing token"`

### 测试结果

✅ **客户端确认**:
- Token 正确传递到 Authorization header
- 请求头格式正确
- 网络连接正常（健康检查通过）

❌ **服务端响应**:
- 所有请求都返回 401
- 触发 `auth.unauthorized` 事件

## 服务端日志示例

```json
{"level":"info","time":1762516738386,"pid":42665,"hostname":"Leos-Air.lan","event":"auth.unauthorized","timestamp":"2025-11-07T11:58:58.386Z","path":"/api/v1/rag/docs/batch","method":"POST"}
{"level":30,"time":1762516738386,"pid":42665,"hostname":"Leos-Air.lan","reqId":"req-d","res":{"statusCode":401},"responseTime":0.8501243591308594,"msg":"request completed"}
```

## 需要检查的点

1. **Token 配置**
   - 确认服务端期望的 Token 值是否为 `datapull_drivequiz_api_token_2025_secure_key_v1`
   - 检查环境变量配置（`DRIVEQUIZ_API_TOKEN` 或 `DRIVEQUIZ_API_TOKEN_SECRET`）

2. **Token 验证逻辑**
   - 检查 Token 验证代码实现
   - 确认 Token 比较逻辑（大小写敏感、trim 等）
   - 检查 Authorization header 解析逻辑

3. **调试日志**
   - 记录接收到的 Authorization header 值
   - 记录 Token 比较过程
   - 记录验证失败的具体原因

## 建议的排查步骤

1. 检查服务端环境变量配置
2. 在服务端添加认证调试日志
3. 确认服务端期望的 Token 格式和值

---

**报告时间**: 2025-11-07  
**问题状态**: 待 drivequiz-api 团队排查

