// 回归测试：传给 Worker 的消息必须可被结构化克隆。
// 历史 bug：Vue 响应式数组（Proxy）直接 postMessage，报
// "could not be cloned"。

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Palette } from '../src/types'

class FakeWorker {
  onmessage: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  last: unknown

  postMessage(req: unknown): void {
    // Proxy / 函数等不可克隆对象会在这里抛错，正是我们要防住的
    structuredClone(req)
    this.last = req
  }

  terminate(): void {}
}

const palette = { id: 'p', colors: [] } as unknown as Palette

describe('pixelateClient', () => {
  let worker: FakeWorker

  beforeEach(() => {
    vi.resetModules()
    worker = new FakeWorker()
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          return worker
        }
      } as unknown as typeof Worker,
    )
  })

  it('把 removeColor 转成普通数组后再发给 Worker', async () => {
    const { pixelate } = await import('../src/core/pixelateClient')
    // 模拟 Vue ref 里的数组（Proxy）
    const reactiveLike = new Proxy([255, 0, 0] as [number, number, number], {})
    void pixelate({
      targetWidth: 2,
      targetHeight: 2,
      background: 'remove',
      removeColor: reactiveLike,
      palette,
    })
    const sent = worker.last as { removeColor: unknown }
    expect(sent.removeColor).toEqual([255, 0, 0])
    expect(Array.isArray(sent.removeColor)).toBe(true)
  })

  it('未指定 removeColor 时不携带该字段', async () => {
    const { pixelate } = await import('../src/core/pixelateClient')
    void pixelate({ targetWidth: 1, targetHeight: 1, background: 'keep', palette })
    expect((worker.last as { removeColor?: unknown }).removeColor).toBeUndefined()
  })
})
