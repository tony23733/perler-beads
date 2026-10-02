import { describe, expect, it } from 'vitest'
import { createMatcher, matchPixels } from '../src/core/matcher'
import { rgbToLab } from '../src/core/color'
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

describe('createMatcher', () => {
  const matcher = createMatcher(palette)

  it('完全相同的颜色直接命中', () => {
    expect(matcher.nearest([255, 0, 0]).id).toBe('R')
    expect(matcher.nearest([0, 0, 0]).id).toBe('K')
  })

  it('近似颜色匹配到最近色', () => {
    expect(matcher.nearest([250, 8, 8]).id).toBe('R')
    expect(matcher.nearest([5, 5, 5]).id).toBe('K')
    expect(matcher.nearest([240, 240, 240]).id).toBe('W')
  })

  it('结果带缓存（同输入返回同一对象）', () => {
    const a = matcher.nearest([123, 45, 67])
    const b = matcher.nearest([123, 45, 67])
    expect(a).toBe(b)
  })

  it('空色卡抛错', () => {
    expect(() => createMatcher({ ...palette, colors: [] })).toThrow()
  })
})

describe('matchPixels', () => {
  const matcher = createMatcher(palette)

  it('空格保持为 null', () => {
    const { cells } = matchPixels([[255, 0, 0], null, [0, 0, 255]], matcher)
    expect(cells).toEqual(['R', null, 'B'])
  })

  it('统计各色号用量并按降序排列', () => {
    const { stats } = matchPixels(
      [
        [255, 0, 0],
        [250, 5, 5],
        [255, 0, 0],
        [0, 0, 255],
        null,
      ],
      matcher,
    )
    expect(stats[0]).toEqual({ id: 'R', count: 3 })
    expect(stats[1]).toEqual({ id: 'B', count: 1 })
    expect(stats).toHaveLength(2)
  })
})
