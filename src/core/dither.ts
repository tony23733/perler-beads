// 抖动：在最近色匹配时扩散量化误差，用更多色号换取更平滑的渐变/照片观感。
//
// - floyd-steinberg：误差扩散，把每像素的量化误差按 7/3/5/1 分给右、左下、下、右下。
// - ordered：Bayer 4×4 有序抖动，在最近的两个色卡色之间按比例选择。
//
// 在 RGB 空间做抖动（快，且与色卡匹配配合良好）；null（空格）不参与也不接收误差。

import { matchPixels } from './matcher'
import type { ColorMatcher, MatchResult, MatchStats } from './matcher'
import type { DitherMode, RGB } from '../types'

// Bayer 4×4 阈值矩阵（0-15）
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

function statsFromCounts(counts: Map<string, number>): MatchStats[] {
  return Array.from(counts, ([id, count]) => ({ id, count })).sort(
    (a, b) => b.count - a.count || a.id.localeCompare(b.id),
  )
}

/** 统一入口：按模式选择匹配方式；none 等价于逐像素独立匹配 */
export function matchPixelsDither(
  pixels: (RGB | null)[],
  width: number,
  height: number,
  matcher: ColorMatcher,
  mode: DitherMode = 'none',
  strength = 1,
): MatchResult {
  if (mode === 'floyd-steinberg') return floydSteinberg(pixels, width, height, matcher)
  if (mode === 'ordered') return orderedDither(pixels, width, height, matcher, strength)
  return matchPixels(pixels, matcher)
}

/** Floyd–Steinberg 误差扩散 */
export function floydSteinberg(
  pixels: (RGB | null)[],
  width: number,
  height: number,
  matcher: ColorMatcher,
): MatchResult {
  const n = width * height
  const buf = new Float32Array(n * 3)
  const valid = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const p = pixels[i]
    if (p) {
      buf[i * 3] = p[0]
      buf[i * 3 + 1] = p[1]
      buf[i * 3 + 2] = p[2]
      valid[i] = 1
    }
  }

  const cells: (string | null)[] = new Array(n)
  const counts = new Map<string, number>()

  const diffuse = (x: number, y: number, dx: number, dy: number, f: number, er: number, eg: number, eb: number) => {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return
    const j = ny * width + nx
    if (!valid[j]) return
    buf[j * 3] += er * f
    buf[j * 3 + 1] += eg * f
    buf[j * 3 + 2] += eb * f
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!valid[i]) {
        cells[i] = null
        continue
      }
      const r = clamp255(buf[i * 3])
      const g = clamp255(buf[i * 3 + 1])
      const b = clamp255(buf[i * 3 + 2])
      const color = matcher.nearest([Math.round(r), Math.round(g), Math.round(b)])
      cells[i] = color.id
      counts.set(color.id, (counts.get(color.id) ?? 0) + 1)

      const er = r - color.rgb[0]
      const eg = g - color.rgb[1]
      const eb = b - color.rgb[2]
      diffuse(x, y, 1, 0, 7 / 16, er, eg, eb)
      diffuse(x, y, -1, 1, 3 / 16, er, eg, eb)
      diffuse(x, y, 0, 1, 5 / 16, er, eg, eb)
      diffuse(x, y, 1, 1, 1 / 16, er, eg, eb)
    }
  }

  return { cells, stats: statsFromCounts(counts) }
}

/** Bayer 4×4 有序抖动 */
export function orderedDither(
  pixels: (RGB | null)[],
  width: number,
  height: number,
  matcher: ColorMatcher,
  strength = 1,
): MatchResult {
  const cells: (string | null)[] = new Array(width * height)
  const counts = new Map<string, number>()

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const p = pixels[i]
      if (!p) {
        cells[i] = null
        continue
      }

      // 只在最近的两个色卡色之间抖动：
      // ratio = d1 / (d1 + d2)，表示「选中第二近色」的比例。
      // 像素正好命中色卡色时 d1 = 0 → ratio = 0，不会产生杂色点。
      const { first, second, d1, d2 } = matcher.nearest2(p)
      const total = d1 + d2
      let ratio = Number.isFinite(total) && total > 0 ? d1 / total : 0
      ratio = Math.min(1, ratio * strength)

      // Bayer 阈值 ∈ (0, 1)
      const threshold = (BAYER4[y & 3][x & 3] + 0.5) / 16
      const color = threshold < ratio ? second : first
      cells[i] = color.id
      counts.set(color.id, (counts.get(color.id) ?? 0) + 1)
    }
  }

  return { cells, stats: statsFromCounts(counts) }
}
