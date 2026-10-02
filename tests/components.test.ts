// @vitest-environment happy-dom
// 组件挂载回归测试：确认预览在「挂载时」就完成首次绘制，
// 而不是要等 props 变化（历史 bug：watch immediate 在挂载前执行，canvas 还是 null）。

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GridPreview from '../src/components/GridPreview.vue'
import PixelPreview from '../src/components/PixelPreview.vue'
import { DEFAULT_GRID_OPTIONS } from '../src/core/grid'
import { MARD_221 } from '../src/data/palettes'

const canvasOf = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find('canvas').element as HTMLCanvasElement

describe('PixelPreview', () => {
  it('挂载时立即按网格尺寸设置画布', () => {
    const wrapper = mount(PixelPreview, {
      props: { cells: ['A1', null, 'A2', 'A1'], width: 2, height: 2, palette: MARD_221 },
    })
    const canvas = canvasOf(wrapper)
    // 默认画布是 300x150，能被改成 2x2 说明挂载时 render 已执行
    expect(canvas.width).toBe(2)
    expect(canvas.height).toBe(2)
  })

  it('props 变化后画布随之更新', async () => {
    const wrapper = mount(PixelPreview, {
      props: { cells: ['A1'], width: 1, height: 1, palette: MARD_221 },
    })
    await wrapper.setProps({ width: 4, height: 3 })
    await nextTick()
    const canvas = canvasOf(wrapper)
    expect(canvas.width).toBe(4)
    expect(canvas.height).toBe(3)
  })
})

describe('GridPreview', () => {
  it('挂载时立即绘制（画布含标尺与格子）', () => {
    const wrapper = mount(GridPreview, {
      props: {
        cells: ['A1', null, 'A2', 'A1'],
        width: 2,
        height: 2,
        palette: MARD_221,
        options: { ...DEFAULT_GRID_OPTIONS },
      },
    })
    const canvas = canvasOf(wrapper)
    // ruler = max(20, round(24*0.9)) = 22 → 22 + 2*24 = 70
    expect(canvas.width).toBe(70)
    expect(canvas.height).toBe(70)
  })

  it('切换显示方式后重绘', async () => {
    const wrapper = mount(GridPreview, {
      props: {
        cells: ['A1', null, 'A2', 'A1'],
        width: 2,
        height: 2,
        palette: MARD_221,
        options: { ...DEFAULT_GRID_OPTIONS, cellSize: 30 },
      },
    })
    expect(canvasOf(wrapper).width).toBe(Math.max(20, Math.round(30 * 0.9)) + 2 * 30)
    await wrapper.setProps({ options: { ...DEFAULT_GRID_OPTIONS, cellSize: 10 } })
    await nextTick()
    expect(canvasOf(wrapper).width).toBe(Math.max(20, Math.round(10 * 0.9)) + 2 * 10)
  })
})
