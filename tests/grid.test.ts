import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRID_OPTIONS,
  computeLayout,
  labelColorFor,
  measureGrid,
  perceivedBrightness,
  renderGrid,
} from '../src/core/grid'
import type { Grid2DContext } from '../src/core/grid'
import { MARD_221 } from '../src/data/palettes'
import type { BeadGrid } from '../src/types'

interface RecordedCall {
  op: string
  args: unknown[]
  fillStyle: string
  font: string
}

function mockContext() {
  const calls: RecordedCall[] = []
  const ctx: Grid2DContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect(...args) {
      calls.push({ op: 'fillRect', args, fillStyle: this.fillStyle, font: this.font })
    },
    strokeRect(...args) {
      calls.push({ op: 'strokeRect', args, fillStyle: this.fillStyle, font: this.font })
    },
    beginPath() {
      calls.push({ op: 'beginPath', args: [], fillStyle: this.fillStyle, font: this.font })
    },
    moveTo(...args) {
      calls.push({ op: 'moveTo', args, fillStyle: this.fillStyle, font: this.font })
    },
    lineTo(...args) {
      calls.push({ op: 'lineTo', args, fillStyle: this.fillStyle, font: this.font })
    },
    stroke() {
      calls.push({ op: 'stroke', args: [], fillStyle: this.fillStyle, font: this.font })
    },
    fillText(...args) {
      calls.push({ op: 'fillText', args, fillStyle: this.fillStyle, font: this.font })
    },
  }
  return { ctx, calls }
}

// 3x2 网格：A1 用第一色，其余空
const grid: BeadGrid = {
  width: 3,
  height: 2,
  cells: ['A1', null, 'A2', 'A1', 'A2', null],
}

describe('perceivedBrightness / labelColorFor', () => {
  it('白色用深色文字，黑色用浅色文字', () => {
    expect(labelColorFor('#FFFFFF')).toBe('#111111')
    expect(labelColorFor('#000000')).toBe('#ffffff')
  })

  it('亮度计算合理', () => {
    expect(perceivedBrightness('#FFFFFF')).toBeCloseTo(255, 5)
    expect(perceivedBrightness('#000000')).toBeCloseTo(0, 5)
    expect(perceivedBrightness('#FF0000')).toBeCloseTo(76.245, 3)
  })
})

describe('computeLayout / measureGrid', () => {
  it('带坐标时留出标尺', () => {
    const l = computeLayout(3, 2, { ...DEFAULT_GRID_OPTIONS, cellSize: 20 })
    expect(l.ruler).toBe(20)
    expect(l.width).toBe(20 + 3 * 20)
    expect(l.height).toBe(20 + 2 * 20)
  })

  it('不带坐标时无标尺', () => {
    const l = measureGrid(3, 2, { showCoordinates: false, cellSize: 20 })
    expect(l.ruler).toBe(0)
    expect(l.width).toBe(60)
    expect(l.height).toBe(40)
  })

  it('格子大小有下限', () => {
    expect(measureGrid(1, 1, { cellSize: 1 }).cellSize).toBe(4)
  })
})

describe('renderGrid', () => {
  it('返回正确画布尺寸', () => {
    const { ctx } = mockContext()
    const size = renderGrid(ctx, grid, MARD_221, { cellSize: 20 })
    expect(size.width).toBe(80)
    expect(size.height).toBe(60)
  })

  it('每格都画了底色（含空格）', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { cellSize: 20 })
    // 1 次背景 + 6 次格子
    const fills = calls.filter((c) => c.op === 'fillRect')
    expect(fills).toHaveLength(1 + 6)
  })

  it('display=color 时不写色号', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { display: 'color' })
    expect(calls.some((c) => c.op === 'fillText' && c.args[0] === 'A1')).toBe(false)
  })

  it('display=code 时为每个非空格写色号，且不填色', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { display: 'code', showCoordinates: false })
    const labels = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])
    expect(labels).toEqual(['A1', 'A2', 'A1', 'A2'])
    // 所有格子底色为白
    const cellFills = calls.filter((c) => c.op === 'fillRect').slice(1)
    expect(cellFills.every((c) => c.fillStyle === '#ffffff')).toBe(true)
  })

  it('display=both 时填色并写色号', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { display: 'both' })
    const labels = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])
    expect(labels).toContain('A1')
    const cellFills = calls.filter((c) => c.op === 'fillRect').slice(1)
    expect(cellFills.some((c) => c.fillStyle !== '#ffffff')).toBe(true)
  })

  it('显示坐标时写出行列号', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { showCoordinates: true, display: 'color' })
    const labels = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])
    // 3 列 + 2 行
    expect(labels).toEqual(['1', '2', '3', '1', '2'])
  })

  it('空格不写色号', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { display: 'code', showCoordinates: false })
    const labels = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])
    expect(labels).not.toContain(null)
    expect(labels).toHaveLength(4)
  })

  it('majorEvery>0 时画粗线', () => {
    const { ctx, calls } = mockContext()
    renderGrid(ctx, grid, MARD_221, { majorEvery: 2 })
    // 网格线 + 粗线 + 外框，至少 3 次 stroke 类调用
    expect(calls.filter((c) => c.op === 'stroke')).toHaveLength(2)
    expect(calls.filter((c) => c.op === 'strokeRect')).toHaveLength(1)
  })
})
