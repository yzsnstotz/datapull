<template>
  <div class="log-viewer">
    <div class="log-header">
      <h3>日志</h3>
      <button @click="clearLogs">清空</button>
    </div>
    <div ref="logContainer" class="log-content">
      <div
        v-for="(log, index) in logs"
        :key="index"
        :class="['log-entry', `log-${log.level}`]"
      >
        <span class="log-time">{{ formatTime(log.ts) }}</span>
        <span class="log-type">{{ log.type }}</span>
        <span class="log-level">{{ log.level }}</span>
        <span class="log-message">{{ log.message }}</span>
        <span v-if="log.sourceId" class="log-source">{{ log.sourceId }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useGuiStore } from "../store/guiStore";
import type { LogEntry } from "../../src/gui/types/common";

const props = defineProps<{
  logs: LogEntry[];
  autoScroll?: boolean;
}>();

const guiStore = useGuiStore();
const logContainer = ref<HTMLElement | null>(null);

function formatTime(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleTimeString("zh-CN");
}

function clearLogs() {
  guiStore.clearLogs();
}

watch(
  () => props.logs,
  () => {
    if (props.autoScroll && logContainer.value) {
      nextTick(() => {
        logContainer.value!.scrollTop = logContainer.value!.scrollHeight;
      });
    }
  },
  { deep: true }
);
</script>

<style scoped>
.log-viewer {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  height: 500px;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  font-family: "Courier New", monospace;
  font-size: 0.85rem;
}

.log-entry {
  padding: 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  display: grid;
  grid-template-columns: 120px 80px 60px 1fr 150px;
  gap: 1rem;
}

.log-time {
  color: #666;
}

.log-type {
  color: #3498db;
}

.log-level {
  font-weight: 600;
}

.log-info {
  color: #3498db;
}

.log-warn {
  color: #f39c12;
}

.log-error {
  color: #e74c3c;
}

.log-message {
  flex: 1;
}

.log-source {
  color: #666;
  font-size: 0.8rem;
}
</style>

