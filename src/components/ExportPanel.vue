<script setup lang="ts">
import { ref } from 'vue'
import { exportColorListCsv, exportGridPng, resolveExportScale } from '../core/exporter'
import type { GridRenderOptions } from '../core/grid'
import type { MatchStats } from '../core/matcher'
import type { Palette } from '../types'

const props = defineProps<{
  cells: (string | null)[]
  width: number
  height: number
  palette: Palette
  stats: MatchStats[]
  gridOptions: GridRenderOptions
}>()

const scale = ref(2)
const includeLegend = ref(true)
const busy = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)

const SCALE_OPTIONS = [1, 2, 3]

async function onExportPng() {
  busy.value = true
  message.value = null
  error.value = null
  try {
    const used = await exportGridPng(
      { width: props.width, height: props.height, cells: props.cells },
      props.palette,
      props.stats,
      props.gridOptions,
      { scale: scale.value, includeLegend: includeLegend.value },
      `perler-${props.width}x${props.height}.png`,
    )
    message.value =
      used < scale.value
        ? `已导出 PNG（图形较大，已自动用 ${used.toFixed(2)}x）`
        : `已导出 PNG（${used}x）`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function onExportCsv() {
  message.value = null
  error.value = null
  try {
    exportColorListCsv(props.stats, props.palette, `perler-colors-${props.width}x${props.height}.csv`)
    message.value = '已导出用色清单 CSV'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// 供界面提示当前实际可用倍率上限
const maxScale = () =>
  resolveExportScale(
    { width: props.width, height: props.height, cells: props.cells },
    props.gridOptions,
    Infinity,
  )
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-4">
    <h3 class="mb-3 text-sm font-semibold text-slate-700">导出</h3>

    <div class="space-y-3">
      <div>
        <span class="mb-1 block text-xs text-slate-500">清晰度</span>
        <div class="flex gap-2">
          <button
            v-for="s in SCALE_OPTIONS"
            :key="s"
            type="button"
            class="flex-1 rounded-lg border px-2 py-1.5 text-xs transition disabled:opacity-40"
            :class="scale === s ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
            :disabled="s > maxScale()"
            @click="scale = s"
          >
            {{ s }}x
          </button>
        </div>
      </div>

      <label class="flex items-center gap-1.5 text-xs text-slate-600">
        <input v-model="includeLegend" type="checkbox" class="accent-indigo-500" />
        附带用色清单
      </label>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          :disabled="busy"
          @click="onExportPng"
        >
          {{ busy ? '导出中…' : '导出 PNG' }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400"
          @click="onExportCsv"
        >
          清单 CSV
        </button>
      </div>

      <p v-if="message" class="text-xs text-emerald-600">{{ message }}</p>
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
