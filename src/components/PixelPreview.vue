<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Palette, RGB } from '../types'

const props = defineProps<{
  cells: (string | null)[]
  width: number
  height: number
  palette: Palette
  /** 原始取样色（未做背景去除），用于点击拾取背景色 */
  samples?: (RGB | null)[]
  /** 是否处于「拾取背景色」模式 */
  pickMode?: boolean
  /** 是否处于手工编辑模式 */
  editMode?: boolean
  /** 编辑工具 */
  tool?: 'paint' | 'eyedropper'
}>()

const emit = defineEmits<{
  pick: [color: RGB]
  'cell-paint': [index: number]
  'cell-pick': [index: number]
  'paint-end': []
}>()

let painting = false

function cellIndexAt(e: MouseEvent | PointerEvent): number | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * props.width)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * props.height)
  if (x < 0 || y < 0 || x >= props.width || y >= props.height) return null
  return y * props.width + x
}

function onCanvasClick(e: MouseEvent) {
  if (!props.pickMode || !props.samples) return
  const index = cellIndexAt(e)
  if (index === null) return
  const color = props.samples[index]
  if (color) emit('pick', color)
}

function onPointerDown(e: PointerEvent) {
  if (props.pickMode) return // 拾取背景色走 click
  if (!props.editMode) return
  const index = cellIndexAt(e)
  if (index === null) return
  if (props.tool === 'eyedropper') {
    emit('cell-pick', index)
    return
  }
  painting = true
  emit('cell-paint', index)
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!painting) return
  const index = cellIndexAt(e)
  if (index !== null) emit('cell-paint', index)
}

function endPaint() {
  if (!painting) return
  painting = false
  emit('paint-end')
}

const canvasEl = ref<HTMLCanvasElement | null>(null)

function render() {
  const canvas = canvasEl.value
  if (!canvas || props.width < 1 || props.height < 1) return

  const colorMap = new Map(props.palette.colors.map((c) => [c.id, c.hex]))
  canvas.width = props.width
  canvas.height = props.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, props.width, props.height)

  for (let y = 0; y < props.height; y++) {
    for (let x = 0; x < props.width; x++) {
      const id = props.cells[y * props.width + x]
      if (!id) continue
      ctx.fillStyle = colorMap.get(id) ?? '#000000'
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

onMounted(render)
watch(
  () => [props.cells, props.width, props.height, props.palette] as const,
  render,
  { flush: 'post' },
)
</script>

<template>
  <div class="flex justify-center overflow-auto rounded-xl border bg-white p-3"
    :class="pickMode || editMode ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'">
    <canvas
      ref="canvasEl"
      class="block w-full max-w-[520px]"
      :class="pickMode || editMode ? 'cursor-crosshair' : ''"
      style="image-rendering: pixelated"
      :style="{ aspectRatio: `${width} / ${height}`, touchAction: editMode ? 'none' : undefined }"
      @click="onCanvasClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endPaint"
      @pointercancel="endPaint"
    />
  </div>
</template>
