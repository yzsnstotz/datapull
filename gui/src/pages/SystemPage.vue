<template>
  <div class="system-page">
    <div class="page-header">
      <h2>系统状态</h2>
      <button class="btn-primary" @click="loadSystemStatus">刷新</button>
    </div>

    <div v-if="guiStore.systemStatus" class="stats-grid">
      <StatCard
        label="版本"
        :value="guiStore.systemStatus.version"
      />
      <StatCard
        label="运行时间"
        :value="formatUptime(guiStore.systemStatus.appUptimeSec)"
      />
      <StatCard
        label="CPU 使用率"
        :value="`${guiStore.systemStatus.cpuUsage.toFixed(1)}%`"
      />
      <StatCard
        label="内存使用率"
        :value="`${guiStore.systemStatus.memUsage.toFixed(1)}%`"
      />
      <StatCard
        label="磁盘可用"
        :value="`${guiStore.systemStatus.diskFreeGB.toFixed(1)} GB`"
      />
      <StatCard
        label="队列大小"
        :value="guiStore.systemStatus.queueSize"
      />
      <StatCard
        label="DriveQuiz 连通性"
        :value="guiStore.systemStatus.driveQuizReachable ? '已连通' : '未连通'"
      />
    </div>

    <div v-else class="loading">加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useGuiStore } from "../store/guiStore";
import StatCard from "../components/StatCard.vue";

const guiStore = useGuiStore();

let statusInterval: number | null = null;

onMounted(async () => {
  await loadSystemStatus();
  // 定期刷新状态
  statusInterval = window.setInterval(loadSystemStatus, 5000);
});

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval);
  }
});

async function loadSystemStatus() {
  try {
    await guiStore.loadSystemStatus();
  } catch (error) {
    console.error("加载系统状态失败", error);
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}
</script>

<style scoped>
.system-page {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #999;
}
</style>

