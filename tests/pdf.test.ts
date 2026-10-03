import { describe, expect, it } from 'vitest'
import { buildPatternPdf, planPdfTiles } from '../src/core/pdf'
import type { PdfTile } from '../src/core/pdf'
import { DEFAULT_GRID_OPTIONS } from '../src/core/grid'
import { MARD_221 } from '../src/data/palettes'
import type { MatchStats } from '../src/core/matcher'
import type { BeadGrid } from '../src/types'

// 1x1 透明 PNG（有效 CRC），用于替代真实分片渲染
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const solidGrid = (w: number, h: number): BeadGrid => ({
  width: w,
  height: h,
  cells: new Array(w * h).fill('A1'),
})

const stats: MatchStats[] = [
  { id: 'A1', count: 100 },
  { id: 'A2', count: 50 },
  { id: 'H7', count: 25 },
]

describe('planPdfTiles', () => {
  it('小网格只占一页', () => {
    const plan = planPdfTiles(20, 20, { cellSize: 6 })
    expect(plan.pageCount).toBe(1)
    expect(plan.tiles).toHaveLength(1)
    expect(plan.tiles[0]).toMatchObject({ offsetCol: 0, offsetRow: 0, cols: 20, rows: 20 })
  })

  it('大网格正确分页且自动选页数更少的方向', () => {
    const plan = planPdfTiles(100, 60, { cellSize: 6 })
    // 纵向：30 列/页 × 42 行/页 → 4×2 = 8 页；横向为 3×3 = 9 页 → 选纵向
    expect(plan.orientation).toBe('portrait')
    expect(plan.colsPerPage).toBe(30)
    expect(plan.rowsPerPage).toBe(42)
    expect(plan.pageCount).toBe(8)
    expect(plan.tiles).toHaveLength(8)
    expect(plan.tiles[plan.tiles.length - 1]).toMatchObject({
      offsetCol: 90,
      offsetRow: 42,
      cols: 10,
      rows: 18,
    })
  })

  it('分片无缝无重叠，且完整覆盖网格', () => {
    const gridW = 70
    const gridH = 55
    const plan = planPdfTiles(gridW, gridH, { cellSize: 7 })
    const covered = new Set<string>()
    let area = 0
    for (const t of plan.tiles) {
      area += t.cols * t.rows
      for (let y = 0; y < t.rows; y++) {
        for (let x = 0; x < t.cols; x++) {
          const key = `${t.offsetRow + y},${t.offsetCol + x}`
          expect(covered.has(key)).toBe(false) // 不重叠
          covered.add(key)
        }
      }
    }
    expect(area).toBe(gridW * gridH)
    expect(covered.size).toBe(gridW * gridH)
  })

  it('关闭坐标后标尺为 0，每页可放更多格子', () => {
    const withRuler = planPdfTiles(200, 200, { cellSize: 6, showCoordinates: true })
    const without = planPdfTiles(200, 200, { cellSize: 6, showCoordinates: false })
    expect(withRuler.ruler).toBeGreaterThan(0)
    expect(without.ruler).toBe(0)
    expect(without.colsPerPage).toBeGreaterThanOrEqual(withRuler.colsPerPage)
  })

  it('强制方向生效', () => {
    const plan = planPdfTiles(100, 60, { orientation: 'landscape' })
    expect(plan.orientation).toBe('landscape')
    expect(plan.pageWidthMm).toBeGreaterThan(plan.pageHeightMm)
    expect(plan.pageCount).toBe(9)
  })
})

describe('buildPatternPdf', () => {
  const gridOptions = { ...DEFAULT_GRID_OPTIONS }
  const renderTile = (tile: PdfTile) => ({
    dataUrl: PNG,
    widthMm: tile.cols * 6,
    heightMm: tile.rows * 6,
  })

  it('生成合法 PDF，页数含用色清单页', async () => {
    const grid = solidGrid(70, 60)
    const { doc, result } = await buildPatternPdf(grid, MARD_221, stats, gridOptions, {}, renderTile)

    // 纵向：70 列 → 3 页/行；60 行 → 2 页/列 → 6 页图纸
    expect(result.plan.pageCount).toBe(6)
    expect(result.legendPages).toBe(1)
    expect(result.pageCount).toBe(7)
    expect(doc.getNumberOfPages()).toBe(7)

    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('关闭清单后不额外加页', async () => {
    const grid = solidGrid(20, 20)
    const { result } = await buildPatternPdf(
      grid,
      MARD_221,
      stats,
      gridOptions,
      { includeLegend: false },
      renderTile,
    )
    expect(result.legendPages).toBe(0)
    expect(result.pageCount).toBe(1)
  })
})
