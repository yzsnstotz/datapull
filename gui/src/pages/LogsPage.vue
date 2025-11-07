<template>
  <div class="logs-page">
    <div class="page-header">
      <h2>日志查看</h2>
      <div class="filters">
        <select v-model="filterType" @change="loadLogs">
          <option value="">全部类型</option>
          <option value="system">系统</option>
          <option value="crawl">爬取</option>
          <option value="upload">上传</option>
        </select>
        <select v-model="filterLevel" @change="loadLogs">
          <option value="">全部级别</option>
          <option value="info">信息</option>
          <option value="warn">警告</option>
          <option value="error">错误</option>
        </select>
        <select v-model="filterSourceId" @change="loadLogs">
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
    </div>

    <LogViewer :logs="guiStore.logs" :auto-scroll="true" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useGuiStore } from "../store/guiStore";
import LogViewer from "../components/LogViewer.vue";

const guiStore = useGuiStore();
const filterType = ref<"system" | "crawl" | "upload" | "">("");
const filterLevel = ref("");
const filterSourceId = ref("");
let refreshInterval: number | null = null;

onMounted(async () => {
  await guiStore.loadSources();
  await loadLogs();
  // 定期刷新日志（如果日志未被清空）
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
});

// 监听清空标志，如果已清空则停止自动刷新
watch(() => guiStore.logsCleared, (cleared) => {
  if (cleared) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
  }
});

// 监听筛选条件变化，重置清空标志并重新加载
watch([filterType, filterLevel, filterSourceId], () => {
  guiStore.resetLogsCleared();
  loadLogs();
});

function startAutoRefresh() {
  if (refreshInterval) {
    return;
  }
  refreshInterval = window.setInterval(() => {
    // 如果日志已清空，不自动刷新
    if (!guiStore.logsCleared) {
      loadLogs();
    }
  }, 5000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

async function loadLogs() {
  try {
    await guiStore.loadLogs({
      type: filterType.value || undefined,
      level: filterLevel.value || undefined,
      sourceId: filterSourceId.value || undefined,
      limit: 1000,
    });
  } catch (error) {
    console.error("加载日志失败", error);
  }
}
</script>

<style scoped>
.logs-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.filters {
  display: flex;
  gap: 1rem;
}

.filters select {
  min-width: 150px;
}
</style>

