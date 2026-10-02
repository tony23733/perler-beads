// 最近色匹配：把取样颜色匹配到色卡里最接近的色号。
// 使用 CIEDE2000 色差（人眼感知更准），并按输入 RGB 做缓存。

import { deltaE2000, rgbToLab } from './color'
import type { BeadColor, Palette, RGB } from '../types'

export interface ColorMatcher {
  /** 返回色卡中与给定 RGB 最接近的颜色 */
  nearest(rgb: RGB): BeadColor
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
  const cache = new Map<number, BeadColor>()

  function nearest(rgb: RGB): BeadColor {
    const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    const hit = cache.get(key)
    if (hit) return hit

    const lab = rgbToLab(rgb)
    let best = colors[0]
    let bestDist = Infinity
    for (let i = 0; i < colors.length; i++) {
      const d = deltaE2000(lab, colors[i].lab)
      if (d < bestDist) {
        bestDist = d
        best = colors[i]
      }
    }
    cache.set(key, best)
    return best
  }

  return { nearest }
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
