import { describe, expect, it } from 'vitest'
import { downsample, guessBackgroundFromCorners } from '../src/core/pixelate'
import type { RgbaImage } from '../src/core/pixelate'
import type { RGB } from '../src/types'

/** 用不透明像素构造测试图 */
function makeImage(width: number, height: number, pixels: RGB[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  pixels.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return { data, width, height }
}

/** 用 [r,g,b,a] 构造测试图 */
function makeImageRgba(width: number, height: number, pixels: number[][]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  pixels.forEach((p, i) => {
    data[i * 4] = p[0]
    data[i * 4 + 1] = p[1]
    data[i * 4 + 2] = p[2]
    data[i * 4 + 3] = p[3]
  })
  return { data, width, height }
}

describe('downsample', () => {
  it('纯色图降采样后仍为纯色', () => {
    const src = makeImage(4, 4, Array.from({ length: 16 }, () => [255, 0, 0] as RGB))
    const { width, height, pixels } = downsample(src, {
      targetWidth: 2,
      targetHeight: 2,
      background: 'keep',
    })
    expect(width).toBe(2)
    expect(height).toBe(2)
    expect(pixels).toEqual([
      [255, 0, 0],
      [255, 0, 0],
      [255, 0, 0],
      [255, 0, 0],
    ])
  })

  it('保留左右对比', () => {
    const src = makeImage(2, 1, [
      [0, 0, 0],
      [255, 255, 255],
    ])
    const { pixels } = downsample(src, {
      targetWidth: 2,
      targetHeight: 1,
      background: 'keep',
    })
    expect(pixels).toEqual([
      [0, 0, 0],
      [255, 255, 255],
    ])
  })

  it('区域平均：黑白混合成中灰', () => {
    const src = makeImage(2, 2, [
      [0, 0, 0],
      [0, 0, 0],
      [255, 255, 255],
      [255, 255, 255],
    ])
    const { width, height, pixels } = downsample(src, {
      targetWidth: 1,
      targetHeight: 1,
      background: 'keep',
    })
    expect(width).toBe(1)
    expect(height).toBe(1)
    expect(pixels).toEqual([[128, 128, 128]])
  })

  it('放大时颜色铺满', () => {
    const src = makeImage(1, 1, [[10, 20, 30]])
    const { pixels } = downsample(src, {
      targetWidth: 3,
      targetHeight: 3,
      background: 'keep',
    })
    expect(pixels).toHaveLength(9)
    expect(pixels.every((p) => p && p[0] === 10 && p[1] === 20 && p[2] === 30)).toBe(true)
  })

  it('全透明 + keep → 白', () => {
    const src = makeImageRgba(1, 1, [[255, 0, 0, 0]])
    const { pixels } = downsample(src, { targetWidth: 1, targetHeight: 1, background: 'keep' })
    expect(pixels).toEqual([[255, 255, 255]])
  })

  it('全透明 + transparent → 空格', () => {
    const src = makeImageRgba(1, 1, [[255, 0, 0, 0]])
    const { pixels } = downsample(src, {
      targetWidth: 1,
      targetHeight: 1,
      background: 'transparent',
    })
    expect(pixels).toEqual([null])
  })

  it('半透明：低于阈值成空格，高于阈值保留颜色', () => {
    const src = makeImageRgba(2, 1, [
      [255, 0, 0, 100],
      [0, 0, 255, 255],
    ])
    const { pixels } = downsample(src, {
      targetWidth: 2,
      targetHeight: 1,
      background: 'transparent',
    })
    expect(pixels[0]).toBeNull()
    expect(pixels[1]).toEqual([0, 0, 255])
  })

  it('目标尺寸非法时被夹到至少 1', () => {
    const src = makeImage(2, 2, Array.from({ length: 4 }, () => [1, 2, 3] as RGB))
    const { width, height } = downsample(src, {
      targetWidth: 0,
      targetHeight: -5,
      background: 'keep',
    })
    expect(width).toBe(1)
    expect(height).toBe(1)
  })

  it('去除背景：纯背景格 → 空格，samples 保留原始色', () => {
    const src = makeImage(2, 1, [
      [255, 0, 0],
      [255, 255, 255],
    ])
    const { pixels, samples } = downsample(src, {
      targetWidth: 2,
      targetHeight: 1,
      background: 'remove',
      removeColor: [255, 255, 255],
      tolerance: 10,
    })
    expect(pixels).toEqual([[255, 0, 0], null])
    expect(samples).toEqual([
      [255, 0, 0],
      [255, 255, 255],
    ])
  })

  it('去除背景在源像素级完成：边缘不混入背景色', () => {
    const src = makeImage(2, 2, [
      [255, 0, 0],
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ])
    const { pixels, samples } = downsample(src, {
      targetWidth: 1,
      targetHeight: 1,
      background: 'remove',
      removeColor: [255, 255, 255],
      tolerance: 10,
    })
    // 前景平均应为纯红，而不是红+白的混合
    expect(pixels).toEqual([[255, 0, 0]])
    // 原始平均仍保留混合结果，供拾色
    expect(samples).toEqual([[255, 191, 191]])
  })

  it('去除背景但未指定颜色时退化为保留背景', () => {
    const src = makeImage(1, 1, [[10, 20, 30]])
    const { pixels } = downsample(src, {
      targetWidth: 1,
      targetHeight: 1,
      background: 'remove',
    })
    expect(pixels).toEqual([[10, 20, 30]])
  })
})

describe('guessBackgroundFromCorners', () => {
  it('返回四角中占多数的一簇平均色', () => {
    const samples: (RGB | null)[] = [
      [250, 250, 250],
      [248, 249, 251],
      [252, 250, 249],
      [10, 20, 30],
    ]
    const bg = guessBackgroundFromCorners(samples, 2, 2, 20)
    expect(bg).not.toBeNull()
    expect(bg![0]).toBeGreaterThan(240)
    expect(bg![1]).toBeGreaterThan(240)
    expect(bg![2]).toBeGreaterThan(240)
  })

  it('四角全透明时返回 null', () => {
    expect(guessBackgroundFromCorners([null, null, null, null], 2, 2)).toBeNull()
  })
})
