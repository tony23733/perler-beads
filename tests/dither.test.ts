import { describe, expect, it } from 'vitest'
import { floydSteinberg, matchPixelsDither, orderedDither } from '../src/core/dither'
import { createMatcher } from '../src/core/matcher'
import { rgbToLab } from '../src/core/color'
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

  it('强度为 0 时无抖动，增大强度后出现双色', () => {
    const noStrength = orderedDither(solidGrey(8, 128), 8, 8, matcher, 0)
    expect(new Set(noStrength.cells).size).toBe(1)
    const strong = orderedDither(solidGrey(8, 128), 8, 8, matcher, 3)
    expect(new Set(strong.cells).size).toBe(2)
  })
})
