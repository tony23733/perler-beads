<script setup lang="ts">
import type { GridDisplay, GridRenderOptions } from '../core/grid'

const props = defineProps<{ modelValue: GridRenderOptions }>()
const emit = defineEmits<{ 'update:modelValue': [value: GridRenderOptions] }>()

function patch<K extends keyof GridRenderOptions>(key: K, value: GridRenderOptions[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const DISPLAY_OPTIONS: Array<{ value: GridDisplay; label: string }> = [
  { value: 'color', label: '纯色' },
  { value: 'code', label: '仅色号' },
  { value: 'both', label: '填色+色号' },
]
</script>

<template>
  <div class="space-y-3">
    <div>
      <span class="mb-1 block text-xs text-slate-500">显示方式</span>
      <div class="flex gap-2">
        <button
          v-for="opt in DISPLAY_OPTIONS"
          :key="opt.value"
          type="button"
          class="flex-1 rounded-lg border px-2 py-1.5 text-xs transition"
          :class="
            modelValue.display === opt.value
              ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
              : 'border-slate-300 text-slate-500'
          "
          @click="patch('display', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <label class="block">
      <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>格子大小</span>
        <span>{{ modelValue.cellSize }} px</span>
      </span>
      <input
        type="range"
        min="10"
        max="48"
        step="2"
        :value="modelValue.cellSize"
        class="w-full accent-indigo-500"
        @input="patch('cellSize', Number((($event.target as HTMLInputElement).value)))"
      />
    </label>

    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
      <label class="flex items-center gap-1.5">
        <input
          type="checkbox"
          :checked="modelValue.showGrid"
          class="accent-indigo-500"
          @change="patch('showGrid', ($event.target as HTMLInputElement).checked)"
        />
        网格线
      </label>
      <label class="flex items-center gap-1.5">
        <input
          type="checkbox"
          :checked="modelValue.showCoordinates"
          class="accent-indigo-500"
          @change="patch('showCoordinates', ($event.target as HTMLInputElement).checked)"
        />
        行列坐标
      </label>
      <label class="flex items-center gap-1.5">
        粗线间隔
        <select
          :value="modelValue.majorEvery"
          class="rounded border border-slate-300 px-1 py-0.5"
          @change="patch('majorEvery', Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="0">无</option>
          <option :value="5">每 5 格</option>
          <option :value="10">每 10 格</option>
        </select>
      </label>
    </div>
  </div>
</template>
