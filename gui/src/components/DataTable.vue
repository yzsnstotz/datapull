<template>
  <div class="data-table">
    <table class="table">
      <thead>
        <tr>
          <th v-if="selectable" style="width: 50px">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleAll"
            />
          </th>
          <th
            v-for="column in columns"
            :key="column.key"
            :style="{ width: column.width ? `${column.width}px` : 'auto' }"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <td v-if="selectable">
            <input
              type="checkbox"
              :checked="selectedIds.includes(getRowId(row))"
              @change="toggleRow(getRowId(row))"
            />
          </td>
          <td v-for="column in columns" :key="column.key">
            <span v-if="column.render" v-html="column.render(getNestedValue(row, column.key), row)"></span>
            <span v-else-if="column.formatter">
              {{ column.formatter(getNestedValue(row, column.key), row) }}
            </span>
            <span v-else>{{ getNestedValue(row, column.key) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="pagination" class="pagination">
      <button
        @click="pagination.onChange(pagination.page - 1)"
        :disabled="pagination.page <= 1"
      >
        上一页
      </button>
      <span>
        第 {{ pagination.page }} 页，共
        {{ Math.ceil(pagination.total / pagination.pageSize) }} 页
      </span>
      <button
        @click="pagination.onChange(pagination.page + 1)"
        :disabled="pagination.page >= Math.ceil(pagination.total / pagination.pageSize)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

interface Column {
  key: string;
  label: string;
  width?: number;
  formatter?: (value: any, row: any) => string;
  render?: (value: any, row: any) => string; // 返回HTML字符串
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

const props = defineProps<{
  columns: Column[];
  rows: any[];
  pagination?: Pagination;
  selectable?: boolean;
  rowIdKey?: string;
}>();

const emit = defineEmits<{
  (e: "rowSelect", ids: string[]): void;
}>();

const selectedIds = ref<string[]>([]);

const allSelected = computed(() => {
  if (props.rows.length === 0) return false;
  return props.rows.every((row) =>
    selectedIds.value.includes(getRowId(row))
  );
});

function getRowId(row: any): string {
  return props.rowIdKey ? row[props.rowIdKey] : row.id || String(row);
}

function getNestedValue(row: any, key: string): any {
  // 支持嵌套的 key，如 "meta.contentHash"
  const keys = key.split(".");
  let value = row;
  for (const k of keys) {
    if (value == null) return undefined;
    value = value[k];
  }
  return value;
}

function toggleRow(id: string) {
  const index = selectedIds.value.indexOf(id);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(id);
  }
  emit("rowSelect", selectedIds.value);
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = props.rows.map((row) => getRowId(row));
  }
  emit("rowSelect", selectedIds.value);
}

watch(
  () => props.rows,
  () => {
    selectedIds.value = [];
  }
);
</script>

<style scoped>
.data-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.pagination {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #eee;
}
</style>

