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
