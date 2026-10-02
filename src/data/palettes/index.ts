// MARD 色卡运行时封装：合并生成数据 + 元信息，并预计算 Lab。
//
// 数据来源：HansBug/pindou-color-data (MIT)
// 注意：色值为屏幕参考值，不等同于实物豆子颜色；严谨对色请以实物色卡为准。

import type { BeadColor, Palette, RawPaletteColor } from '../../types'
import { rgbToLab } from '../../core/color'
import { MARD_221_COLORS } from './mard221'
import { MARD_291_COLORS } from './mard291'

const SOURCE_URL = 'https://github.com/HansBug/pindou-color-data'
const LICENSE = 'MIT'

const GROUP_NAMES: Record<string, string> = {
  A: '黄橙',
  B: '绿',
  C: '蓝青',
  D: '紫蓝',
  E: '粉红',
  F: '红',
  G: '橙棕',
  H: '黑白灰',
  M: '莫兰迪',
  P: '柔和过渡',
  Q: '亮色点缀',
  R: '高饱和补充',
  T: '近白透明',
  Y: '明亮荧光',
  ZG: '莫兰迪扩展',
}

const BASIC_ORDER = ['H', 'E', 'B', 'C', 'A', 'F', 'G', 'D', 'M']

interface PaletteMeta {
  id: string
  name: string
  nameZh: string
  groupOrder: string[]
}

function buildPalette(meta: PaletteMeta, raw: RawPaletteColor[]): Palette {
  const colors: BeadColor[] = raw.map((c) => ({
    ...c,
    groupName: GROUP_NAMES[c.group] ?? c.group,
    lab: rgbToLab(c.rgb),
  }))
  return {
    ...meta,
    colorCount: colors.length,
    groupNames: GROUP_NAMES,
    source: SOURCE_URL,
    license: LICENSE,
    colors,
  }
}

/** MARD 221 色（标准版，最主流，默认） */
export const MARD_221 = buildPalette(
  { id: 'mard', name: 'MARD', nameZh: 'MARD 221', groupOrder: BASIC_ORDER },
  MARD_221_COLORS,
)

/** MARD 291 色（221 + 70 扩展，可选） */
export const MARD_291 = buildPalette(
  {
    id: 'mard291',
    name: 'MARD',
    nameZh: 'MARD 291',
    groupOrder: [...BASIC_ORDER, 'R', 'P', 'ZG', 'Y', 'Q', 'T'],
  },
  MARD_291_COLORS,
)

export const PALETTES = {
  mard: MARD_221,
  mard291: MARD_291,
} as const satisfies Record<string, Palette>

export type PaletteId = keyof typeof PALETTES

/** 默认色卡 */
export const DEFAULT_PALETTE_ID: PaletteId = 'mard'

export function getPalette(id: string): Palette {
  return (PALETTES as Record<string, Palette>)[id] ?? MARD_221
}
