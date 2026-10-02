// 图像降采样取样：把源图按目标网格做区域平均（box sampling），
// 并处理透明背景。

import type { RGB } from '../types'

/** 结构上与 ImageData 兼容，便于在 Node 中测试 */
export interface RgbaImage {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export type BackgroundMode = 'keep' | 'transparent'

export interface DownsampleOptions {
  targetWidth: number
  targetHeight: number
  background: BackgroundMode
  /** 透明模式下 alpha 低于该值的格子视为空格（0-255） */
  alphaThreshold?: number
}

export interface DownsampleResult {
  width: number
  height: number
  /** 每格的取样颜色；null 表示空格/透明 */
  pixels: (RGB | null)[]
}

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(v)))

/**
 * 把源图降采样到目标网格。
 * - 每个目标格子是其覆盖区域内所有源像素按 alpha 加权的平均色。
 * - background = 'keep'：与白色背景合成（适合 JPEG 等无透明图）。
 * - background = 'transparent'：平均 alpha 低于阈值 → null（不放豆子）。
 */
export function downsample(src: RgbaImage, opts: DownsampleOptions): DownsampleResult {
  const tw = clampInt(opts.targetWidth, 1, 100000)
  const th = clampInt(opts.targetHeight, 1, 100000)
  const alphaThreshold = opts.alphaThreshold ?? 128
  const { data, width: sw, height: sh } = src
  if (sw < 1 || sh < 1) throw new Error('源图尺寸非法')

  const pixels: (RGB | null)[] = new Array(tw * th)

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
      for (let y = y0; y < y1; y++) {
        const rowBase = y * sw
        for (let x = x0; x < x1; x++) {
          const i = (rowBase + x) * 4
          const a = data[i + 3]
          sumR += data[i] * a
          sumG += data[i + 1] * a
          sumB += data[i + 2] * a
          sumA += a
          count++
        }
      }

      const idx = cy * tw + cx
      if (count === 0 || sumA === 0) {
        // 完全透明：keep → 白，transparent → 空
        pixels[idx] = opts.background === 'keep' ? [255, 255, 255] : null
        continue
      }

      const r = sumR / sumA
      const g = sumG / sumA
      const b = sumB / sumA

      if (opts.background === 'transparent') {
        const avgA = sumA / count
        pixels[idx] = avgA < alphaThreshold ? null : [Math.round(r), Math.round(g), Math.round(b)]
      } else {
        // 与白色背景合成
        const alpha = sumA / count / 255
        pixels[idx] = [
          Math.round(r * alpha + 255 * (1 - alpha)),
          Math.round(g * alpha + 255 * (1 - alpha)),
          Math.round(b * alpha + 255 * (1 - alpha)),
        ]
      }
    }
  }

  return { width: tw, height: th, pixels }
}
