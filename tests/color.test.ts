import { describe, expect, it } from 'vitest'
import {
  deltaE2000,
  hexToRgb,
  rgbToHex,
  rgbToLab,
  srgbToLinear,
} from '../src/core/color'
import type { LAB } from '../src/types'

describe('hexToRgb / rgbToHex', () => {
  it('解析 6 位 HEX', () => {
    expect(hexToRgb('#FAF5CD')).toEqual([250, 245, 205])
  })

  it('解析 3 位简写', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
    expect(hexToRgb('f00')).toEqual([255, 0, 0])
  })

  it('拒绝非法输入', () => {
    expect(() => hexToRgb('#12')).toThrow()
    expect(() => hexToRgb('#GGGGGG')).toThrow()
  })

  it('往返转换一致', () => {
    const hex = '#1A2B3C'
    expect(rgbToHex(hexToRgb(hex))).toBe(hex)
  })
})

describe('srgbToLinear', () => {
  it('端点与分段正确', () => {
    expect(srgbToLinear(0)).toBeCloseTo(0, 10)
    expect(srgbToLinear(255)).toBeCloseTo(1, 10)
    // 低于阈值走线性段：10/255/12.92
    expect(srgbToLinear(10)).toBeCloseTo(10 / 255 / 12.92, 10)
  })
})

describe('rgbToLab', () => {
  it('白色 ≈ L100 / a0 / b0', () => {
    const [L, a, b] = rgbToLab([255, 255, 255])
    expect(L).toBeCloseTo(100, 2)
    expect(a).toBeCloseTo(0, 2)
    expect(b).toBeCloseTo(0, 2)
  })

  it('黑色 = 0', () => {
    const [L, a, b] = rgbToLab([0, 0, 0])
    expect(L).toBeCloseTo(0, 6)
    expect(a).toBeCloseTo(0, 6)
    expect(b).toBeCloseTo(0, 6)
  })

  it('中灰无彩度', () => {
    const [, a, b] = rgbToLab([128, 128, 128])
    expect(a).toBeCloseTo(0, 3)
    expect(b).toBeCloseTo(0, 3)
  })

  it('红色 a 为正', () => {
    const [, a, b] = rgbToLab([255, 0, 0])
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })
})

describe('deltaE2000', () => {
  it('相同颜色为 0', () => {
    const lab: LAB = [50, 20, -30]
    expect(deltaE2000(lab, lab)).toBe(0)
  })

  it('对称', () => {
    const a: LAB = [50, 2.6772, -79.7751]
    const b: LAB = [50, 0, -82.7485]
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 10)
  })

  // Sharma et al. (2005) CIEDE2000 官方测试数据
  const sharma: Array<[LAB, LAB, number]> = [
    [[50.0, 2.6772, -79.7751], [50.0, 0.0, -82.7485], 2.0425],
    [[50.0, 3.1571, -77.2803], [50.0, 0.0, -82.7485], 2.8615],
    [[50.0, 2.8361, -74.02], [50.0, 0.0, -82.7485], 3.4412],
    [[50.0, -1.3802, -84.2814], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, -1.1848, -84.8006], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, -0.9009, -85.5211], [50.0, 0.0, -82.7485], 1.0],
    [[50.0, 0.0, 0.0], [50.0, -1.0, 2.0], 2.3669],
  ]

  for (const [lab1, lab2, expected] of sharma) {
    it(`Sharma 参考对 ${JSON.stringify(lab1)} vs ${JSON.stringify(lab2)} = ${expected}`, () => {
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(expected, 4)
    })
  }
})
