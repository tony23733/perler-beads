import { describe, expect, it } from 'vitest'
import {
  buildColorListCsv,
  computeLegendLayout,
  drawLegend,
  resolveExportScale,
} from '../src/core/exporter'
import type { Grid2DContext, GridRenderOptions } from '../src/core/grid'
import { DEFAULT_GRID_OPTIONS } from '../src/core/grid'
import { MARD_221 } from '../src/data/palettes'
import type { MatchStats } from '../src/core/matcher'
import type { BeadGrid } from '../src/types'

function mockContext() {
  const calls: Array<{ op: string; args: unknown[] }> = []
  const ctx: Grid2DContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: (...args) => void calls.push({ op: 'fillRect', args }),
    strokeRect: (...args) => void calls.push({ op: 'strokeRect', args }),
    beginPath: () => void calls.push({ op: 'beginPath', args: [] }),
    moveTo: (...args) => void calls.push({ op: 'moveTo', args }),
    lineTo: (...args) => void calls.push({ op: 'lineTo', args }),
    stroke: () => void calls.push({ op: 'stroke', args: [] }),
    fillText: (...args) => void calls.push({ op: 'fillText', args }),
  }
  return { ctx, calls }
}

const stats: MatchStats[] = [
  { id: 'A1', count: 100 },
  { id: 'A2', count: 50 },
  { id: 'H7', count: 25 },
]

describe('computeLegendLayout', () => {
  it('按宽度分列并计算高度', () => {
    const layout = computeLegendLayout(12, 900, 1)
    expect(layout.itemWidth).toBe(150)
    // (900 - 32) / 150 = 5 列
    expect(layout.columns).toBe(5)
    expect(layout.rows).toBe(3)
    expect(layout.height).toBe(34 + 3 * 28 + 16)
  })

  it('窄画布至少保证 1 列', () => {
    const layout = computeLegendLayout(4, 100, 1)
    expect(layout.columns).toBe(1)
    expect(layout.rows).toBe(4)
  })

  it('宽度与倍率同步放大时等比缩放', () => {
    const a = computeLegendLayout(6, 900, 1)
    const b = computeLegendLayout(6, 1800, 2)
    expect(b.itemWidth).toBe(a.itemWidth * 2)
    expect(b.columns).toBe(a.columns)
    expect(b.height).toBe(a.height * 2)
  })
})

describe('buildColorListCsv', () => {
  it('生成表头与每行数据', () => {
    const csv = buildColorListCsv(stats, MARD_221)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('色号,HEX,数量')
    expect(lines[1]).toBe('A1,#FAF5CD,100')
    expect(lines[2]).toBe('A2,#FCFED6,50')
    expect(lines).toHaveLength(4)
  })

  it('未知色号 HEX 留空', () => {
    const csv = buildColorListCsv([{ id: 'NOPE', count: 1 }], MARD_221)
    expect(csv.split('\n')[1]).toBe('NOPE,,1')
  })
})

describe('drawLegend', () => {
  it('绘制标题、色块与每项数量', () => {
    const { ctx, calls } = mockContext()
    drawLegend(ctx, 100, 900, stats, MARD_221, 1)

    const texts = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0])
    expect(texts[0]).toContain('3 色')
    expect(texts[0]).toContain('175 颗')
    expect(texts).toContain('A1 × 100')
    expect(texts).toContain('H7 × 25')

    // 3 个色块
    expect(calls.filter((c) => c.op === 'fillRect')).toHaveLength(3)
    expect(calls.filter((c) => c.op === 'strokeRect')).toHaveLength(3)
  })
})

describe('resolveExportScale', () => {
  const grid = (w: number, h: number): BeadGrid => ({
    width: w,
    height: h,
    cells: new Array(w * h).fill(null),
  })
  const gridOptions: GridRenderOptions = { ...DEFAULT_GRID_OPTIONS, cellSize: 24 }

  it('正常尺寸保留请求倍率', () => {
    expect(resolveExportScale(grid(29, 29), gridOptions, 3)).toBe(3)
  })

  it('超大网格自动降低倍率且不低于 1', () => {
    const scale = resolveExportScale(grid(300, 300), { ...gridOptions, cellSize: 48 }, 6)
    expect(scale).toBeCloseTo(16000 / (300 * 48), 6)
    expect(scale).toBeGreaterThanOrEqual(1)
  })
})
