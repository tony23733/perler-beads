<script setup lang="ts">
import type { Palette } from '../types'

defineProps<{
  modelValue: string
  palettes: Palette[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="block">
    <span class="mb-1 block text-xs text-slate-500">色卡</span>
    <select
      :value="modelValue"
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      @change="onChange"
    >
      <option v-for="p in palettes" :key="p.id" :value="p.id">
        {{ p.nameZh }}（{{ p.colorCount }} 色）
      </option>
    </select>
  </label>
</template>
