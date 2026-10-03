<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import ColorStats from './components/ColorStats.vue'
import ExportPanel from './components/ExportPanel.vue'
import GridPreview from './components/GridPreview.vue'
import GridSettings from './components/GridSettings.vue'
import ImageUploader from './components/ImageUploader.vue'
import PaletteSelect from './components/PaletteSelect.vue'
import PixelPreview from './components/PixelPreview.vue'
import ProjectPanel from './components/ProjectPanel.vue'
import SizeSettings from './components/SizeSettings.vue'
import { DEFAULT_GRID_OPTIONS } from './core/grid'
import type { GridRenderOptions } from './core/grid'
import { hasTransparency, loadImageData } from './core/image'
import { pixelate, setSourceImage } from './core/pixelateClient'
import { guessBackgroundFromCorners } from './core/pixelate'
import type { BackgroundMode } from './core/pixelate'
import type { DitherMode, RGB } from './types'
import { DEFAULT_PALETTE_ID, getPalette, PALETTES } from './data/palettes'
import { newProjectId, normalizeSettings, PROJECT_VERSION } from './core/project'
import type { ProjectMeta, ProjectRecord, ProjectSettingsSnapshot } from './core/project'
import { deleteProject, listProjects, loadProject, saveProject } from './core/projectStore'
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
const removeColor = shallowRef<RGB | null>(null)
const tolerance = ref(30)
const picking = ref(false)
const sourceHasAlpha = ref(false)
const minCoverage = ref(15)
const livePreview = ref(true)
const maxColors = ref(0)
const dither = ref<DitherMode>('none')
const ditherStrength = ref(1)

const COLOR_LIMITS = [8, 12, 16, 20, 24, 32]

const result = shallowRef<PixelateResponse | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

const sourceFile = shallowRef<Blob | null>(null)
const projects = ref<ProjectMeta[]>([])
const projectBusy = ref(false)
const projectMessage = ref<string | null>(null)
const projectError = ref<string | null>(null)

const viewMode = ref<'pixel' | 'grid'>('pixel')
const gridOptions = ref<GridRenderOptions>({ ...DEFAULT_GRID_OPTIONS })

const palette = computed(() => getPalette(paletteId.value))
const hasSource = computed(() => sourceUrl.value !== null)

const toHex = (rgb: RGB) =>
  '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
const removeColorHex = computed(() => (removeColor.value ? toHex(removeColor.value) : null))
const removeColorText = computed(() =>
  removeColor.value ? `${toHex(removeColor.value)}（${removeColor.value.join(', ')}）` : '未选择',
)

const clampSide = (v: number) => Math.max(1, Math.min(MAX_SIDE, Math.round(v)))

let running = false
let queued = false
let disposed = false
let timer: ReturnType<typeof setTimeout> | undefined

/**
 * 执行一次像素化。
 * 如果已有任务在跑，不并发发出，而是标记 queued；当前任务结束时会用**最新**参数再跑一次。
 * 这样拖动滑块时始终只保留最新一次计算，不会堆积请求。
 */
async function run() {
  if (disposed || !sourceReady.value) return
  if (running) {
    queued = true
    return
  }
  running = true
  busy.value = true
  error.value = null
  try {
    const res = await pixelate({
      targetWidth: targetWidth.value,
      targetHeight: targetHeight.value,
      background: background.value,
      removeColor: removeColor.value ? [...removeColor.value] : undefined,
      tolerance: tolerance.value,
      minCoverage: minCoverage.value / 100,
      maxColors: maxColors.value || undefined,
      dither: dither.value,
      ditherStrength: ditherStrength.value,
      palette: palette.value,
    })
    result.value = res
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    running = false
    if (queued && !disposed) {
      queued = false
      void run()
    } else {
      busy.value = false
    }
  }
}

/** 结构性改动（尺寸/色卡/模式等）：稍作防抖，避免连续触发 */
function scheduleRun() {
  clearTimeout(timer)
  timer = setTimeout(run, 120)
}

/** 实时控件（容差/边缘阈值/抖动强度）：立即请求，由 run() 内部合并 */
function requestRun() {
  clearTimeout(timer)
  void run()
}

/** 实时控件变化：开启实时预览时立即跑，否则退回防抖 */
function onLiveChange() {
  if (livePreview.value) requestRun()
  else scheduleRun()
}

async function onSelectFile(file: File) {
  error.value = null
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceFile.value = file
  sourceUrl.value = URL.createObjectURL(file)
  sourceName.value = file.name
  sourceReady.value = false
  result.value = null
  try {
    const imageData = await loadImageData(file)
    aspect.value = imageData.width / imageData.height
    sourceHasAlpha.value = hasTransparency(imageData)

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

function onPick(color: RGB) {
  removeColor.value = color
  picking.value = false
}

function autoPickBackground() {
  const res = result.value
  if (!res) return
  const color = guessBackgroundFromCorners(res.samples, res.width, res.height)
  if (color) {
    removeColor.value = color
    picking.value = false
  }
}

// ---- 工程保存 / 加载 ----

function defaultSettings(): ProjectSettingsSnapshot {
  return {
    targetWidth: DEFAULT_LONG_SIDE,
    targetHeight: DEFAULT_LONG_SIDE,
    locked: true,
    paletteId: DEFAULT_PALETTE_ID,
    background: 'keep',
    removeColor: null,
    tolerance: 30,
    minCoverage: 15,
    maxColors: 0,
    dither: 'none',
    ditherStrength: 1,
    gridOptions: { ...DEFAULT_GRID_OPTIONS },
  }
}

function collectSettings(): ProjectSettingsSnapshot {
  return {
    targetWidth: targetWidth.value,
    targetHeight: targetHeight.value,
    locked: locked.value,
    paletteId: paletteId.value,
    background: background.value,
    removeColor: removeColor.value ? ([...removeColor.value] as RGB) : null,
    tolerance: tolerance.value,
    minCoverage: minCoverage.value,
    maxColors: maxColors.value,
    dither: dither.value,
    ditherStrength: ditherStrength.value,
    gridOptions: { ...gridOptions.value },
  }
}

function applySettings(s: ProjectSettingsSnapshot) {
  targetWidth.value = s.targetWidth
  targetHeight.value = s.targetHeight
  locked.value = s.locked
  paletteId.value = s.paletteId
  background.value = s.background
  removeColor.value = s.removeColor ? ([...s.removeColor] as RGB) : null
  tolerance.value = s.tolerance
  minCoverage.value = s.minCoverage
  maxColors.value = s.maxColors
  dither.value = s.dither
  ditherStrength.value = s.ditherStrength
  gridOptions.value = { ...s.gridOptions }
}

async function refreshProjects() {
  try {
    projects.value = await listProjects()
  } catch (e) {
    projectError.value = e instanceof Error ? e.message : String(e)
  }
}

async function onSaveProject(name: string) {
  const file = sourceFile.value
  if (!file) return
  projectBusy.value = true
  projectError.value = null
  projectMessage.value = null
  try {
    const now = Date.now()
    const existing = name ? projects.value.find((p) => p.name === name) : undefined
    const record: ProjectRecord = {
      version: PROJECT_VERSION,
      id: existing?.id ?? newProjectId(),
      name: name || sourceName.value || `工程 ${new Date(now).toLocaleString()}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sourceName: sourceName.value,
      source: file,
      settings: collectSettings(),
    }
    await saveProject(record)
    await refreshProjects()
    projectMessage.value = `已保存「${record.name}」`
  } catch (e) {
    projectError.value = e instanceof Error ? e.message : String(e)
  } finally {
    projectBusy.value = false
  }
}

async function onLoadProject(id: string) {
  projectBusy.value = true
  projectError.value = null
  projectMessage.value = null
  try {
    const record = await loadProject(id)
    if (!record) throw new Error('工程不存在或已删除')
    const imageData = await loadImageData(record.source)
    aspect.value = imageData.width / imageData.height
    sourceHasAlpha.value = hasTransparency(imageData)
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = URL.createObjectURL(record.source)
    sourceName.value = record.sourceName
    sourceFile.value = record.source
    sourceReady.value = false
    result.value = null
    applySettings(normalizeSettings(record.settings, defaultSettings()))
    await setSourceImage(imageData)
    sourceReady.value = true
    await run()
    projectMessage.value = `已加载「${record.name}」`
  } catch (e) {
    projectError.value = e instanceof Error ? e.message : String(e)
  } finally {
    projectBusy.value = false
  }
}

async function onDeleteProject(id: string) {
  projectBusy.value = true
  projectError.value = null
  projectMessage.value = null
  try {
    await deleteProject(id)
    await refreshProjects()
    projectMessage.value = '已删除工程'
  } catch (e) {
    projectError.value = e instanceof Error ? e.message : String(e)
  } finally {
    projectBusy.value = false
  }
}

onMounted(refreshProjects)

watch(
  [targetWidth, targetHeight, paletteId, background, maxColors, dither, removeColor],
  scheduleRun,
)
// 实时：拖动这些滑块时尽快刷新预览
watch([tolerance, minCoverage, ditherStrength], onLiveChange)

onUnmounted(() => {
  disposed = true
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
              <label class="block">
                <span class="mb-1 block text-xs text-slate-500">抖动</span>
                <select
                  v-model="dither"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                >
                  <option value="none">无</option>
                  <option value="floyd-steinberg">误差扩散（Floyd–Steinberg）</option>
                  <option value="ordered">有序抖动（Bayer）</option>
                </select>
              </label>
              <label v-if="dither === 'ordered'" class="block">
                <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>抖动强度</span>
                  <span>{{ ditherStrength.toFixed(1) }}</span>
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  :value="ditherStrength"
                  class="w-full accent-indigo-500"
                  @input="ditherStrength = Number(($event.target as HTMLInputElement).value)"
                />
              </label>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-lg border px-2 py-2 text-xs transition"
                  :class="background === 'keep' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
                  @click="background = 'keep'"
                >
                  保留背景
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-lg border px-2 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="background === 'transparent' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
                  :disabled="hasSource && !sourceHasAlpha"
                  @click="background = 'transparent'"
                >
                  透明背景
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-lg border px-2 py-2 text-xs transition"
                  :class="background === 'remove' ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-500'"
                  @click="background = 'remove'"
                >
                  去除背景
                </button>
              </div>
              <p class="text-[11px] leading-4 text-slate-400">
                「透明背景」仅对自带透明通道的图片（如抠好的 PNG）有效，普通照片与「保留背景」效果相同，请用「去除背景」。
              </p>

              <div
                v-if="background === 'remove'"
                class="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="h-6 w-6 shrink-0 rounded border border-slate-300"
                    :style="{ backgroundColor: removeColorHex ?? '#ffffff' }"
                  />
                  <span class="truncate text-xs text-slate-600">{{ removeColorText }}</span>
                </div>
                <label class="block">
                  <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>容差</span>
                    <span>{{ tolerance }}</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="tolerance"
                    class="w-full accent-indigo-500"
                    @input="tolerance = Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <label class="block">
                  <span class="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>边缘阈值（前景占比）</span>
                    <span>{{ minCoverage }}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    :value="minCoverage"
                    class="w-full accent-indigo-500"
                    @input="minCoverage = Number(($event.target as HTMLInputElement).value)"
                  />
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex-1 rounded-lg border px-2 py-1.5 text-xs transition"
                    :class="picking ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 text-slate-600'"
                    @click="picking = !picking; viewMode = 'pixel'"
                  >
                    {{ picking ? '点击预览拾取…' : '拾取背景色' }}
                  </button>
                  <button
                    type="button"
                    class="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-600 transition"
                    :disabled="!result"
                    @click="autoPickBackground"
                  >
                    自动取四角
                  </button>
                </div>
                <p class="text-[11px] leading-4 text-slate-400">
                  容差越大去除越多；边缘阈值用于过滤零星的残留色块。去掉的格子不放豆子，也不参与配色统计。
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 class="mb-2 text-sm font-semibold text-slate-700">4. 工程</h2>
            <ProjectPanel
              :projects="projects"
              :can-save="hasSource"
              :busy="projectBusy"
              @save="onSaveProject"
              @load="onLoadProject"
              @delete="onDeleteProject"
            />
            <p v-if="projectMessage" class="mt-2 text-xs text-emerald-600">{{ projectMessage }}</p>
            <p v-if="projectError" class="mt-2 text-xs text-red-600">{{ projectError }}</p>
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
              <div class="flex items-center gap-3">
                <span v-if="busy" class="text-xs text-slate-400">计算中…</span>
                <label class="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                  <input v-model="livePreview" type="checkbox" class="accent-indigo-500" />
                  实时预览
                </label>
              </div>
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
                :samples="result.samples"
                :pick-mode="picking"
                @pick="onPick"
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
