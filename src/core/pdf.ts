// A4 分页 PDF 导出：把整张网格图纸切成多页 A4，每页带页码、全局行列范围与拼接定位角标。
//
// 说明：
// - PDF 内文字统一使用 ASCII（jsPDF 内置 Helvetica 不含中文字形），避免中文乱码。
// - 分页规划 `planPdfTiles` 是纯函数，便于单测；真正画图用 `renderTileToImage`
//   （每片渲染到 canvas 再作为 PNG 嵌入 PDF），可用 `buildPatternPdf` 注入替身测试。
// - jsPDF 采用动态 import，避免拖大首屏体积。

import type { jsPDF } from 'jspdf'
import { measureGrid, renderGrid } from './grid'
import type { Grid2DContext, GridRenderOptions } from './grid'
import type { MatchStats } from './matcher'
import type { BeadGrid, Palette } from '../types'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

/** 页眉 / 页脚预留高度（mm） */
const HEADER_MM = 12
const FOOTER_MM = 7
/** 坐标标尺相对每格边长的比例（与 grid.ts 的 ruler 规则保持一致） */
const RULER_RATIO = 0.9
/** 分片渲染时每格像素数（越大越清晰、文件越大） */
const TILE_CELL_PX = 48

export type PdfOrientation = 'portrait' | 'landscape'

export interface PdfPatternOptions {
  /** 每格打印边长（mm），默认 6 */
  cellSize?: number
  /** 页边距（mm），默认 10 */
  margin?: number
  /** 页面方向；'auto'（默认）按分页数最少自动选择 */
  orientation?: PdfOrientation | 'auto'
  /** 是否附带用色清单页，默认 true */
  includeLegend?: boolean
  /** 标题（ASCII），默认 'Perler Bead Pattern' */
  title?: string
  /** 是否绘制拼接定位角标，默认 true */
  registrationMarks?: boolean
  /** 是否显示每页的行列坐标标尺；默认沿用网格显示设置 */
  showCoordinates?: boolean
}

export interface PdfTile {
  offsetCol: number
  offsetRow: number
  cols: number
  rows: number
}

export interface PdfPlan {
  orientation: PdfOrientation
  pageWidthMm: number
  pageHeightMm: number
  margin: number
  cellSize: number
  /** 坐标标尺占用的额外空间（mm），0 表示不显示坐标 */
  ruler: number
  colsPerPage: number
  rowsPerPage: number
  /** 网格图纸总页数（不含清单页） */
  pageCount: number
  tiles: PdfTile[]
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** '#RRGGBB' → [r,g,b]，解析失败返回黑色 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '')
  if (h.length !== 6) return [0, 0, 0]
  const n = Number.parseInt(h, 16)
  if (Number.isNaN(n)) return [0, 0, 0]
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

interface OrientationLayout {
  orientation: PdfOrientation
  pageWidthMm: number
  pageHeightMm: number
  colsPerPage: number
  rowsPerPage: number
  pageCount: number
}

/**
 * 规划 A4 分页。纯函数，不依赖 DOM。
 * 每个分片不重叠，按「先行后列」的阅读顺序排列（与拼接顺序一致）。
 */
export function planPdfTiles(
  gridW: number,
  gridH: number,
  opts: PdfPatternOptions = {},
): PdfPlan {
  const w = Math.max(1, Math.floor(gridW))
  const h = Math.max(1, Math.floor(gridH))
  const cellSize = clamp(opts.cellSize ?? 6, 2, 20)
  const margin = clamp(opts.margin ?? 10, 0, 30)
  const showCoordinates = opts.showCoordinates ?? true
  const ruler = showCoordinates ? cellSize * RULER_RATIO : 0
  const requested = opts.orientation ?? 'auto'

  const build = (orientation: PdfOrientation): OrientationLayout => {
    const pageWidthMm = orientation === 'portrait' ? A4_WIDTH_MM : A4_HEIGHT_MM
    const pageHeightMm = orientation === 'portrait' ? A4_HEIGHT_MM : A4_WIDTH_MM
    const contentW = pageWidthMm - 2 * margin
    const contentH = pageHeightMm - 2 * margin - HEADER_MM - FOOTER_MM
    const colsPerPage = Math.max(1, Math.floor((contentW - ruler) / cellSize))
    const rowsPerPage = Math.max(1, Math.floor((contentH - ruler) / cellSize))
    const pagesX = Math.ceil(w / colsPerPage)
    const pagesY = Math.ceil(h / rowsPerPage)
    return { orientation, pageWidthMm, pageHeightMm, colsPerPage, rowsPerPage, pageCount: pagesX * pagesY }
  }

  let chosen: OrientationLayout
  if (requested === 'auto') {
    const portrait = build('portrait')
    const landscape = build('landscape')
    chosen = landscape.pageCount < portrait.pageCount ? landscape : portrait
  } else {
    chosen = build(requested)
  }

  const tiles: PdfTile[] = []
  const pagesX = Math.ceil(w / chosen.colsPerPage)
  const pagesY = Math.ceil(h / chosen.rowsPerPage)
  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      const offsetCol = px * chosen.colsPerPage
      const offsetRow = py * chosen.rowsPerPage
      tiles.push({
        offsetCol,
        offsetRow,
        cols: Math.min(chosen.colsPerPage, w - offsetCol),
        rows: Math.min(chosen.rowsPerPage, h - offsetRow),
      })
    }
  }

  return {
    orientation: chosen.orientation,
    pageWidthMm: chosen.pageWidthMm,
    pageHeightMm: chosen.pageHeightMm,
    margin,
    cellSize,
    ruler,
    colsPerPage: chosen.colsPerPage,
    rowsPerPage: chosen.rowsPerPage,
    pageCount: tiles.length,
    tiles,
  }
}

export interface TileImage {
  dataUrl: string
  widthMm: number
  heightMm: number
}

export type TileRenderer = (tile: PdfTile, plan: PdfPlan) => TileImage

/** 默认分片渲染：画到 canvas 再导出 PNG，并换算成毫米尺寸 */
export function renderTileToImage(
  grid: BeadGrid,
  palette: Palette,
  gridOptions: GridRenderOptions,
  tile: PdfTile,
  plan: PdfPlan,
): TileImage {
  const tileOptions: GridRenderOptions = {
    ...gridOptions,
    cellSize: TILE_CELL_PX,
    background: '#ffffff',
    showCoordinates: plan.ruler > 0,
  }
  const size = measureGrid(tile.cols, tile.rows, tileOptions)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 2D 画布上下文')
  renderGrid(ctx as unknown as Grid2DContext, grid, palette, tileOptions, { ...tile })
  const mmPerPx = plan.cellSize / TILE_CELL_PX
  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: size.width * mmPerPx,
    heightMm: size.height * mmPerPx,
  }
}

/** 页眉：标题 + 全局行列范围 + 页码（均为 ASCII） */
function drawHeader(
  doc: jsPDF,
  plan: PdfPlan,
  tile: PdfTile,
  index: number,
  title: string,
): void {
  const { margin, pageWidthMm } = plan
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 17, 17)
  doc.text(title, margin, margin + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(70, 80, 95)
  const c0 = tile.offsetCol + 1
  const c1 = tile.offsetCol + tile.cols
  const r0 = tile.offsetRow + 1
  const r1 = tile.offsetRow + tile.rows
  doc.text(`Cols ${c0}-${c1} / Rows ${r0}-${r1}`, margin, margin + 9.6)
  doc.text(`Page ${index + 1}/${plan.pageCount}`, pageWidthMm - margin, margin + 5, {
    align: 'right',
  })
}

/** 页脚：整体尺寸与拼接提示 */
function drawFooter(doc: jsPDF, grid: BeadGrid, plan: PdfPlan): void {
  const { margin, pageHeightMm } = plan
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120, 130, 145)
  doc.text(
    `Grid ${grid.width} x ${grid.height} beads - align pages by the corner marks`,
    margin,
    pageHeightMm - margin + 2,
  )
}

/** 四个角的拼接定位角标 + 内容边框 */
function drawRegistrationMarks(doc: jsPDF, img: TileImage, x: number, y: number): void {
  const len = 4
  doc.setDrawColor(70, 80, 95)
  doc.setLineWidth(0.2)
  const corners: Array<[number, number]> = [
    [x, y],
    [x + img.widthMm, y],
    [x, y + img.heightMm],
    [x + img.widthMm, y + img.heightMm],
  ]
  for (const [cx, cy] of corners) {
    doc.line(cx - len, cy, cx + len, cy)
    doc.line(cx, cy - len, cx, cy + len)
  }

  doc.setDrawColor(200, 205, 215)
  doc.setLineWidth(0.15)
  doc.rect(x, y, img.widthMm, img.heightMm)
}

/** 用色清单页（矢量绘制，ASCII 文案） */
function addLegendPages(
  doc: jsPDF,
  plan: PdfPlan,
  stats: MatchStats[],
  palette: Palette,
  title: string,
): number {
  if (stats.length === 0) return 0
  const { margin, pageWidthMm, pageHeightMm } = plan
  const contentW = pageWidthMm - 2 * margin
  const contentH = pageHeightMm - 2 * margin - HEADER_MM - FOOTER_MM
  const columns = pageWidthMm >= pageHeightMm ? 4 : 3
  const itemHeight = 7
  const rowsPerPage = Math.max(1, Math.floor(contentH / itemHeight))
  const perPage = columns * rowsPerPage
  const total = stats.reduce((s, x) => s + x.count, 0)
  const colorMap = new Map(palette.colors.map((c) => [c.id, c.hex]))
  const pages = Math.ceil(stats.length / perPage)

  for (let p = 0; p < pages; p++) {
    doc.addPage('a4', plan.orientation)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(17, 17, 17)
    doc.text(`${title} - Color List`, margin, margin + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(70, 80, 95)
    doc.text(`${stats.length} colors / ${total} beads`, margin, margin + 9.6)
    doc.text(`Page ${p + 1}/${pages}`, pageWidthMm - margin, margin + 5, { align: 'right' })

    const pageStats = stats.slice(p * perPage, (p + 1) * perPage)
    pageStats.forEach((s, i) => {
      const col = Math.floor(i / rowsPerPage)
      const row = i % rowsPerPage
      const x = margin + col * (contentW / columns)
      const y = margin + HEADER_MM + row * itemHeight
      const [r, g, b] = hexToRgb(colorMap.get(s.id) ?? '#000000')
      doc.setFillColor(r, g, b)
      doc.rect(x, y + 0.6, 4, 4, 'F')
      doc.setDrawColor(180, 185, 195)
      doc.setLineWidth(0.1)
      doc.rect(x, y + 0.6, 4, 4, 'S')
      doc.setFontSize(8)
      doc.setTextColor(30, 35, 45)
      doc.text(`${s.id} x ${s.count}`, x + 5.5, y + 4)
    })
  }
  return pages
}

export interface PatternPdfResult {
  plan: PdfPlan
  /** 总的 PDF 页数（网格页 + 清单页） */
  pageCount: number
  legendPages: number
}

/**
 * 构建 PDF 文档（不下载）。可注入 `renderTile` 替身以便单测。
 */
export async function buildPatternPdf(
  grid: BeadGrid,
  palette: Palette,
  stats: MatchStats[],
  gridOptions: GridRenderOptions,
  opts: PdfPatternOptions = {},
  renderTile?: TileRenderer,
): Promise<{ doc: jsPDF; result: PatternPdfResult }> {
  const { jsPDF: JsPDF } = await import('jspdf')
  const plan = planPdfTiles(grid.width, grid.height, {
    ...opts,
    showCoordinates: opts.showCoordinates ?? gridOptions.showCoordinates,
  })
  const title = opts.title ?? 'Perler Bead Pattern'
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: plan.orientation })
  const drawTile = renderTile ?? ((tile, p) => renderTileToImage(grid, palette, gridOptions, tile, p))

  plan.tiles.forEach((tile, i) => {
    if (i > 0) doc.addPage('a4', plan.orientation)
    drawHeader(doc, plan, tile, i, title)
    const img = drawTile(tile, plan)
    const x = plan.margin
    const y = plan.margin + HEADER_MM
    doc.addImage(img.dataUrl, 'PNG', x, y, img.widthMm, img.heightMm)
    if (opts.registrationMarks ?? true) drawRegistrationMarks(doc, img, x, y)
    drawFooter(doc, grid, plan)
  })

  const legendPages = (opts.includeLegend ?? true) ? addLegendPages(doc, plan, stats, palette, title) : 0

  return {
    doc,
    result: { plan, pageCount: plan.pageCount + legendPages, legendPages },
  }
}

/** 构建并下载 PDF */
export async function exportPatternPdf(
  grid: BeadGrid,
  palette: Palette,
  stats: MatchStats[],
  gridOptions: GridRenderOptions,
  opts: PdfPatternOptions = {},
  fileName = 'perler-pattern.pdf',
): Promise<PatternPdfResult> {
  const { doc, result } = await buildPatternPdf(grid, palette, stats, gridOptions, opts)
  doc.save(fileName)
  return result
}
