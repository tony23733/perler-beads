import { describe, expect, it } from 'vitest'
import { downsample } from '../src/core/pixelate'
import type { RgbaImage } from '../src/core/pixelate'
import { createMatcher, matchPixels } from '../src/core/matcher'
import { MARD_221, MARD_291 } from '../src/data/palettes'
import type { RGB } from '../src/types'

/** 用真实 MARD 色卡跑通「降采样 → 匹配 → 统计」整条链路 */

function solid(width: number, height: number, color: RGB): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color[0]
    data[i * 4 + 1] = color[1]
    data[i * 4 + 2] = color[2]
    data[i * 4 + 3] = 255
  }
  return { data, width, height }
}

describe('pipeline（真实 MARD 色卡）', () => {
  const palette = MARD_221
  const ids = new Set(palette.colors.map((c) => c.id))

  it('纯色图匹配后所有色号都存在于色卡', () => {
    const src = solid(8, 8, [200, 30, 40])
    const { pixels } = downsample(src, { targetWidth: 4, targetHeight: 4, background: 'keep' })
    const { cells, stats } = matchPixels(pixels, createMatcher(palette))

    expect(cells).toHaveLength(16)
    for (const id of cells) {
      expect(id).not.toBeNull()
      expect(ids.has(id as string)).toBe(true)
    }
    expect(stats).toHaveLength(1)
    expect(stats[0].count).toBe(16)
  })

  it('统计总数等于非空格数量', () => {
    const src = solid(6, 6, [10, 120, 200])
    const { pixels } = downsample(src, { targetWidth: 5, targetHeight: 5, background: 'keep' })
    const { cells, stats } = matchPixels(pixels, createMatcher(palette))
    const total = stats.reduce((s, x) => s + x.count, 0)
    expect(total).toBe(cells.filter((c) => c !== null).length)
  })

  it('透明背景：空格不进统计', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4)
    // 左上 2x2 红色不透明，其余全透明
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const i = (y * 4 + x) * 4
        data[i] = 220
        data[i + 1] = 20
        data[i + 2] = 20
        data[i + 3] = 255
      }
    }
    const src: RgbaImage = { data, width: 4, height: 4 }
    const { pixels } = downsample(src, {
      targetWidth: 4,
      targetHeight: 4,
      background: 'transparent',
    })
    const { cells, stats } = matchPixels(pixels, createMatcher(palette))
    expect(cells.filter((c) => c === null)).toHaveLength(12)
    const total = stats.reduce((s, x) => s + x.count, 0)
    expect(total).toBe(4)
  })

  it('291 色卡可用且色号唯一', () => {
    const src = solid(4, 4, [120, 200, 120])
    const { pixels } = downsample(src, { targetWidth: 2, targetHeight: 2, background: 'keep' })
    const { cells } = matchPixels(pixels, createMatcher(MARD_291))
    expect(cells).toHaveLength(4)
    const ids291 = new Set(MARD_291.colors.map((c) => c.id))
    for (const id of cells) expect(ids291.has(id as string)).toBe(true)
  })
})
