// 全局类型定义

export type RGB = [number, number, number]
export type LAB = [number, number, number]

/** 色卡原始条目（由 scripts/gen-palette.mjs 生成，未含 Lab） */
export interface RawPaletteColor {
  /** 色号，如 "A1" */
  id: string
  /** "#FAF5CD" */
  hex: string
  rgb: RGB
  /** 色系字母，如 "A" */
  group: string
}

/** 运行时色卡条目（含预计算 Lab 与色系中文名） */
export interface BeadColor extends RawPaletteColor {
  groupName: string
  lab: LAB
}

/** 一套品牌色卡 */
export interface Palette {
  id: string
  /** 品牌名，如 "MARD" */
  name: string
  /** 展示名，如 "MARD 221" */
  nameZh: string
  colorCount: number
  /** 色系字母 → 中文名 */
  groupNames: Record<string, string>
  /** 展示顺序 */
  groupOrder: string[]
  /** 数据来源 URL */
  source: string
  /** 许可协议 */
  license: string
  colors: BeadColor[]
}

/** 像素化结果：每格一个色号 id，null = 空格/透明 */
export interface BeadGrid {
  width: number
  height: number
  cells: (string | null)[]
}

export type DitherMode = 'none' | 'floyd-steinberg' | 'ordered'

export interface ProjectSettings {
  targetWidth: number
  targetHeight: number
  maxColors?: number
  dither: DitherMode
  background: 'keep' | 'transparent' | 'remove'
  /** remove 模式下去除的背景色 */
  removeColor?: RGB
  /** remove 模式的颜色容差（RGB 欧氏距离） */
  tolerance?: number
  paletteId: string
}
