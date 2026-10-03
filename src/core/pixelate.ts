// 图像降采样取样：把源图按目标网格做区域平均（box sampling），
// 并处理透明背景。

import type { RGB } from '../types'

/** 结构上与 ImageData 兼容，便于在 Node 中测试 */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export type BackgroundMode = 'keep' | 'transparent' | 'remove'

export interface DownsampleOptions {
  targetWidth: number
  targetHeight: number
  background: BackgroundMode
  /** 透明模式下 alpha 低于该值的格子视为空格（0-255） */
  alphaThreshold?: number
  /** remove 模式下去除的目标颜色（背景色） */
  removeColor?: RGB
  /** remove 模式的颜色容差：RGB 欧氏距离上限（0-441，默认 30） */
  tolerance?: number
}

export interface DownsampleResult {
  width: number
  height: number
  /** 每格的最终取样颜色（已应用背景处理）；null 表示空格/透明 */
  pixels: (RGB | null)[]
  /** 每格的原始平均色（未做背景去除），供界面「拾色」；全透明为 null */
  samples: (RGB | null)[]
}

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)))

/** RGB 欧氏距离（0-441） */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** 两个颜色是否在容差内 */
export function isSimilarColor(a: RGB, b: RGB, tolerance: number): boolean {
  return colorDistance(a, b) <= tolerance
}

/**
 * 从降采样结果的四个角猜测背景色：取四角中数量最多的一簇（容差内）的平均色。
 * 适合背景基本一致的常见照片。
 */
export function guessBackgroundFromCorners(
  samples: (RGB | null)[],
  width: number,
  height: number,
  tolerance = 40,
): RGB | null {
  if (width < 1 || height < 1) return null
  const corners = [
    samples[0],
    samples[width - 1],
    samples[(height - 1) * width],
    samples[height * width - 1],
  ].filter((c): c is RGB => c !== null && c !== undefined)
  if (corners.length === 0) return null

  let best: RGB | null = null
  let bestCount = 0
  for (const anchor of corners) {
    const group = corners.filter((c) => isSimilarColor(anchor, c, tolerance))
    if (group.length > bestCount) {
      bestCount = group.length
      best = [
        Math.round(group.reduce((s, c) => s + c[0], 0) / group.length),
        Math.round(group.reduce((s, c) => s + c[1], 0) / group.length),
        Math.round(group.reduce((s, c) => s + c[2], 0) / group.length),
      ]
    }
  }
  return best
}

/**
 * 把源图降采样到目标网格。
 * - 每个目标格子是其覆盖区域内所有源像素按 alpha 加权的平均色。
 * - background = 'keep'：与白色背景合成（适合 JPEG 等无透明图）。
 * - background = 'transparent'：平均 alpha 低于阈值 → null（不放豆子）。
 * - background = 'remove'：与 removeColor 距离在 tolerance 内的源像素被剔除，
 *   只用剩余（前景）像素求平均；整格都是背景则 → null。剔除在源像素级完成，
 *   避免边缘混色把背景带入。
 */
export function downsample(src: RgbaImage, opts: DownsampleOptions): DownsampleResult {
  const tw = clampInt(opts.targetWidth, 1, 100000)
  const th = clampInt(opts.targetHeight, 1, 100000)
  const alphaThreshold = opts.alphaThreshold ?? 128
  const removeColor = opts.background === 'remove' ? opts.removeColor : undefined
  const tolerance = opts.tolerance ?? 30
  const { data, width: sw, height: sh } = src
  if (sw < 1 || sh < 1) throw new Error('源图尺寸非法')

  const pixels: (RGB | null)[] = new Array(tw * th)
  const samples: (RGB | null)[] = new Array(tw * th)

  for (let cy = 0; cy < th; cy++) {
    // 反向映射：目标行 cy 对应源行区间 [y0, y1)，放大时至少含 1 行
    const y0 = Math.min(sh - 1, Math.floor((cy * sh) / th))
    const y1 = Math.max(y0 + 1, Math.min(sh, Math.floor(((cy + 1) * sh) / th)))
    for (let cx = 0; cx < tw; cx++) {
      const x0 = Math.min(sw - 1, Math.floor((cx * sw) / tw))
      const x1 = Math.max(x0 + 1, Math.min(sw, Math.floor(((cx + 1) * sw) / tw)))

      let sumR = 0
      let sumG = 0
      let sumB = 0
      let sumA = 0
      let count = 0
      // 前景（剔除背景色后）的累加
      let fgR = 0
      let fgG = 0
      let fgB = 0
      let fgA = 0
      let fgCount = 0
      for (let y = y0; y < y1; y++) {
        const rowBase = y * sw
        for (let x = x0; x < x1; x++) {
          const i = (rowBase + x) * 4
          const a = data[i + 3]
          const px: RGB = [data[i], data[i + 1], data[i + 2]]
          sumR += px[0] * a
          sumG += px[1] * a
          sumB += px[2] * a
          sumA += a
          count++

          if (removeColor && a > 0 && !isSimilarColor(px, removeColor, tolerance)) {
            fgR += px[0] * a
            fgG += px[1] * a
            fgB += px[2] * a
            fgA += a
            fgCount++
          }
        }
      }

      const idx = cy * tw + cx
      if (count === 0 || sumA === 0) {
        // 完全透明：keep → 白，其余 → 空
        pixels[idx] = opts.background === 'keep' ? [255, 255, 255] : null
        samples[idx] = null
        continue
      }

      const r = sumR / sumA
      const g = sumG / sumA
      const b = sumB / sumA
      samples[idx] = [Math.round(r), Math.round(g), Math.round(b)]

      if (opts.background === 'remove' && removeColor) {
        if (fgA === 0 || fgCount === 0) {
          pixels[idx] = null
        } else {
          pixels[idx] = [
            Math.round(fgR / fgA),
            Math.round(fgG / fgA),
            Math.round(fgB / fgA),
          ]
        }
      } else if (opts.background === 'transparent') {
        const avgA = sumA / count
        pixels[idx] = avgA < alphaThreshold ? null : [Math.round(r), Math.round(g), Math.round(b)]
      } else {
        // keep（或 remove 但未指定背景色）：与白色背景合成
        const alpha = sumA / count / 255
        pixels[idx] = [
          Math.round(r * alpha + 255 * (1 - alpha)),
          Math.round(g * alpha + 255 * (1 - alpha)),
          Math.round(b * alpha + 255 * (1 - alpha)),
        ]
      }
    }
  }

  return { width: tw, height: th, pixels, samples }
}
