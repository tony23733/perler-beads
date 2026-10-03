// 工程数据模型：可序列化的设置快照 + 工程记录。
// 纯逻辑（normalize）放这里便于单测；真正的读写见 projectStore.ts（IndexedDB）。

import { DEFAULT_GRID_OPTIONS } from './grid'
import type { GridRenderOptions } from './grid'
import type { BackgroundMode } from './pixelate'
import type { DitherMode, RGB } from '../types'

/** 工程文件/记录版本，便于以后迁移 */
export const PROJECT_VERSION = 1

/** 可保存/恢复的全部界面设置 */
export interface ProjectSettingsSnapshot {
  targetWidth: number
  targetHeight: number
  locked: boolean
  paletteId: string
  background: BackgroundMode
  removeColor: RGB | null
  tolerance: number
  minCoverage: number
  maxColors: number
  dither: DitherMode
  ditherStrength: number
  gridOptions: GridRenderOptions
}

/** 完整工程记录（含源图 Blob 与设置） */
export interface ProjectRecord {
  version: number
  id: string
  name: string
  createdAt: number
  updatedAt: number
  sourceName: string
  /** 原始图片文件（存 IndexedDB 用 Blob，无需 base64） */
  source: Blob
  settings: ProjectSettingsSnapshot
}

/** 列表用的轻量元信息（不含大字段） */
export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  sourceName: string
}

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)))

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

function normalizeRgb(v: unknown): RGB | null {
  if (!Array.isArray(v) || v.length !== 3) return null
  const rgb = v.map((x) => clampInt(num(x, 0), 0, 255))
  return [rgb[0], rgb[1], rgb[2]]
}

/**
 * 把可能不完整/损坏的设置补齐为合法快照（向后兼容、容错）。
 * 缺失字段用 defaults 补。
 */
export function normalizeSettings(
  raw: Partial<ProjectSettingsSnapshot> | null | undefined,
  defaults: ProjectSettingsSnapshot,
): ProjectSettingsSnapshot {
  if (!raw || typeof raw !== 'object') {
    return { ...defaults, gridOptions: { ...defaults.gridOptions } }
  }
  const background: BackgroundMode =
    raw.background === 'transparent' || raw.background === 'remove' ? raw.background : 'keep'
  const dither: DitherMode =
    raw.dither === 'floyd-steinberg' || raw.dither === 'ordered' ? raw.dither : 'none'

  return {
    targetWidth: clampInt(num(raw.targetWidth, defaults.targetWidth), 1, 100000),
    targetHeight: clampInt(num(raw.targetHeight, defaults.targetHeight), 1, 100000),
    locked: typeof raw.locked === 'boolean' ? raw.locked : defaults.locked,
    paletteId: typeof raw.paletteId === 'string' && raw.paletteId ? raw.paletteId : defaults.paletteId,
    background,
    removeColor: normalizeRgb(raw.removeColor),
    tolerance: clampInt(num(raw.tolerance, defaults.tolerance), 0, 441),
    minCoverage: clampInt(num(raw.minCoverage, defaults.minCoverage), 0, 100),
    maxColors: clampInt(num(raw.maxColors, defaults.maxColors), 0, 1000),
    dither,
    ditherStrength: num(raw.ditherStrength, defaults.ditherStrength),
    gridOptions: {
      ...DEFAULT_GRID_OPTIONS,
      ...defaults.gridOptions,
      ...(raw.gridOptions ?? {}),
    },
  }
}

/** 生成一个唯一 id（浏览器/Node 均有 crypto） */
export function newProjectId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ---- 工程文件（导出/导入，真正的磁盘文件）----

/** 可下载/可导入的工程文件格式（源图用 base64 内嵌） */
export interface ProjectFile {
  type: 'perler-beads-project'
  version: number
  name: string
  sourceName: string
  sourceMime: string
  /** 源图 base64（不含 data: 前缀） */
  sourceBase64: string
  settings: ProjectSettingsSnapshot
}

export const PROJECT_FILE_TYPE = 'perler-beads-project'

/** Blob → base64（分块避免调用栈溢出），浏览器/Node 通用 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x4000
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** base64 → Blob */
export function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

/** 把工程记录序列化为文件文本 */
export async function serializeProjectFile(record: ProjectRecord): Promise<string> {
  const file: ProjectFile = {
    type: PROJECT_FILE_TYPE,
    version: record.version,
    name: record.name,
    sourceName: record.sourceName,
    sourceMime: record.source.type || 'application/octet-stream',
    sourceBase64: await blobToBase64(record.source),
    settings: record.settings,
  }
  return JSON.stringify(file)
}

export interface ParsedProjectFile {
  version: number
  name: string
  sourceName: string
  source: Blob
  settings: ProjectSettingsSnapshot
}

/** 解析并校验工程文件文本；非法格式抛错 */
export function parseProjectFile(
  text: string,
  defaults: ProjectSettingsSnapshot,
): ParsedProjectFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('工程文件不是合法的 JSON')
  }
  if (!raw || typeof raw !== 'object') throw new Error('工程文件格式错误')
  const obj = raw as Partial<ProjectFile>
  if (obj.type !== PROJECT_FILE_TYPE) throw new Error('不是拼豆工程文件')
  if (typeof obj.sourceBase64 !== 'string' || !obj.sourceBase64) throw new Error('工程文件缺少源图')
  return {
    version: typeof obj.version === 'number' ? obj.version : PROJECT_VERSION,
    name: typeof obj.name === 'string' && obj.name ? obj.name : '导入的工程',
    sourceName: typeof obj.sourceName === 'string' && obj.sourceName ? obj.sourceName : 'source.png',
    source: base64ToBlob(obj.sourceBase64, typeof obj.sourceMime === 'string' ? obj.sourceMime : 'image/png'),
    settings: normalizeSettings(obj.settings, defaults),
  }
}
