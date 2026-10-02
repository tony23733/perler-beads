<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ select: [file: File] }>()

const inputEl = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

function openPicker() {
  inputEl.value?.click()
}

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('select', file)
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('select', file)
}
</script>

<template>
  <div
    class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition"
    :class="dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-slate-400'"
    role="button"
    tabindex="0"
    @click="openPicker"
    @keydown.enter.prevent="openPicker"
    @keydown.space.prevent="openPicker"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <p class="text-sm font-medium text-slate-700">点击选择图片，或拖拽到此处</p>
    <p class="mt-1 text-xs text-slate-400">支持 JPG / PNG / WEBP · 图片不会上传</p>
    <input ref="inputEl" type="file" accept="image/*" class="hidden" @change="onInput" />
  </div>
</template>
