<script setup lang="ts">
import type { Palette } from '../types'

defineProps<{
  editMode: boolean
  tool: 'paint' | 'eyedropper'
  activeColor: string | null
  palette: Palette
  canUndo: boolean
  canRedo: boolean
  editCount: number
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:edit-mode': [value: boolean]
  'update:tool': [value: 'paint' | 'eyedropper']
  'update:active-color': [value: string | null]
  undo: []
  redo: []
  clear: []
}>()

const activeHex = (palette: Palette, id: string | null) =>
  id ? (palette.colors.find((c) => c.id === id)?.hex ?? '#ffffff') : null
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-3">
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          class="accent-indigo-500"
          :checked="editMode"
          @change="emit('update:edit-mode', ($event.target as HTMLInputElement).checked)"
        />
        手工编辑
      </label>

      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 disabled:opacity-40"
          :disabled="!canUndo"
          title="撤销 (Ctrl+Z)"
          @click="emit('undo')"
        >
          撤销
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:border-slate-400 disabled:opacity-40"
          :disabled="!canRedo"
          title="重做 (Ctrl+Shift+Z)"
          @click="emit('redo')"
        >
          重做
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-400 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40"
          :disabled="editCount === 0"
          @click="emit('clear')"
        >
          清除编辑
        </button>
      </div>
    </div>

    <template v-if="editMode">
      <div class="mt-3 flex items-center gap-2">
        <div class="flex gap-1 rounded-lg bg-slate-200 p-0.5">
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition"
            :class="tool === 'paint' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
            @click="emit('update:tool', 'paint')"
          >
            涂色
          </button>
          <button
            type="button"
            class="rounded-md px-2 py-1 text-xs font-medium transition"
            :class="tool === 'eyedropper' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
            @click="emit('update:tool', 'eyedropper')"
          >
            吸管
          </button>
        </div>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition"
          :class="activeColor === null ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-600'"
          @click="emit('update:active-color', null)"
        >
          <span class="inline-block h-4 w-4 rounded-sm border border-slate-300 bg-white" />
          擦除
        </button>

        <span v-if="activeColor" class="flex items-center gap-1.5 text-xs text-slate-600">
          <span
            class="inline-block h-4 w-4 rounded-sm border border-black/10"
            :style="{ backgroundColor: activeHex(palette, activeColor) ?? '#fff' }"
          />
          {{ activeColor }}
        </span>
      </div>

      <div class="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 p-2">
        <div class="flex flex-wrap gap-1">
          <button
            v-for="c in palette.colors"
            :key="c.id"
            type="button"
            class="h-5 w-5 rounded-sm border transition"
            :class="activeColor === c.id ? 'border-white ring-2 ring-indigo-500' : 'border-black/10'"
            :style="{ backgroundColor: c.hex }"
            :title="c.id"
            @click="emit('update:active-color', c.id)"
          />
        </div>
      </div>

      <p class="mt-2 text-[11px] text-slate-400">
        在像素预览上点击/拖动进行涂色；吸管工具点格子取色。共 {{ editCount }} 处手工修改。
      </p>
    </template>
  </div>
</template>
