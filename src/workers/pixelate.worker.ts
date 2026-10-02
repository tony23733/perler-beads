/// <reference lib="webworker" />
// 像素化 Worker：
// 1) setImage：接收一次源图 RGBA 缓冲并缓存（避免每次改尺寸都重新传大图）
// 2) pixelate：对已缓存的源图做降采样 + 最近色匹配

import { downsample } from '../core/pixelate'
import type { BackgroundMode } from '../core/pixelate'
import { createMatcher, matchPixels } from '../core/matcher'
import type { MatchStats } from '../core/matcher'
import type { Palette } from '../types'

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
    const { width, height, pixels } = downsample(source, {
      targetWidth: req.targetWidth,
      targetHeight: req.targetHeight,
      background: req.background,
    })
    const { cells, stats } = matchPixels(pixels, createMatcher(req.palette))
    ctx.postMessage({
      type: 'result',
      id: req.id,
      width,
      height,
      cells,
      stats,
    } satisfies PixelateResponse)
  } catch (err) {
    ctx.postMessage({
      type: 'result',
      id: req.id,
      width: 0,
      height: 0,
      cells: [],
      stats: [],
      error: err instanceof Error ? err.message : String(err),
    } satisfies PixelateResponse)
  }
}
