// 最近色匹配：把取样颜色匹配到色卡里最接近的色号。
// 使用 CIEDE2000 色差（人眼感知更准），并按输入 RGB 做缓存。

import { deltaE2000, rgbToLab } from './color'
import type { BeadColor, Palette, RGB } from '../types'

export interface TwoNearest {
  first: BeadColor
  second: BeadColor
  d1: number
  d2: number
}

export interface ColorMatcher {
  /** 返回色卡中与给定 RGB 最接近的颜色 */
  nearest(rgb: RGB): BeadColor
  /** 返回最近的两个颜色及各自色差（用于有序抖动） */
  nearest2(rgb: RGB): TwoNearest
}

/**
 * 基于一套色卡创建匹配器。内部按量化后的 RGB 缓存结果，
 * 大量重复颜色（纯色/扁平图）时非常快。
 */
export function createMatcher(palette: Palette): ColorMatcher {
  const colors = palette.colors
  if (colors.length === 0) {
    throw new Error('色卡为空，无法匹配')
  }
  const cache = new Map<number, TwoNearest>()

  function nearest2(rgb: RGB): TwoNearest {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    const hit = cache.get(key)
    if (hit) return hit

    const lab = rgbToLab(rgb)
    let first = colors[0]
    let second = colors[0]
    let d1 = Infinity
    let d2 = Infinity
    for (let i = 0; i < colors.length; i++) {
      const d = deltaE2000(lab, colors[i].lab)
      if (d < d1) {
        d2 = d1
        second = first
        d1 = d
        first = colors[i]
      } else if (d < d2) {
        d2 = d
        second = colors[i]
      }
    }
    const result: TwoNearest = { first, second, d1, d2 }
    cache.set(key, result)
    return result
  }

  return {
    nearest: (rgb) => nearest2(rgb).first,
    nearest2,
  }
}

export interface MatchStats {
  /** 色号 */
  id: string
  count: number
}

export interface MatchResult {
  cells: (string | null)[]
  stats: MatchStats[]
}

/** 逐格匹配，并统计各色号用量（按用量降序） */
export function matchPixels(pixels: (RGB | null)[], matcher: ColorMatcher): MatchResult {
  const cells: (string | null)[] = new Array(pixels.length)
  const counts = new Map<string, number>()

  for (let i = 0; i < pixels.length; i++) {
    const px = pixels[i]
    if (!px) {
      cells[i] = null
      continue
    }
    const color = matcher.nearest(px)
    cells[i] = color.id
    counts.set(color.id, (counts.get(color.id) ?? 0) + 1)
  }

  const stats = Array.from(counts, ([id, count]) => ({ id, count })).sort(
    (a, b) => b.count - a.count || a.id.localeCompare(b.id),
  )

  return { cells, stats }
}

/**
 * 从已确定的色号数组统计用量（按用量降序）。
 * 用于手工编辑后的重新统计——不再走颜色匹配，直接数。
 */
export function statsFromCells(cells: (string | null)[]): MatchStats[] {
  const counts = new Map<string, number>()
  for (let i = 0; i < cells.length; i++) {
    const id = cells[i]
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return Array.from(counts, ([id, count]) => ({ id, count })).sort(
    (a, b) => b.count - a.count || a.id.localeCompare(b.id),
  )
}
