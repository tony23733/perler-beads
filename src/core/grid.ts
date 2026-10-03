// 可打印网格图纸渲染：每颗豆画格、可选标注色号、网格线与行列坐标。

import type { BeadGrid, Palette } from '../types'

export type GridDisplay = 'color' | 'code' | 'both'

export interface GridRenderOptions {
  /** 每格像素大小 */
  cellSize: number
  /** 显示方式：纯色 / 仅色号 / 填色+色号 */
  display: GridDisplay
  /** 是否画每格网格线 */
  showGrid: boolean
  /** 是否标注行列坐标（从 1 开始） */
  showCoordinates: boolean
  /** 每隔多少格画粗线（底板参考）；0 表示不画 */
  majorEvery: number
  background: string
}

export const DEFAULT_GRID_OPTIONS: GridRenderOptions = {
  cellSize: 24,
  display: 'both',
  showGrid: true,
  showCoordinates: true,
  majorEvery: 10,
  background: '#ffffff',
}

/** 渲染所需的最小 2D 上下文接口，便于用 mock 做单测 */
export interface Grid2DContext {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fillText(text: string, x: number, y: number): void
}

export interface GridLayout {
  cellSize: number
  ruler: number
  originX: number
  originY: number
  width: number
  height: number
}

/** 感知亮度（0-255） */
export function perceivedBrightness(hex: string): number {
  const h = hex.replace(/^#/, '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return 255
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 根据底色选择可读的文字颜色 */
export function labelColorFor(hex: string): string {
  return perceivedBrightness(hex) > 150 ? '#111111' : '#ffffff'
}

/** 计算画布布局与尺寸 */
export function computeLayout(
  cols: number,
  rows: number,
  options: GridRenderOptions,
): GridLayout {
  const cellSize = Math.max(4, Math.round(options.cellSize))
  const ruler = options.showCoordinates ? Math.max(20, Math.round(cellSize * 0.9)) : 0
  return {
    cellSize,
    ruler,
    originX: ruler,
    originY: ruler,
    width: ruler + cols * cellSize,
    height: ruler + rows * cellSize,
  }
}

export function measureGrid(
  cols: number,
  rows: number,
  options: Partial<GridRenderOptions> = {},
): GridLayout {
  return computeLayout(cols, rows, { ...DEFAULT_GRID_OPTIONS, ...options })
}

/**
 * 网格分片（视图区域）：用于分页导出时只渲染整张网格的一部分。
 * 坐标均从 0 开始；行/列号会按全局位置标注，方便跨页拼接。
 */
export interface GridViewport {
  offsetCol: number
  offsetRow: number
  cols: number
  rows: number
}

/**
 * 把网格绘制到 2D 上下文，返回画布尺寸。
 * 调用方需先用 measureGrid 设置好画布尺寸。
 * 传入 viewport 时只渲染该子区域（分页用），行列坐标仍按全局编号。
 */
export function renderGrid(
  ctx: Grid2DContext,
  grid: BeadGrid,
  palette: Palette,
  options: Partial<GridRenderOptions> = {},
  viewport?: GridViewport,
): { width: number; height: number } {
  const opt: GridRenderOptions = { ...DEFAULT_GRID_OPTIONS, ...options }
  const { cells } = grid
  const offsetCol = viewport?.offsetCol ?? 0
  const offsetRow = viewport?.offsetRow ?? 0
  const cols = viewport?.cols ?? grid.width
  const rows = viewport?.rows ?? grid.height
  const layout = computeLayout(cols, rows, opt)
  const { cellSize, ruler, originX, originY, width: totalW, height: totalH } = layout

  // 背景
  ctx.fillStyle = opt.background
  ctx.fillRect(0, 0, totalW, totalH)

  const colorMap = new Map(palette.colors.map((c) => [c.id, c.hex]))
  const showFill = opt.display === 'color' || opt.display === 'both'
  const showText = opt.display === 'code' || opt.display === 'both'

  // 画格
  const fontSize = Math.max(6, Math.round(cellSize * 0.4))
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const id = cells[(offsetRow + y) * grid.width + (offsetCol + x)]
      const px = originX + x * cellSize
      const py = originY + y * cellSize
      const hex = id ? (colorMap.get(id) ?? '#cccccc') : null

      ctx.fillStyle = showFill && hex ? hex : '#ffffff'
      ctx.fillRect(px, py, cellSize, cellSize)

      if (showText && id) {
        ctx.fillStyle = showFill && hex ? labelColorFor(hex) : '#111111'
        ctx.fillText(id, px + cellSize / 2, py + cellSize / 2 + 1)
      }
    }
  }

  // 每格网格线
  if (opt.showGrid) {
    ctx.lineWidth = 1
    ctx.strokeStyle = '#cbd5e1'
    ctx.beginPath()
    for (let x = 0; x <= cols; x++) {
      const px = originX + x * cellSize + 0.5
      ctx.moveTo(px, originY)
      ctx.lineTo(px, originY + rows * cellSize)
    }
    for (let y = 0; y <= rows; y++) {
      const py = originY + y * cellSize + 0.5
      ctx.moveTo(originX, py)
      ctx.lineTo(originX + cols * cellSize, py)
    }
    ctx.stroke()
  }

  // 粗线（每 majorEvery 格，按全局索引定位）
  if (opt.majorEvery > 0) {
    ctx.lineWidth = 2
    ctx.strokeStyle = '#64748b'
    ctx.beginPath()
    const firstCol = Math.ceil(offsetCol / opt.majorEvery) * opt.majorEvery
    for (let g = firstCol; g <= offsetCol + cols; g += opt.majorEvery) {
      const px = originX + (g - offsetCol) * cellSize
      ctx.moveTo(px, originY)
      ctx.lineTo(px, originY + rows * cellSize)
    }
    const firstRow = Math.ceil(offsetRow / opt.majorEvery) * opt.majorEvery
    for (let g = firstRow; g <= offsetRow + rows; g += opt.majorEvery) {
      const py = originY + (g - offsetRow) * cellSize
      ctx.moveTo(originX, py)
      ctx.lineTo(originX + cols * cellSize, py)
    }
    ctx.stroke()
  }

  // 外框
  ctx.lineWidth = 2
  ctx.strokeStyle = '#334155'
  ctx.strokeRect(originX, originY, cols * cellSize, rows * cellSize)

  // 行列坐标（全局编号，从 1 开始）
  if (opt.showCoordinates) {
    ctx.fillStyle = '#475569'
    ctx.font = `${Math.max(8, Math.round(ruler * 0.42))}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let x = 0; x < cols; x++) {
      ctx.fillText(String(offsetCol + x + 1), originX + x * cellSize + cellSize / 2, ruler / 2)
    }
    for (let y = 0; y < rows; y++) {
      ctx.fillText(String(offsetRow + y + 1), ruler / 2, originY + y * cellSize + cellSize / 2)
    }
  }

  return { width: totalW, height: totalH }
}
