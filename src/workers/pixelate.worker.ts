/// <reference lib="webworker" />
// 像素化 Worker：
// 1) setImage：接收一次源图 RGBA 缓冲并缓存（避免每次改尺寸都重新传大图）
// 2) pixelate：对已缓存的源图做降采样 + 最近色匹配

import { downsample } from '../core/pixelate'
import type { BackgroundMode } from '../core/pixelate'
import { createMatcher } from '../core/matcher'
import type { MatchStats } from '../core/matcher'
import { matchPixelsDither } from '../core/dither'
import { selectPaletteColors } from '../core/quantize'
import type { DitherMode, Palette, RGB } from '../types'

export interface SetImageRequest {
  type: 'setImage'
  id: number
  /** 源图 RGBA 像素缓冲（transferable） */
  buffer: ArrayBuffer
  width: number
  height: number
}

export interface PixelateRequest {
  type: 'pixelate'
  id: number
  targetWidth: number
  targetHeight: number
  background: BackgroundMode
  /** remove 模式下去除的背景色 */
  removeColor?: RGB
  /** remove 模式的颜色容差（RGB 欧氏距离） */
  tolerance?: number
  /** remove 模式的前景占比阈值（0-1） */
  minCoverage?: number
  /** 限制使用的颜色数量；0 / 未设为不限制 */
  maxColors?: number
  /** 抖动模式 */
  dither?: DitherMode
  /** 有序抖动强度（默认 1） */
  ditherStrength?: number
  palette: Palette
}

export type WorkerRequest = SetImageRequest | PixelateRequest

export interface ImageSetResponse {
  type: 'imageSet'
  id: number
}

export interface PixelateResponse {
  type: 'result'
  id: number
  width: number
  height: number
  cells: (string | null)[]
  /** 降采样后的原始平均色（未做背景去除），供界面拾色 */
  samples: (RGB | null)[]
  stats: MatchStats[]
  /** 出错时携带错误信息 */
  error?: string
}

export type WorkerResponse = ImageSetResponse | PixelateResponse

interface SourceImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

const ctx = self as unknown as DedicatedWorkerGlobalScope

// 只缓存最近一张源图（应用同一时刻只有一张）
let source: SourceImage | null = null

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  if (req.type === 'setImage') {
    source = {
      data: new Uint8ClampedArray(req.buffer),
      width: req.width,
      height: req.height,
    }
    ctx.postMessage({ type: 'imageSet', id: req.id } satisfies ImageSetResponse)
    return
  }

  try {
    if (!source) throw new Error('尚未设置源图')
    const { width, height, pixels, samples } = downsample(source, {
      targetWidth: req.targetWidth,
      targetHeight: req.targetHeight,
      background: req.background,
      removeColor: req.removeColor,
      tolerance: req.tolerance,
      minCoverage: req.minCoverage,
    })
    const activePalette =
      req.maxColors && req.maxColors > 0 && req.maxColors < req.palette.colors.length
        ? selectPaletteColors(pixels, req.palette, req.maxColors)
        : req.palette
    const matcher = createMatcher(activePalette)
    const { cells, stats } = matchPixelsDither(
      pixels,
      width,
      height,
      matcher,
      req.dither ?? 'none',
      req.ditherStrength ?? 1,
    )
    ctx.postMessage({
      type: 'result',
      id: req.id,
      width,
      height,
      cells,
      samples,
      stats,
    } satisfies PixelateResponse)
  } catch (err) {
    ctx.postMessage({
      type: 'result',
      id: req.id,
      width: 0,
      height: 0,
      cells: [],
      samples: [],
      stats: [],
      error: err instanceof Error ? err.message : String(err),
    } satisfies PixelateResponse)
  }
}
