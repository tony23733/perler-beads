<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import ColorStats from './components/ColorStats.vue'
import ExportPanel from './components/ExportPanel.vue'
import GridPreview from './components/GridPreview.vue'
import GridSettings from './components/GridSettings.vue'
import ImageUploader from './components/ImageUploader.vue'
import PaletteSelect from './components/PaletteSelect.vue'
import PixelPreview from './components/PixelPreview.vue'
import SizeSettings from './components/SizeSettings.vue'
import { DEFAULT_GRID_OPTIONS } from './core/grid'
import type { GridRenderOptions } from './core/grid'
import { loadImageData } from './core/image'
import { pixelate, setSourceImage } from './core/pixelateClient'
import type { BackgroundMode } from './core/pixelate'
import { DEFAULT_PALETTE_ID, getPalette, PALETTES } from './data/palettes'
import type { PixelateResponse } from './workers/pixelate.worker'

const DEFAULT_LONG_SIDE = 50
const MAX_SIDE = 300

const paletteList = [PALETTES.mard, PALETTES.mard291]

const sourceUrl = ref<string | null>(null)
const sourceName = ref('')
const sourceReady = ref(false)

const targetWidth = ref(DEFAULT_LONG_SIDE)
const targetHeight = ref(DEFAULT_LONG_SIDE)
const locked = ref(true)
const aspect = ref(1)

const paletteId = ref<string>(DEFAULT_PALETTE_ID)
const background = ref<BackgroundMode>('keep')
const maxColors = ref(0)

const COLOR_LIMITS = [8, 12, 16, 20, 24, 32]

const result = shallowRef<PixelateResponse | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

const viewMode = ref<'pixel' | 'grid'>('pixel')
const gridOptions = ref<GridRenderOptions>({ ...DEFAULT_GRID_OPTIONS })

const palette = computed(() => getPalette(paletteId.value))
const hasSource = computed(() => sourceUrl.value !== null)

const clampSide = (v: number) => Math.max(1, Math.min(MAX_SIDE, Math.round(v)))

let runToken = 0
let timer: ReturnType<typeof setTimeout> | undefined

async function run() {
  if (!sourceReady.value) return
  const token = ++runToken
  busy.value = true
  error.value = null
  try {
    const res = await pixelate({
      targetWidth: targetWidth.value,
      targetHeight: targetHeight.value,
      background: background.value,
      maxColors: maxColors.value || undefined,
      palette: palette.value,
    })
    if (token !== runToken) return
    result.value = res
  } catch (e) {
    if (token !== runToken) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (token === runToken) busy.value = false
  }
}

function scheduleRun() {
  clearTimeout(timer)
  timer = setTimeout(run, 150)
}

async function onSelectFile(file: File) {
  error.value = null
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = URL.createObjectURL(file)
  sourceName.value = file.name
  sourceReady.value = false
  result.value = null
  try {
    const imageData = await loadImageData(file)
    aspect.value = imageData.width / imageData.height

    // 默认让长边 = 50 颗，保持比例
    if (imageData.width >= imageData.height) {
      targetWidth.value = DEFAULT_LONG_SIDE
      targetHeight.value = clampSide((DEFAULT_LONG_SIDE * imageData.height) / imageData.width)
    } else {
      targetHeight.value = DEFAULT_LONG_SIDE
      targetWidth.value = clampSide((DEFAULT_LONG_SIDE * imageData.width) / imageData.height)
    }

    await setSourceImage(imageData)
    sourceReady.value = true
    await run()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function onWidth(value: number) {
  targetWidth.value = value
  if (locked.value && aspect.value > 0) targetHeight.value = clampSide(value / aspect.value)
}

function onHeight(value: number) {
  targetHeight.value = value
  if (locked.value && aspect.value > 0) targetWidth.value = clampSide(value * aspect.value)
}

watch([targetWidth, targetHeight, paletteId, background, maxColors], scheduleRun)

onUnmounted(() => {
  clearTimeout(timer)
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
})
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-5xl px-4 py-4">
        <h1 class="text-xl font-bold">拼豆图纸生成器</h1>
        <p class="mt-0.5 text-xs text-slate-500">
          第一阶段 · 纯本地 · 图片不上传 · 色卡 MARD 221 / 291
        </p>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-6">
      <div class="grid gap-6 lg:grid-cols-[320px_1fr]">
        <!-- 左：设置 -->
        <section class="space-y-5">
          <div>
            <h2 class="mb-2 text-sm font-semibold text-slate-700">1. 选择图片</h2>
            <ImageUploader @select="onSelectFile" />
            <div v-if="hasSource" class="mt-3 flex items-center gap-3">
              <img
                :src="sourceUrl ?? undefined"
                alt="原图"
                class="h-14 w-14 rounded-lg border border-slate-200 object-cover"
              />
              <span class="truncate text-xs text-slate-500">{{ sourceName }}</span>
            </div>
          </div>

          <div>
            <h2 class="mb-2 text-sm font-semibold text-slate-700">2. 网格尺寸</h2>
            <SizeSettings
              :width="targetWidth"
              :height="targetHeight"
              :locked="locked"
              @update:width="onWidth"
              @update:height="onHeight"
              @update:locked="locked = $event"
            />
          </div>

          <div>
            <h2 class="mb-2 text-sm font-semibold text-slate-700">3. 色卡与背景</h2>
            <div class="space-y-3">
              <PaletteSelect v-model="paletteId" :palettes="paletteList" />
              <label class="block">
                <span class="mb-1 block text-xs text-slate-500">颜色数量</span>
                <select
                  v-model.number="maxColors"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option :value="0">不限制（用多少算多少）</option>
                  <option v-for="n in COLOR_LIMITS" :key="n" :value="n">{{ n }} 色以内</option>
                </select>
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-lg border px-3 py-2 text-sm transition"
                  :class="background === 'keep' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
                  @click="background = 'keep'"
                >
                  保留背景
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-lg border px-3 py-2 text-sm transition"
                  :class="background === 'transparent' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
                  @click="background = 'transparent'"
                >
                  透明背景
                </button>
              </div>
            </div>
          </div>

          <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {{ error }}
          </p>
        </section>

        <!-- 右：预览与统计 -->
        <section class="space-y-5">
          <div>
            <div class="mb-2 flex items-center justify-between">
              <div class="flex gap-1 rounded-lg bg-slate-200 p-0.5">
                <button
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition"
                  :class="viewMode === 'pixel' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
                  @click="viewMode = 'pixel'"
                >
                  像素预览
                </button>
                <button
                  type="button"
                  class="rounded-md px-3 py-1 text-xs font-medium transition"
                  :class="viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'"
                  @click="viewMode = 'grid'"
                >
                  网格图纸
                </button>
              </div>
              <span v-if="busy" class="text-xs text-slate-400">计算中…</span>
            </div>

            <div
              v-if="!hasSource"
              class="flex h-56 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm text-slate-400"
            >
              选择一张图片开始
            </div>

            <template v-else-if="result">
              <GridSettings
                v-if="viewMode === 'grid'"
                v-model="gridOptions"
                class="mb-3 rounded-xl border border-slate-200 bg-white p-3"
              />

              <PixelPreview
                v-if="viewMode === 'pixel'"
                :cells="result.cells"
                :width="result.width"
                :height="result.height"
                :palette="palette"
              />
              <GridPreview
                v-else
                :cells="result.cells"
                :width="result.width"
                :height="result.height"
                :palette="palette"
                :options="gridOptions"
              />
            </template>
          </div>

          <ColorStats v-if="result" :stats="result.stats" :palette="palette" />

          <ExportPanel
            v-if="result"
            :cells="result.cells"
            :width="result.width"
            :height="result.height"
            :palette="palette"
            :stats="result.stats"
            :grid-options="gridOptions"
          />

          <footer class="text-xs text-slate-400">
            色卡数据来源：HansBug/pindou-color-data（MIT）。色值为屏幕参考值，请以实物色卡为准。
          </footer>
        </section>
      </div>
    </main>
  </div>
</template>
