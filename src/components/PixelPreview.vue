<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Palette } from '../types'

const props = defineProps<{
  cells: (string | null)[]
  width: number
  height: number
  palette: Palette
}>()

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
  <div class="flex justify-center overflow-auto rounded-xl border border-slate-200 bg-white p-3">
    <canvas
      ref="canvasEl"
      class="block w-full max-w-[520px]"
      style="image-rendering: pixelated"
      :style="{ aspectRatio: `${width} / ${height}` }"
    />
  </div>
</template>
