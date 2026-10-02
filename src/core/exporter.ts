// 导出：网格图纸 PNG（可含用色清单）与用色清单 CSV。

import { measureGrid, renderGrid } from './grid'
import type { Grid2DContext, GridRenderOptions } from './grid'
import type { MatchStats } from './matcher'
import type { BeadGrid, Palette } from '../types'

/** 画布单边上限，超过则自动降低导出倍率，避免超出浏览器限制 */
const MAX_CANVAS_DIM = 16000

const LEGEND_TITLE_HEIGHT = 34
const LEGEND_ITEM_WIDTH = 150
const LEGEND_ITEM_HEIGHT = 28
const LEGEND_PADDING = 16

export interface LegendLayout {
  columns: number
  rows: number
  itemWidth: number
  itemHeight: number
  height: number
}

/** 计算用色清单区域的排布与高度 */
export function computeLegendLayout(count: number, width: number, scale: number): LegendLayout {
  const itemWidth = LEGEND_ITEM_WIDTH * scale
  const itemHeight = LEGEND_ITEM_HEIGHT * scale
  const padding = LEGEND_PADDING * scale
  const available = Math.max(itemWidth, width - padding * 2)
  const columns = Math.max(1, Math.floor(available / itemWidth))
  const rows = Math.ceil(count / columns)
  const height = LEGEND_TITLE_HEIGHT * scale + rows * itemHeight + padding
  return { columns, rows, itemWidth, itemHeight, height }
}

/** 用色清单 CSV（不含 BOM） */
export function buildColorListCsv(stats: MatchStats[], palette: Palette): string {
  const colorMap = new Map(palette.colors.map((c) => [c.id, c]))
  const lines = ['色号,HEX,数量']
  for (const s of stats) {
    lines.push(`${s.id},${colorMap.get(s.id)?.hex ?? ''},${s.count}`)
  }
  return lines.join('\n')
}

/** 在网格下方绘制用色清单 */
export function drawLegend(
  ctx: Grid2DContext,
  startY: number,
  width: number,
  stats: MatchStats[],
  palette: Palette,
  scale: number,
): void {
  const layout = computeLegendLayout(stats.length, width, scale)
  const padding = LEGEND_PADDING * scale
  const colorMap = new Map(palette.colors.map((c) => [c.id, c.hex]))

  // 分隔线
  ctx.lineWidth = 1
  ctx.strokeStyle = '#cbd5e1'
  ctx.beginPath()
  ctx.moveTo(0, startY + 0.5)
  ctx.lineTo(width, startY + 0.5)
  ctx.stroke()

  const total = stats.reduce((sum, s) => sum + s.count, 0)
  ctx.fillStyle = '#0f172a'
  ctx.font = `bold ${16 * scale}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`用色清单：${stats.length} 色 / 共 ${total} 颗`, padding, startY + 17 * scale)

  const swatch = 16 * scale
  const rowsTop = startY + LEGEND_TITLE_HEIGHT * scale

  stats.forEach((s, i) => {
    const col = i % layout.columns
    const row = Math.floor(i / layout.columns)
    const x = padding + col * layout.itemWidth
    const y = rowsTop + row * layout.itemHeight
    const hex = colorMap.get(s.id) ?? '#000000'

    ctx.fillStyle = hex
    ctx.fillRect(x, y + (layout.itemHeight - swatch) / 2, swatch, swatch)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + (layout.itemHeight - swatch) / 2 + 0.5, swatch - 1, swatch - 1)

    ctx.fillStyle = '#0f172a'
    ctx.font = `${13 * scale}px sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${s.id} × ${s.count}`, x + swatch + 8 * scale, y + layout.itemHeight / 2)
  })
}

export interface ExportPngOptions {
  /** 导出倍率（越大越清晰、文件越大） */
  scale: number
  /** 是否在图下附带用色清单 */
  includeLegend: boolean
}

/** 计算实际可用的导出倍率（受画布上限约束） */
export function resolveExportScale(
  grid: BeadGrid,
  gridOptions: GridRenderOptions,
  requested: number,
): number {
  const cell = Math.max(4, gridOptions.cellSize)
  const maxByW = MAX_CANVAS_DIM / (grid.width * cell)
  const maxByH = MAX_CANVAS_DIM / (grid.height * cell)
  return Math.max(1, Math.min(requested, maxByW, maxByH))
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('导出 PNG 失败'))),
      'image/png',
    )
  })
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 把网格图纸（可选用色清单）导出为高清 PNG 并下载 */
export async function exportGridPng(
  grid: BeadGrid,
  palette: Palette,
  stats: MatchStats[],
  gridOptions: GridRenderOptions,
  opts: ExportPngOptions,
  fileName = 'perler-pattern.png',
): Promise<number> {
  const scale = resolveExportScale(grid, gridOptions, opts.scale)
  const scaledGrid: GridRenderOptions = { ...gridOptions, cellSize: gridOptions.cellSize * scale }
  const size = measureGrid(grid.width, grid.height, scaledGrid)
  const legendHeight = opts.includeLegend
    ? computeLegendLayout(stats.length, size.width, scale).height
    : 0

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height + legendHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D 画布上下文')
  const gctx = ctx as unknown as Grid2DContext

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  renderGrid(gctx, grid, palette, scaledGrid)
  if (opts.includeLegend) {
    drawLegend(gctx, size.height, size.width, stats, palette, scale)
  }

  downloadBlob(await canvasToBlob(canvas), fileName)
  return scale
}

/** 导出用色清单 CSV 并下载（带 BOM，方便 Excel 打开中文） */
export function exportColorListCsv(
  stats: MatchStats[],
  palette: Palette,
  fileName = 'perler-colors.csv',
): void {
  const csv = `\ufeff${buildColorListCsv(stats, palette)}`
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName)
}
