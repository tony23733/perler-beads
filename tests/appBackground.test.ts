// @vitest-environment happy-dom
// 背景模式切换的集成回归测试：确认「去除背景 → 保留背景」能真正还原。
// 通过 mock 掉图片加载与 Worker 客户端，在 happy-dom 里跑真实 downsample 管线。

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../src/App.vue'
import EditToolbar from '../src/components/EditToolbar.vue'
import ImageUploader from '../src/components/ImageUploader.vue'
import PixelPreview from '../src/components/PixelPreview.vue'

const hoisted = vi.hoisted(() => ({ source: null as unknown }))

vi.mock('../src/core/image', () => ({
  hasTransparency: () => false,
  loadImageData: async () => {
    // 2x2：仅左上角为红（主体），其余三格为白（背景）
    const data = new Uint8ClampedArray(2 * 2 * 4)
    const set = (i: number, r: number, g: number, b: number) => {
      data[i * 4] = r
      data[i * 4 + 1] = g
      data[i * 4 + 2] = b
      data[i * 4 + 3] = 255
    }
    set(0, 220, 20, 20)
    set(1, 255, 255, 255)
    set(2, 255, 255, 255)
    set(3, 255, 255, 255)
    return { data, width: 2, height: 2 }
  },
}))

vi.mock('../src/core/pixelateClient', async () => {
  const { downsample } = await import('../src/core/pixelate')
  const { createMatcher, matchPixels } = await import('../src/core/matcher')
  return {
    setSourceImage: vi.fn(async (img: unknown) => {
      hoisted.source = img
    }),
    pixelate: vi.fn(async (opts: Record<string, unknown>) => {
      const src = hoisted.source as {
        data: Uint8ClampedArray
        width: number
        height: number
      }
      const { width, height, pixels, samples } = downsample(src, {
        targetWidth: opts.targetWidth as number,
        targetHeight: opts.targetHeight as number,
        background: opts.background as 'keep' | 'transparent' | 'remove',
        removeColor: opts.removeColor as [number, number, number] | undefined,
        tolerance: opts.tolerance as number,
        minCoverage: opts.minCoverage as number,
      })
      const matcher = createMatcher(opts.palette as never)
      const { cells, stats } = matchPixels(pixels, matcher)
      return { type: 'result' as const, id: 1, width, height, cells, samples, stats }
    }),
  }
})

const clickButton = async (wrapper: ReturnType<typeof mount>, text: string) => {
  const btn = wrapper.findAll('button').find((b) => b.text().includes(text))
  expect(btn, `未找到按钮：${text}`).toBeTruthy()
  await btn!.trigger('click')
  // App 的 run 有 150ms 防抖，等它真正跑完
  await new Promise((r) => setTimeout(r, 220))
  await nextTick()
  await flushPromises()
}

describe('App 背景模式切换', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    })
  })

  it('去除背景后再切回保留背景，空格会被还原', async () => {
    const wrapper = mount(App)
    await wrapper.findComponent(ImageUploader).vm.$emit('select', new File([], 'x.png'))
    await flushPromises()
    await nextTick()

    const cellsOf = () => wrapper.findComponent(PixelPreview).props('cells') as (string | null)[]
    const nullCount = () => cellsOf().filter((c) => c === null).length

    // 保留背景：无空格
    expect(nullCount()).toBe(0)

    // 去除背景 + 自动取四角（白色）：白背景格应变空
    await clickButton(wrapper, '去除背景')
    await clickButton(wrapper, '自动取四角')
    expect(nullCount()).toBeGreaterThan(0)

    // 切回保留背景：应还原，无空格
    await clickButton(wrapper, '保留背景')
    expect(nullCount()).toBe(0)
  })

  it('手工编辑（涂色/擦除）+ 撤销/重做', async () => {
    const wrapper = mount(App)
    await wrapper.findComponent(ImageUploader).vm.$emit('select', new File([], 'x.png'))
    await flushPromises()
    await nextTick()

    const cellsOf = () => wrapper.findComponent(PixelPreview).props('cells') as (string | null)[]
    const original0 = cellsOf()[0]
    expect(original0).not.toBeNull()

    // 开启手工编辑；默认画笔颜色为「擦除」
    wrapper.findComponent(EditToolbar).vm.$emit('update:edit-mode', true)
    await nextTick()

    // 在像素预览上擦除第 0 格
    const preview = wrapper.findComponent(PixelPreview)
    preview.vm.$emit('cell-paint', 0)
    await nextTick()
    expect(cellsOf()[0]).toBeNull()

    // 抬手结束描边（记入历史）
    preview.vm.$emit('paint-end')
    await nextTick()

    // 撤销 → 恢复计算值
    wrapper.findComponent(EditToolbar).vm.$emit('undo')
    await nextTick()
    expect(cellsOf()[0]).toBe(original0)

    // 重做 → 又变回擦除
    wrapper.findComponent(EditToolbar).vm.$emit('redo')
    await nextTick()
    expect(cellsOf()[0]).toBeNull()
  })
})
