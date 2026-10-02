<script setup lang="ts">
import { ref, watch } from 'vue'
import { DEFAULT_GRID_OPTIONS, measureGrid, renderGrid } from '../core/grid'
import type { Grid2DContext, GridRenderOptions } from '../core/grid'
import type { Palette } from '../types'

const props = defineProps<{
  cells: (string | null)[]
  width: number
  height: number
  palette: Palette
  options: GridRenderOptions
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)

function render() {
  const canvas = canvasEl.value
  if (!canvas || props.width < 1 || props.height < 1) return

  const opts = { ...DEFAULT_GRID_OPTIONS, ...props.options }
  const size = measureGrid(props.width, props.height, opts)
  canvas.width = size.width
  canvas.height = size.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  renderGrid(
    ctx as unknown as Grid2DContext,
    { width: props.width, height: props.height, cells: props.cells },
    props.palette,
    opts,
  )
}

watch(
  () => [props.cells, props.width, props.height, props.palette, props.options] as const,
  render,
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="overflow-auto rounded-xl border border-slate-200 bg-white p-2">
    <canvas ref="canvasEl" class="mx-auto block h-auto max-w-full" />
  </div>
</template>
