// 主线程侧的 Worker 客户端：共享一个 Worker，用消息 id 对应并发请求。

import type { BackgroundMode } from './pixelate'
import type { DitherMode, Palette, RGB } from '../types'
import type {
  PixelateResponse,
  WorkerRequest,
  WorkerResponse,
} from '../workers/pixelate.worker'

export interface PixelateOptions {
  targetWidth: number
  targetHeight: number
  background: BackgroundMode
  /** remove 模式下去除的背景色 */
  removeColor?: RGB
  /** remove 模式的颜色容差（RGB 欧氏距离） */
  tolerance?: number
  /** 限制使用的颜色数量；0 / 未设为不限制 */
  maxColors?: number
  /** 抖动模式 */
  dither?: DitherMode
  /** 有序抖动强度 */
  ditherStrength?: number
  palette: Palette
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  { resolve: (r: WorkerResponse) => void; reject: (e: unknown) => void }
>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/pixelate.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const entry = pending.get(e.data.id)
    if (!entry) return
    pending.delete(e.data.id)
    if (e.data.type === 'result' && e.data.error) entry.reject(new Error(e.data.error))
    else entry.resolve(e.data)
  }
  worker.onerror = (e) => {
    const err = e instanceof ErrorEvent ? e.error ?? new Error(e.message) : e
    for (const entry of pending.values()) entry.reject(err)
    pending.clear()
  }
  return worker
}

function send<T extends WorkerResponse>(req: WorkerRequest, transfer: Transferable[] = []): Promise<T> {
  const w = ensureWorker()
  return new Promise<T>((resolve, reject) => {
    pending.set(req.id, { resolve: resolve as (r: WorkerResponse) => void, reject })
    w.postMessage(req, transfer)
  })
}

/**
 * 把源图交给 Worker 缓存。
 * 注意：会 transfer `imageData.data.buffer`，调用后源 ImageData 即被 detached。
 */
export async function setSourceImage(imageData: ImageData): Promise<void> {
  const id = nextId++
  const req: WorkerRequest = {
    type: 'setImage',
    id,
    buffer: imageData.data.buffer,
    width: imageData.width,
    height: imageData.height,
  }
  await send(req, [imageData.data.buffer])
}

/** 对已缓存的源图执行降采样 + 最近色匹配 */
export function pixelate(opts: PixelateOptions): Promise<PixelateResponse> {
  const id = nextId++
  // removeColor 可能是 Vue 响应式代理（Proxy），不能被结构化克隆；
  // 这里统一转成普通数字数组再发给 Worker。
  const { removeColor, ...rest } = opts
  const req: WorkerRequest = {
    type: 'pixelate',
    id,
    ...rest,
    removeColor: removeColor ? [removeColor[0], removeColor[1], removeColor[2]] : undefined,
  }
  return send<PixelateResponse>(req)
}
