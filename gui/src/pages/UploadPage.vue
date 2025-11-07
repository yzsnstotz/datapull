<template>
  <div class="upload-page">
    <div class="page-header">
      <h2>上传中心</h2>
      <button
        class="btn-primary"
        :disabled="selectedChunkIds.length === 0 || uploading"
        @click="handleUpload"
      >
        {{ uploading ? "上传中..." : `上传选中 (${selectedChunkIds.length})` }}
      </button>
    </div>

    <div class="filters">
      <select v-model="filterStatus" @change="loadChunks">
        <option value="pending">待上传</option>
        <option value="uploaded">已上传</option>
        <option value="failed">失败</option>
      </select>
      <select v-model="filterSourceId" @change="loadChunks">
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
      :rows="guiStore.chunks"
      :pagination="pagination"
      :selectable="true"
      @rowSelect="handleRowSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useGuiStore } from "../store/guiStore";
import DataTable from "../components/DataTable.vue";
import * as api from "../services/datapullApi";
import type { ChunkDTO } from "../types/common";

const guiStore = useGuiStore();
const filterStatus = ref<"pending" | "uploaded" | "failed">("pending");
const filterSourceId = ref("");
const selectedChunkIds = ref<string[]>([]);
const uploading = ref(false);
const currentPage = ref(1);
const pageSize = ref(50);
const total = ref(0);

const pagination = computed(() => ({
  page: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  onChange: (page: number) => {
    currentPage.value = page;
    loadChunks();
  },
}));

const columns = [
  { key: "sourceId", label: "源ID" },
  { 
    key: "meta.contentHash", 
    label: "分片编号",
    formatter: (v: string) => v ? v.substring(0, 16) + "..." : "-"
  },
  { key: "title", label: "标题" },
  { key: "url", label: "URL" },
  {
    key: "status",
    label: "状态",
    formatter: (v: string) => {
      const map: Record<string, string> = {
        pending: "待上传",
        uploaded: "已上传",
        failed: "失败",
      };
      return map[v] || v;
    },
  },
  { key: "createdAt", label: "创建时间", formatter: (v: string) => new Date(v).toLocaleString("zh-CN") },
];

onMounted(async () => {
  await guiStore.loadSources();
  await loadChunks();
});

async function loadChunks() {
  try {
    const result = await guiStore.loadChunks({
      status: filterStatus.value,
      sourceId: filterSourceId.value || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    });
    total.value = result.total;
  } catch (error) {
    console.error("加载分片失败", error);
  }
}

function handleRowSelect(ids: string[]) {
  selectedChunkIds.value = ids;
}

async function handleUpload() {
  if (selectedChunkIds.value.length === 0) return;

  uploading.value = true;
  try {
    await api.uploadBatch({
      chunkIds: selectedChunkIds.value,
      mode: "manual",
    });
    selectedChunkIds.value = [];
    await loadChunks();
    alert("上传成功");
  } catch (error) {
    console.error("上传失败", error);
    alert("上传失败: " + (error as any).message);
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.upload-page {
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
  margin-bottom: 1rem;
}

.filters select {
  min-width: 150px;
}
</style>

