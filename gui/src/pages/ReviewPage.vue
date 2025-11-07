<template>
  <div class="review-page">
    <div class="page-header">
      <h2>内容审查</h2>
      <div class="header-actions">
        <button
          class="btn-primary"
          :disabled="selectedReviewIds.length === 0 || processing"
          @click="handleBatchApprove"
        >
          {{ processing ? "处理中..." : `批量批准 (${selectedReviewIds.length})` }}
        </button>
        <button
          class="btn-secondary"
          :disabled="selectedReviewIds.length === 0 || processing"
          @click="handleBatchReject"
        >
          批量拒绝 ({{ selectedReviewIds.length }})
        </button>
      </div>
    </div>

    <div class="filters">
      <select v-model="filterStatus" @change="loadReviews">
        <option value="pending">待审查</option>
        <option value="approved">已批准</option>
        <option value="rejected">已拒绝</option>
      </select>
      <select v-model="filterSourceId" @change="loadReviews">
        <option value="">全部源</option>
        <option
          v-for="source in guiStore.sources"
          :key="source.id"
          :value="source.id"
        >
          {{ source.name }}
        </option>
      </select>
    </div>

    <DataTable
      :columns="columns"
      :rows="reviews"
      :pagination="pagination"
      :selectable="true"
      @rowSelect="handleRowSelect"
    />

    <!-- 详情模态框 -->
    <div v-if="selectedReview" class="modal" @click.self="closeDetail">
      <div class="modal-content large">
        <div class="modal-header">
          <h3>{{ selectedReview.title }}</h3>
          <button class="close-btn" @click="closeDetail">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-item">
            <label>URL:</label>
            <div class="url-container">
              <a :href="selectedReview.url" target="_blank" rel="noopener noreferrer" class="url-link">{{ selectedReview.url }}</a>
              <button class="copy-btn" @click="copyUrl(selectedReview.url)" :title="copySuccess ? '已复制!' : '复制URL'">
                {{ copySuccess ? '✓' : '📋' }}
              </button>
            </div>
            <div v-if="requiresAuth" class="auth-warning">
              <span class="warning-icon">⚠️</span>
              <span class="warning-text">此内容需要登录才能查看。爬虫已使用配置的认证信息访问，但直接点击链接可能需要您手动登录。</span>
            </div>
          </div>
          <div class="detail-item">
            <label>数据源:</label>
            <span>{{ selectedReview.sourceId }}</span>
          </div>
          <div class="detail-item">
            <label>语言:</label>
            <span>{{ getLangText(selectedReview.lang) }}</span>
          </div>
          <div class="detail-item">
            <label>版本:</label>
            <span>{{ selectedReview.version }}</span>
          </div>
          <div class="detail-item">
            <label>状态:</label>
            <span :class="getStatusClass(selectedReview.status)">
              {{ getStatusText(selectedReview.status) }}
            </span>
          </div>
          <div class="detail-item">
            <label>内容长度:</label>
            <span>{{ selectedReview.content.length }} 字符</span>
          </div>
          <div class="detail-item full-width">
            <label>内容:</label>
            <div class="content-preview">{{ selectedReview.content }}</div>
          </div>
        </div>
        <div class="modal-footer" v-if="selectedReview.status === 'pending'">
          <button class="btn-primary" @click="handleApprove(selectedReview.id)">
            批准
          </button>
          <button class="btn-secondary" @click="handleReject(selectedReview.id)">
            拒绝
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useGuiStore } from "../store/guiStore";
import DataTable from "../components/DataTable.vue";
import * as api from "../services/datapullApi";
import type { ReviewDTO, ReviewStatus } from "../types/common";

const guiStore = useGuiStore();
const filterStatus = ref<ReviewStatus>("pending");
const filterSourceId = ref("");
const selectedReviewIds = ref<string[]>([]);
const selectedReview = ref<ReviewDTO | null>(null);
const processing = ref(false);
const reviews = ref<ReviewDTO[]>([]);
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);
const copySuccess = ref(false);

// 检查是否需要认证
const requiresAuth = computed(() => {
  if (!selectedReview.value) return false;
  const source = guiStore.sources.find((s) => s.id === selectedReview.value?.sourceId);
  return source?.auth !== undefined && (
    source.auth?.cookies !== undefined ||
    source.auth?.authorization !== undefined ||
    (source.auth?.headers !== undefined && Object.keys(source.auth.headers).length > 0)
  );
});

const pagination = computed(() => ({
  page: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  onChange: (page: number) => {
    currentPage.value = page;
    loadReviews();
  },
}));

// HTML转义函数
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const columns = [
  { key: "sourceId", label: "源ID" },
  { key: "title", label: "标题" },
  {
    key: "url",
    label: "URL",
    render: (v: string) => {
      const escapedUrl = escapeHtml(v);
      const displayUrl = v.length > 50 ? v.substring(0, 50) + "..." : v;
      const escapedDisplayUrl = escapeHtml(displayUrl);
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" style="color: #3498db; text-decoration: none; word-break: break-all;">${escapedDisplayUrl}</a>`;
    },
  },
  {
    key: "status",
    label: "状态",
    formatter: (v: string) => {
      const map: Record<string, string> = {
        pending: "待审查",
        approved: "已批准",
        rejected: "已拒绝",
      };
      return map[v] || v;
    },
  },
  {
    key: "lang",
    label: "语言",
    formatter: (v: string) => {
      const map: Record<string, string> = {
        ja: "日语",
        zh: "中文",
        en: "英语",
      };
      return map[v] || v;
    },
  },
  {
    key: "content",
    label: "内容长度",
    formatter: (v: string) => `${v.length} 字符`,
  },
  { key: "createdAt", label: "创建时间", formatter: (v: string) => new Date(v).toLocaleString("zh-CN") },
  {
    key: "actions",
    label: "操作",
    render: (v: any, row: ReviewDTO) => {
      const viewId = `view-${row.id}`;
      const approveId = `approve-${row.id}`;
      const rejectId = `reject-${row.id}`;
      if (row.status === "pending") {
        return `
          <button id="${viewId}" class="table-btn">查看</button>
          <button id="${approveId}" class="table-btn">批准</button>
          <button id="${rejectId}" class="table-btn">拒绝</button>
        `;
      }
      return `<button id="${viewId}" class="table-btn">查看</button>`;
    },
  },
];

onMounted(async () => {
  await guiStore.loadSources();
  await loadReviews();
  
  // 使用事件委托处理按钮点击
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("table-btn")) {
      const buttonId = target.id;
      if (buttonId.startsWith("view-")) {
        const id = buttonId.replace("view-", "");
        viewReview(id);
      } else if (buttonId.startsWith("approve-")) {
        const id = buttonId.replace("approve-", "");
        handleApprove(id);
      } else if (buttonId.startsWith("reject-")) {
        const id = buttonId.replace("reject-", "");
        handleReject(id);
      }
    }
  });
});

async function loadReviews() {
  try {
    const result = await api.getReviews({
      status: filterStatus.value,
      sourceId: filterSourceId.value || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
    reviews.value = result.items;
    total.value = result.total;
  } catch (error) {
    console.error("加载审查列表失败", error);
  }
}

function handleRowSelect(ids: string[]) {
  selectedReviewIds.value = ids;
}

async function handleApprove(id: string) {
  if (processing.value) return;
  processing.value = true;
  try {
    await api.approveReview(id);
    await loadReviews();
    if (selectedReview.value?.id === id) {
      closeDetail();
    }
    alert("批准成功");
  } catch (error: any) {
    console.error("批准失败", error);
    alert("批准失败: " + (error?.message || "未知错误"));
  } finally {
    processing.value = false;
  }
}

async function handleReject(id: string) {
  if (processing.value) return;
  processing.value = true;
  try {
    await api.rejectReview(id);
    await loadReviews();
    if (selectedReview.value?.id === id) {
      closeDetail();
    }
    alert("拒绝成功");
  } catch (error: any) {
    console.error("拒绝失败", error);
    alert("拒绝失败: " + (error?.message || "未知错误"));
  } finally {
    processing.value = false;
  }
}

async function handleBatchApprove() {
  if (selectedReviewIds.value.length === 0 || processing.value) return;
  if (!confirm(`确定要批准 ${selectedReviewIds.value.length} 个文档吗？`)) return;

  processing.value = true;
  try {
    const result = await api.batchApproveReviews(selectedReviewIds.value);
    selectedReviewIds.value = [];
    await loadReviews();
    alert(`成功批准 ${result.approved} 个文档`);
  } catch (error: any) {
    console.error("批量批准失败", error);
    alert("批量批准失败: " + (error?.message || "未知错误"));
  } finally {
    processing.value = false;
  }
}

async function handleBatchReject() {
  if (selectedReviewIds.value.length === 0 || processing.value) return;
  if (!confirm(`确定要拒绝 ${selectedReviewIds.value.length} 个文档吗？`)) return;

  processing.value = true;
  try {
    const result = await api.batchRejectReviews(selectedReviewIds.value);
    selectedReviewIds.value = [];
    await loadReviews();
    alert(`成功拒绝 ${result.rejected} 个文档`);
  } catch (error: any) {
    console.error("批量拒绝失败", error);
    alert("批量拒绝失败: " + (error?.message || "未知错误"));
  } finally {
    processing.value = false;
  }
}

async function viewReview(id: string) {
  try {
    const review = await api.getReview(id);
    if (review) {
      selectedReview.value = review;
    } else {
      alert("审查文档不存在");
    }
  } catch (error: any) {
    console.error("获取审查详情失败", error);
    const errorMessage = error?.message || error?.code || "未知错误";
    alert("获取审查详情失败: " + errorMessage);
  }
}

function closeDetail() {
  selectedReview.value = null;
}

function getStatusText(status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    pending: "待审查",
    approved: "已批准",
    rejected: "已拒绝",
  };
  return map[status] || status;
}

function getStatusClass(status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    pending: "status-pending",
    approved: "status-approved",
    rejected: "status-rejected",
  };
  return map[status] || "";
}

function getLangText(lang: string): string {
  const map: Record<string, string> = {
    ja: "日语",
    zh: "中文",
    en: "英语",
  };
  return map[lang] || lang;
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  } catch (error) {
    // 降级方案：使用传统方法
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 2000);
    } catch (err) {
      console.error("复制失败", err);
      alert("复制失败，请手动复制");
    }
    document.body.removeChild(textArea);
  }
}

</script>

<style scoped>
.review-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.filters select {
  min-width: 150px;
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
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.large {
  max-width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.modal-header h3 {
  margin: 0;
  flex: 1;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-item {
  display: flex;
  gap: 1rem;
}

.detail-item label {
  font-weight: 500;
  min-width: 100px;
}

.url-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.url-link {
  color: #3498db;
  text-decoration: none;
  word-break: break-all;
  flex: 1;
}

.url-link:hover {
  text-decoration: underline;
}

.copy-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #2980b9;
}

.auth-warning {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #856404;
}

.warning-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.warning-text {
  flex: 1;
  line-height: 1.5;
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

.table-btn:last-of-type {
  background: #27ae60;
}

.table-btn:last-of-type:hover {
  background: #229954;
}

.table-btn:nth-of-type(3) {
  background: #e74c3c;
}

.table-btn:nth-of-type(3):hover {
  background: #c0392b;
}

.detail-item.full-width {
  flex-direction: column;
}

.content-preview {
  max-height: 400px;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.status-pending {
  color: #f39c12;
}

.status-approved {
  color: #27ae60;
}

.status-rejected {
  color: #e74c3c;
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}
</style>

