// CIEDE2000 正确性交叉验证：与独立实现 delta-e 逐对比较。
// 这是核心算法，单独用参考库兜底，避免公式回归。

import { describe, expect, it } from 'vitest'
import { deltaE2000, rgbToLab } from '../src/core/color'
// @ts-expect-error 该库没有类型声明
import { getDeltaE00 } from 'delta-e'
import type { LAB } from '../src/types'

const toLib = ([L, A, B]: LAB) => ({ L, A, B })

// 覆盖灰阶、同亮度异色、邻近色、极端色等
const LAB_PAIRS: Array<[LAB, LAB]> = [
  [[100, 0, 0], [0, 0, 0]],
  [[53.59, 0, 0], [53.2, 80.25, 67.14]],
  [[53.59, 0, 0], [100, 0, 0]],
  [[50, 0, 0], [50, 40, -60]],
  [[50, 20, -30], [52, 18, -28]],
  [[30, -20, -40], [80, 30, 60]],
  [[60, -60, 40], [60, 50, -50]],
  [[10, 0, 0], [95, 0, 0]],
]

describe('deltaE2000 vs delta-e 参考实现', () => {
  for (const [a, b] of LAB_PAIRS) {
    it(`Lab ${JSON.stringify(a)} vs ${JSON.stringify(b)}`, () => {
      expect(deltaE2000(a, b)).toBeCloseTo(getDeltaE00(toLib(a), toLib(b)), 6)
    })
  }

  it('对常见 RGB 取值也一致', () => {
    const rgbs: Array<[number, number, number]> = [
      [255, 0, 0],
      [0, 128, 64],
      [12, 34, 56],
      [200, 180, 160],
      [77, 200, 255],
    ]
    for (const x of rgbs) {
      for (const y of rgbs) {
        if (x === y) continue
        expect(deltaE2000(rgbToLab(x), rgbToLab(y))).toBeCloseTo(
          getDeltaE00(toLib(rgbToLab(x)), toLib(rgbToLab(y))),
          6,
        )
      }
    }
  })
})
