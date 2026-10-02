import { describe, expect, it } from 'vitest'
import { selectPaletteColors } from '../src/core/quantize'
import { rgbToLab } from '../src/core/color'
import { MARD_221 } from '../src/data/palettes'
import type { BeadColor, Palette, RGB } from '../src/types'

const RAW: Array<{ id: string; hex: string; rgb: RGB }> = [
  { id: 'K', hex: '#000000', rgb: [0, 0, 0] },
  { id: 'W', hex: '#FFFFFF', rgb: [255, 255, 255] },
  { id: 'R', hex: '#FF0000', rgb: [255, 0, 0] },
  { id: 'G', hex: '#00FF00', rgb: [0, 255, 0] },
  { id: 'B', hex: '#0000FF', rgb: [0, 0, 255] },
]

const colors: BeadColor[] = RAW.map((c) => ({
  ...c,
  group: 'X',
  groupName: '测试',
  lab: rgbToLab(c.rgb),
}))

const palette: Palette = {
  id: 'test',
  name: 'TEST',
  nameZh: '测试色卡',
  colorCount: colors.length,
  groupNames: { X: '测试' },
  groupOrder: ['X'],
  source: 'test',
  license: 'MIT',
  colors,
}

const idsOf = (p: Palette) => p.colors.map((c) => c.id).sort()

describe('selectPaletteColors', () => {
  it('限制值非法或超出时返回原色卡', () => {
    const px: RGB[] = [[255, 0, 0]]
    expect(selectPaletteColors(px, palette, 0)).toBe(palette)
    expect(selectPaletteColors(px, palette, -3)).toBe(palette)
    expect(selectPaletteColors(px, palette, 99)).toBe(palette)
  })

  it('选出主导色：黑白为主 + 一个红点，限 2 色 → 黑白', () => {
    const px: RGB[] = [
      ...Array.from({ length: 50 }, () => [0, 0, 0] as RGB),
      ...Array.from({ length: 50 }, () => [255, 255, 255] as RGB),
      [255, 0, 0],
    ]
    const result = selectPaletteColors(px, palette, 2)
    expect(result.colors).toHaveLength(2)
    expect(idsOf(result)).toEqual(['K', 'W'])
    expect(result.colorCount).toBe(2)
  })

  it('限 3 色时纳入红点', () => {
    const px: RGB[] = [
      ...Array.from({ length: 50 }, () => [0, 0, 0] as RGB),
      ...Array.from({ length: 50 }, () => [255, 255, 255] as RGB),
      [255, 0, 0],
    ]
    const result = selectPaletteColors(px, palette, 3)
    expect(idsOf(result)).toEqual(['K', 'R', 'W'])
  })

  it('结果色号唯一且都来自原色卡', () => {
    const px: RGB[] = [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [10, 10, 10],
      [250, 5, 5],
    ]
    const result = selectPaletteColors(px, palette, 3)
    const ids = result.colors.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const all = new Set(colors.map((c) => c.id))
    for (const id of ids) expect(all.has(id)).toBe(true)
  })

  it('空像素（全透明）也能返回限制数量内的色卡', () => {
    const result = selectPaletteColors([null, null, null], palette, 2)
    expect(result.colors).toHaveLength(2)
  })

  it('唯一颜色少于限制值时不硬凑', () => {
    const result = selectPaletteColors([[255, 0, 0], [255, 0, 0]], palette, 4)
    expect(result.colors).toHaveLength(1)
    expect(result.colors[0].id).toBe('R')
  })

  it('在真实 MARD 221 上限制 16 色', () => {
    // 造一个彩色渐变，覆盖多个色系
    const px: RGB[] = []
    for (let i = 0; i < 256; i += 8) {
      px.push([i, 255 - i, 128])
      px.push([255 - i, 128, i])
      px.push([128, i, 255 - i])
    }
    const result = selectPaletteColors(px, MARD_221, 16)
    expect(result.colors.length).toBeLessThanOrEqual(16)
    expect(result.colors.length).toBeGreaterThan(1)
    const valid = new Set(MARD_221.colors.map((c) => c.id))
    for (const c of result.colors) expect(valid.has(c.id)).toBe(true)
    // 唯一性
    expect(new Set(result.colors.map((c) => c.id)).size).toBe(result.colors.length)
  })
})
