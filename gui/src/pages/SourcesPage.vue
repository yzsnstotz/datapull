<template>
  <div class="sources-page">
    <div class="page-header">
      <h2>数据源管理</h2>
      <button class="btn-primary" @click="showCreateModal = true">
        新建数据源
      </button>
    </div>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索数据源..."
        @input="handleSearch"
      />
    </div>

    <DataTable
      :columns="columns"
      :rows="filteredSources"
      :selectable="false"
      @rowSelect="handleRowSelect"
    />

    <!-- 创建/编辑模态框 -->
    <div v-if="showCreateModal || editingSource" class="modal">
      <div class="modal-content">
        <h3>{{ editingSource ? "编辑数据源" : "新建数据源" }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>ID</label>
            <input
              v-model="formData.id"
              type="text"
              required
              :disabled="!!editingSource"
            />
          </div>
          <div class="form-group">
            <label>名称</label>
            <input v-model="formData.name" type="text" required />
          </div>
          <div class="form-group">
            <label>种子URL（每行一个）</label>
            <textarea
              v-model="seedUrlsText"
              rows="3"
              required
            ></textarea>
          </div>
          <div class="form-group">
            <label>语言</label>
            <select v-model="formData.lang" required>
              <option value="ja">日语</option>
              <option value="zh">中文</option>
              <option value="en">英语</option>
            </select>
          </div>
          <div class="form-group">
            <label>版本</label>
            <input v-model="formData.version" type="text" required />
          </div>
          
          <!-- 认证配置（可选） -->
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="showAuthConfig" />
              需要登录认证（可选）
            </label>
            <div v-if="showAuthConfig" class="auth-config">
              <div class="form-group">
                <label>Cookie（例如: session_id=abc123; token=xyz789）</label>
                <input v-model="formData.auth.cookies" type="text" placeholder="可选" />
              </div>
              <div class="form-group">
                <label>Authorization 头（例如: Bearer token123）</label>
                <input v-model="formData.auth.authorization" type="text" placeholder="可选" />
              </div>
              <div class="form-group">
                <label>自定义请求头（JSON格式，例如: {"X-Custom-Header": "value"}）</label>
                <textarea v-model="authHeadersText" rows="3" placeholder='{"X-Custom-Header": "value"}'></textarea>
              </div>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-primary">保存</button>
            <button
              type="button"
              class="btn-secondary"
              @click="cancelEdit"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useGuiStore } from "../store/guiStore";
import DataTable from "../components/DataTable.vue";
import * as api from "../services/datapullApi";
import type { Source } from "../types/common";

const guiStore = useGuiStore();
const searchQuery = ref("");
const showCreateModal = ref(false);
const editingSource = ref<Source | null>(null);

const formData = ref({
  id: "",
  name: "",
  seedUrls: [] as string[],
  include: [] as string[],
  exclude: [] as string[],
  lang: "ja" as "ja" | "zh" | "en",
  version: "2025Q1",
  enabled: true,
  crawlDepth: 2,
  rateLimitQPS: 5,
  notes: "",
  auth: {
    cookies: "",
    authorization: "",
    headers: {} as Record<string, string>,
  },
});

const showAuthConfig = ref(false);

// 自定义请求头的文本处理
const authHeadersText = computed({
  get: () => {
    const headers = formData.value.auth.headers;
    return Object.keys(headers).length > 0 ? JSON.stringify(headers, null, 2) : "";
  },
  set: (value) => {
    try {
      if (value.trim()) {
        formData.value.auth.headers = JSON.parse(value);
      } else {
        formData.value.auth.headers = {};
      }
    } catch (error) {
      // 解析失败时保持原值
      console.error("JSON 解析失败", error);
    }
  },
});

const seedUrlsText = computed({
  get: () => formData.value.seedUrls.join("\n"),
  set: (value) => {
    formData.value.seedUrls = value
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s);
  },
});

const filteredSources = computed(() => {
  if (!searchQuery.value) return guiStore.sources;
  const q = searchQuery.value.toLowerCase();
  return guiStore.sources.filter(
    (s) =>
      s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  );
});

const columns = [
  { key: "id", label: "ID" },
  { key: "name", label: "名称" },
  { key: "lang", label: "语言" },
  { key: "version", label: "版本" },
  { key: "enabled", label: "启用", formatter: (v: boolean) => (v ? "是" : "否") },
  {
    key: "actions",
    label: "操作",
    render: (v: any, row: Source) => {
      const editId = `edit-${row.id}`;
      const deleteId = `delete-${row.id}`;
      return `
        <button id="${editId}" class="table-btn">编辑</button>
        <button id="${deleteId}" class="table-btn">删除</button>
      `;
    },
  },
];

onMounted(async () => {
  await guiStore.loadSources();
  
  // 使用事件委托处理按钮点击
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("table-btn")) {
      const buttonId = target.id;
      if (buttonId.startsWith("edit-")) {
        const id = buttonId.replace("edit-", "");
        handleEdit(id);
      } else if (buttonId.startsWith("delete-")) {
        const id = buttonId.replace("delete-", "");
        handleDelete(id);
      }
    }
  });
});

function handleEdit(id: string) {
  const source = guiStore.sources.find((s) => s.id === id);
  if (source) {
    editingSource.value = source;
    formData.value = {
      ...source,
      auth: source.auth || {
        cookies: "",
        authorization: "",
        headers: {},
      },
    };
    showAuthConfig.value = !!(source.auth && (
      source.auth.cookies ||
      source.auth.authorization ||
      (source.auth.headers && Object.keys(source.auth.headers).length > 0)
    ));
  }
}

async function handleDelete(id: string) {
  if (confirm("确定要删除这个数据源吗？")) {
    try {
      await api.deleteSource(id);
      await guiStore.loadSources();
    } catch (error) {
      console.error("删除失败", error);
      alert("删除失败: " + (error as any).message);
    }
  }
}

function handleSearch() {
  // 搜索逻辑已在 computed 中处理
}

function handleRowSelect(ids: string[]) {
  // 处理行选择
}

function cancelEdit() {
  showCreateModal.value = false;
  editingSource.value = null;
  resetForm();
}

function resetForm() {
  formData.value = {
    id: "",
    name: "",
    seedUrls: [],
    include: [],
    exclude: [],
    lang: "ja",
    version: "2025Q1",
    enabled: true,
    crawlDepth: 2,
    rateLimitQPS: 5,
    notes: "",
    auth: {
      cookies: "",
      authorization: "",
      headers: {},
    },
  };
  showAuthConfig.value = false;
}

async function handleSubmit() {
  try {
    // 前端验证
    const validationError = validateFormData();
    if (validationError) {
      alert(validationError);
      return;
    }

    // 准备发送的数据
    const now = new Date().toISOString();
    const authConfig = showAuthConfig.value && (
      formData.value.auth.cookies ||
      formData.value.auth.authorization ||
      Object.keys(formData.value.auth.headers || {}).length > 0
    ) ? {
      cookies: formData.value.auth.cookies || undefined,
      authorization: formData.value.auth.authorization || undefined,
      headers: Object.keys(formData.value.auth.headers || {}).length > 0 ? formData.value.auth.headers : undefined,
    } : undefined;
    
    const sourceData: Source = {
      ...formData.value,
      auth: authConfig,
      createdAt: editingSource.value?.createdAt || now,
      updatedAt: now,
    };

    if (editingSource.value) {
      await api.updateSource(editingSource.value.id, sourceData);
    } else {
      await api.createSource(sourceData);
    }
    await guiStore.loadSources();
    cancelEdit();
  } catch (error: any) {
    console.error("保存失败", error);
    const errorMessage = error?.message || error?.code || "未知错误";
    alert("保存失败: " + errorMessage);
  }
}

function validateFormData(): string | null {
  // 验证 ID 格式：只能包含小写字母、数字和下划线，长度 3-50
  if (!/^[a-z0-9_]{3,50}$/.test(formData.value.id)) {
    return "ID 只能包含小写字母、数字和下划线，长度 3-50 个字符";
  }

  // 验证种子 URL
  if (formData.value.seedUrls.length === 0) {
    return "至少需要一个种子 URL";
  }
  for (const url of formData.value.seedUrls) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `种子 URL 必须以 http:// 或 https:// 开头: ${url}`;
    }
  }

  // 验证版本格式：YYYYQ[1-4] 或 YYYY
  if (!/^\d{4}(Q[1-4])?$/.test(formData.value.version)) {
    return "版本格式不正确，应为 YYYYQ[1-4] 或 YYYY（如：2025Q1 或 2025）";
  }

  // 验证语言
  if (!["ja", "zh", "en"].includes(formData.value.lang)) {
    return "语言必须为 ja、zh 或 en";
  }

  // 验证爬取深度
  if (formData.value.crawlDepth && (formData.value.crawlDepth < 1 || formData.value.crawlDepth > 5)) {
    return "爬取深度必须在 1-5 之间";
  }

  // 验证速率限制
  if (formData.value.rateLimitQPS && (formData.value.rateLimitQPS < 1 || formData.value.rateLimitQPS > 50)) {
    return "速率限制必须在 1-50 之间";
  }

  return null;
}

</script>

<style scoped>
.sources-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.search-bar {
  margin-bottom: 1rem;
}

.search-bar input {
  width: 100%;
  max-width: 400px;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.auth-config {
  margin-top: 0.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.table-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
  font-size: 0.875rem;
  transition: background 0.2s;
}

.table-btn:hover {
  background: #2980b9;
}

.table-btn:last-child {
  background: #e74c3c;
}

.table-btn:last-child:hover {
  background: #c0392b;
}
</style>

