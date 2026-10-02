import { describe, expect, it } from 'vitest'
import { floydSteinberg, matchPixelsDither, orderedDither } from '../src/core/dither'
import { createMatcher } from '../src/core/matcher'
import { rgbToLab } from '../src/core/color'
import { MARD_221 } from '../src/data/palettes'
import type { BeadColor, Palette, RGB } from '../src/types'

const RAW: Array<{ id: string; hex: string; rgb: RGB }> = [
  { id: 'K', hex: '#000000', rgb: [0, 0, 0] },
  { id: 'W', hex: '#FFFFFF', rgb: [255, 255, 255] },
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

const matcher = createMatcher(palette)

function solidGrey(size: number, value: number): RGB[] {
  return Array.from({ length: size * size }, () => [value, value, value] as RGB)
}

const countOf = (stats: Array<{ id: string; count: number }>, id: string) =>
  stats.find((s) => s.id === id)?.count ?? 0

describe('matchPixelsDither / none', () => {
  it('不抖动时整块灰只用一个色号', () => {
    const { cells, stats } = matchPixelsDither(solidGrey(8, 128), 8, 8, matcher, 'none')
    expect(stats).toHaveLength(1)
    expect(new Set(cells).size).toBe(1)
  })
})

describe('floydSteinberg', () => {
  it('中灰抖动出黑白两种色，且比例大致均衡', () => {
    const { cells, stats } = matchPixelsDither(solidGrey(16, 128), 16, 16, matcher, 'floyd-steinberg')
    expect(cells).toHaveLength(256)
    const k = countOf(stats, 'K')
    const w = countOf(stats, 'W')
    expect(k).toBeGreaterThan(0)
    expect(w).toBeGreaterThan(0)
    expect(k + w).toBe(256)
    expect(k / 256).toBeGreaterThan(0.3)
    expect(k / 256).toBeLessThan(0.7)
  })

  it('空格保持为 null，且不接收误差', () => {
    const pixels: (RGB | null)[] = [null, [128, 128, 128], null, [128, 128, 128]]
    const { cells, stats } = floydSteinberg(pixels, 2, 2, matcher)
    expect(cells[0]).toBeNull()
    expect(cells[2]).toBeNull()
    const total = stats.reduce((s, x) => s + x.count, 0)
    expect(total).toBe(2)
  })
})

describe('orderedDither', () => {
  it('中灰有序抖动出黑白两种色并混合分布', () => {
    const { cells, stats } = matchPixelsDither(solidGrey(16, 128), 16, 16, matcher, 'ordered')
    expect(cells).toHaveLength(256)
    const k = countOf(stats, 'K')
    const w = countOf(stats, 'W')
    expect(k).toBeGreaterThan(0)
    expect(w).toBeGreaterThan(0)
    expect(k + w).toBe(256)
    expect(k / 256).toBeGreaterThan(0.2)
    expect(k / 256).toBeLessThan(0.8)
  })

  it('强度为 0 时不抖动，强度 1 时出现双色', () => {
    const none = orderedDither(solidGrey(8, 128), 8, 8, matcher, 0)
    expect(new Set(none.cells).size).toBe(1)
    const normal = orderedDither(solidGrey(8, 128), 8, 8, matcher, 1)
    expect(new Set(normal.cells).size).toBe(2)
  })
})

describe('平整色块不产生杂色（回归）', () => {
  const mardMatcher = createMatcher(MARD_221)

  it('纯色区域正好命中色卡时，有序抖动不产生杂色点', () => {
    const target = MARD_221.colors[0]
    const px = Array.from({ length: 64 }, () => [...target.rgb] as RGB)
    const { stats } = orderedDither(px, 8, 8, mardMatcher, 1)
    expect(stats).toHaveLength(1)
    expect(stats[0].id).toBe(target.id)
    expect(stats[0].count).toBe(64)
  })

  it('略微偏灰的近似白区域，主色仍占绝大多数（不会满屏点）', () => {
    const target = MARD_221.colors[0]
    const near = [target.rgb[0] - 3, target.rgb[1] - 3, target.rgb[2] - 3] as RGB
    const px = Array.from({ length: 256 }, () => [...near] as RGB)
    const { stats } = orderedDither(px, 16, 16, mardMatcher, 1)
    expect(stats[0].count).toBeGreaterThan(256 * 0.8)
  })
})
