<template>
  <div class="tasks-page">
    <div class="page-header">
      <h2>任务控制</h2>
      <div class="task-actions">
        <button
          v-if="!guiStore.isTaskRunning"
          class="btn-success"
          :disabled="selectedSourceIds.length === 0"
          @click="handleStart"
        >
          启动任务 ({{ selectedSourceIds.length }})
        </button>
        <button
          v-else
          class="btn-danger"
          @click="handleStop"
        >
          停止任务
        </button>
      </div>
    </div>

    <!-- 数据源选择 -->
    <div class="card">
      <h3>选择数据源</h3>
      <div class="sources-selection">
        <div class="selection-header">
          <label class="select-all-checkbox">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleSelectAll"
            />
            <span>全选</span>
          </label>
          <span class="selected-count">已选择 {{ selectedSourceIds.length }} / {{ enabledSources.length }}</span>
        </div>
        <div class="sources-list">
          <label
            v-for="source in enabledSources"
            :key="source.id"
            class="source-item"
          >
            <input
              type="checkbox"
              :value="source.id"
              v-model="selectedSourceIds"
            />
            <div class="source-info">
              <span class="source-name">{{ source.name }}</span>
              <span class="source-id">({{ source.id }})</span>
            </div>
          </label>
        </div>
        <div v-if="enabledSources.length === 0" class="no-sources">
          没有可用的数据源，请先在"数据源管理"中创建数据源
        </div>
      </div>
    </div>

    <div class="card">
      <h3>任务状态</h3>
      <div class="status-info">
        <div class="status-item">
          <span class="label">状态:</span>
          <span :class="['badge', `badge-${getStatusClass(guiStore.taskStatus.status)}`]">
            {{ getStatusText(guiStore.taskStatus.status) }}
          </span>
        </div>
        <div v-if="guiStore.taskStatus.startedAt" class="status-item">
          <span class="label">开始时间:</span>
          <span>{{ formatTime(guiStore.taskStatus.startedAt) }}</span>
        </div>
        <div v-if="guiStore.taskStatus.runningSources.length > 0" class="status-item">
          <span class="label">运行中的源:</span>
          <span>{{ guiStore.taskStatus.runningSources.join(", ") }}</span>
        </div>
      </div>
    </div>

    <div v-if="guiStore.taskStatus.progress" class="card">
      <h3>进度</h3>
      <div
        v-for="(progress, sourceId) in guiStore.taskStatus.progress"
        :key="sourceId"
        class="progress-item"
      >
        <div class="progress-header">
          <span class="source-id">{{ sourceId }}</span>
        </div>
        <div class="progress-stats">
          <div>已访问页面: {{ progress.pagesVisited }}</div>
          <div>生成分片: {{ progress.chunksGenerated }}</div>
          <div>已上传: {{ progress.uploaded }}</div>
          <div>失败: {{ progress.failed }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useGuiStore } from "../store/guiStore";
import * as api from "../services/datapullApi";
import type { Source } from "../types/common";

const guiStore = useGuiStore();
const selectedSourceIds = ref<string[]>([]);

let statusInterval: number | null = null;

// 获取启用的数据源
const enabledSources = computed(() => {
  return guiStore.sources.filter((s) => s.enabled);
});

// 全选状态
const allSelected = computed(() => {
  return enabledSources.value.length > 0 &&
    selectedSourceIds.value.length === enabledSources.value.length;
});

// 部分选中状态
const someSelected = computed(() => {
  return selectedSourceIds.value.length > 0 &&
    selectedSourceIds.value.length < enabledSources.value.length;
});

// 全选/取消全选
function toggleSelectAll() {
  if (allSelected.value) {
    selectedSourceIds.value = [];
  } else {
    selectedSourceIds.value = enabledSources.value.map((s) => s.id);
  }
}

onMounted(async () => {
  await guiStore.loadSources();
  await guiStore.loadTaskStatus();
  
  // 默认选择所有启用的数据源
  selectedSourceIds.value = enabledSources.value.map((s) => s.id);
  
  // 定期刷新状态
  statusInterval = window.setInterval(async () => {
    await guiStore.loadTaskStatus();
  }, 2000);
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    idle: "空闲",
    running: "运行中",
    stopped: "已停止",
    error: "错误",
  };
  return map[status] || status;
}

function getStatusClass(status: string): string {
  const map: Record<string, string> = {
    idle: "info",
    running: "success",
    stopped: "warning",
    error: "danger",
  };
  return map[status] || "info";
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleString("zh-CN");
}

async function handleStart() {
  if (selectedSourceIds.value.length === 0) {
    alert("请至少选择一个数据源");
    return;
  }
  
  try {
    await api.startTasks({
      sourceIds: selectedSourceIds.value,
      mode: "full",
    });
    await guiStore.loadTaskStatus();
  } catch (error) {
    console.error("启动任务失败", error);
    const errorMessage = (error as any)?.message || (error as any)?.code || "未知错误";
    alert("启动任务失败: " + errorMessage);
  }
}

async function handleStop() {
  try {
    await api.stopTasks();
    await guiStore.loadTaskStatus();
  } catch (error) {
    console.error("停止任务失败", error);
    alert("停止任务失败: " + (error as any).message);
  }
}
</script>

<style scoped>
.tasks-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.label {
  font-weight: 500;
  min-width: 100px;
}

.progress-item {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.progress-header {
  margin-bottom: 0.5rem;
}

.source-id {
  font-weight: 600;
  color: #2c3e50;
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.sources-selection {
  margin-top: 1rem;
}

.selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.select-all-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
}

.select-all-checkbox input {
  cursor: pointer;
}

.selected-count {
  color: #666;
  font-size: 0.875rem;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
  padding: 0.5rem;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.source-item:hover {
  background: #f8f9fa;
  border-color: #3498db;
}

.source-item input {
  cursor: pointer;
  flex-shrink: 0;
}

.source-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.source-name {
  font-weight: 500;
  color: #2c3e50;
}

.source-id {
  font-size: 0.875rem;
  color: #7f8c8d;
}

.no-sources {
  padding: 2rem;
  text-align: center;
  color: #7f8c8d;
  background: #f8f9fa;
  border-radius: 4px;
}

.btn-success:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>

