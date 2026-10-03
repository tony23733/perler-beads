<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectMeta } from '../core/project'

const props = defineProps<{
  projects: ProjectMeta[]
  canSave: boolean
  busy?: boolean
  defaultName?: string
}>()

const emit = defineEmits<{
  save: [name: string]
  load: [id: string]
  delete: [id: string]
  'export-file': []
  'import-file': [file: File]
}>()

const name = ref(props.defaultName ?? '')
const fileEl = ref<HTMLInputElement | null>(null)

function onSave() {
  if (!props.canSave) return
  emit('save', name.value.trim())
  name.value = ''
}

function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('import-file', file)
  input.value = ''
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex gap-2">
      <input
        v-model="name"
        type="text"
        placeholder="工程名称（可留空）"
        class="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        @keydown.enter="onSave"
      />
      <button
        type="button"
        class="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        :disabled="!canSave || busy"
        @click="onSave"
      >
        保存
      </button>
    </div>
    <p v-if="!canSave" class="text-[11px] text-slate-400">先选择一张图片才能保存工程。</p>

    <div class="flex gap-2">
      <button
        type="button"
        class="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 transition hover:border-slate-400 disabled:opacity-40"
        :disabled="!canSave || busy"
        @click="emit('export-file')"
      >
        导出工程文件
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 transition hover:border-slate-400"
        :disabled="busy"
        @click="fileEl?.click()"
      >
        导入工程文件
      </button>
      <input
        ref="fileEl"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="onImport"
      />
    </div>

    <ul v-if="projects.length" class="max-h-56 space-y-1 overflow-auto">
      <li
        v-for="p in projects"
        :key="p.id"
        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-slate-700">{{ p.name }}</p>
          <p class="truncate text-[11px] text-slate-400">
            {{ p.sourceName }} · {{ formatTime(p.updatedAt) }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
          :disabled="busy"
          @click="emit('load', p.id)"
        >
          加载
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-400 transition hover:border-red-300 hover:text-red-500"
          :disabled="busy"
          @click="emit('delete', p.id)"
        >
          删除
        </button>
      </li>
    </ul>
    <p v-else class="text-[11px] text-slate-400">还没有保存的工程。</p>
  </div>
</template>
