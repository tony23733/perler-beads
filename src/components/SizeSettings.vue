<script setup lang="ts">
const props = defineProps<{
  width: number
  height: number
  locked: boolean
}>()

const emit = defineEmits<{
  'update:width': [value: number]
  'update:height': [value: number]
  'update:locked': [value: boolean]
}>()

const WIDTH_PRESETS = [29, 50, 58, 78]

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 1
  return Math.max(1, Math.min(300, Math.round(v)))
}

function onWidth(e: Event) {
  emit('update:width', clamp((e.target as HTMLInputElement).valueAsNumber))
}

function onHeight(e: Event) {
  emit('update:height', clamp((e.target as HTMLInputElement).valueAsNumber))
}

function applyPreset(size: number) {
  emit('update:width', size)
  emit('update:height', size)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-end gap-3">
      <label class="flex-1">
        <span class="mb-1 block text-xs text-slate-500">宽（颗）</span>
        <input
          type="number"
          min="1"
          max="300"
          :value="props.width"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          @input="onWidth"
        />
      </label>

      <button
        type="button"
        class="mb-1 rounded-lg border px-3 py-2 text-sm transition"
        :class="props.locked ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
        :title="props.locked ? '已锁定宽高比' : '未锁定宽高比'"
        @click="emit('update:locked', !props.locked)"
      >
        {{ props.locked ? '🔒' : '🔓' }}
      </button>

      <label class="flex-1">
        <span class="mb-1 block text-xs text-slate-500">高（颗）</span>
        <input
          type="number"
          min="1"
          max="300"
          :value="props.height"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          @input="onHeight"
        />
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="p in WIDTH_PRESETS"
        :key="p"
        type="button"
        class="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
        @click="applyPreset(p)"
      >
        {{ p }}×{{ p }}
      </button>
    </div>
  </div>
</template>
