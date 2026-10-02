// 限制颜色数量：从色卡中自动挑选最多 N 个最合适的色号。
//
// 思路（palette-constrained k-means）：
// 1. 统计取样后出现的唯一颜色及其权重（数量）。
// 2. 用「最远点」确定性地初始化 N 个中心，中心始终吸附到色卡颜色。
// 3. Lloyd 迭代：像素按加权最近中心归类，每个聚类均值再吸附到未使用的色卡色。
// 聚类用 Lab 欧氏距离（deltaE76，快）；最终像素匹配仍走 CIEDE2000（准）。

import { rgbToLab } from './color'
import type { BeadColor, LAB, Palette, RGB } from '../types'

const MAX_ITERATIONS = 12

interface WeightedColor {
  lab: LAB
  count: number
}

function dist2(a: LAB, b: LAB): number {
  const dl = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return dl * dl + da * da + db * db
}

/** 返回距离最近且未被占用的色卡下标；全部占用时返回 -1 */
function nearestUnused(lab: LAB, colors: BeadColor[], used: Uint8Array): number {
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < colors.length; i++) {
    if (used[i]) continue
    const d = dist2(lab, colors[i].lab)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/**
 * 从色卡中选出最多 maxColors 个色号来代表这些像素。
 * maxColors <= 0 或 >= 色卡总数时，直接返回原色卡。
 */
export function selectPaletteColors(
  pixels: (RGB | null)[],
  palette: Palette,
  maxColors: number,
): Palette {
  const colors = palette.colors
  const limit = Math.floor(maxColors)
  if (!Number.isFinite(limit) || limit <= 0 || limit >= colors.length) return palette

  // 统计唯一颜色及权重
  const uniqueMap = new Map<number, WeightedColor>()
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i]
    if (!p) continue
    const key = (p[0] << 16) | (p[1] << 8) | p[2]
    const entry = uniqueMap.get(key)
    if (entry) entry.count++
    else uniqueMap.set(key, { lab: rgbToLab(p), count: 1 })
  }
  const uniques = Array.from(uniqueMap.values())

  const k = Math.min(limit, uniques.length)
  if (uniques.length === 0) {
    const sliced = colors.slice(0, limit)
    return { ...palette, colorCount: sliced.length, colors: sliced }
  }

  const used = new Uint8Array(colors.length)
  const centerIdx: number[] = []

  // 初始中心 1：加权均值 → 最近色卡色
  let mL = 0
  let mA = 0
  let mB = 0
  let total = 0
  for (const u of uniques) {
    mL += u.lab[0] * u.count
    mA += u.lab[1] * u.count
    mB += u.lab[2] * u.count
    total += u.count
  }
  const first = nearestUnused([mL / total, mA / total, mB / total], colors, used)
  centerIdx.push(first)
  used[first] = 1

  // 最远点初始化
  const minDist = new Float64Array(uniques.length).fill(Infinity)
  for (let i = 0; i < uniques.length; i++) minDist[i] = dist2(uniques[i].lab, colors[first].lab)

  while (centerIdx.length < k) {
    // 加权最远点：避免被单个离群像素带偏
    let farIdx = 0
    let farScore = -1
    for (let i = 0; i < uniques.length; i++) {
      const score = minDist[i] * uniques[i].count
      if (score > farScore) {
        farScore = score
        farIdx = i
      }
    }
    const idx = nearestUnused(uniques[farIdx].lab, colors, used)
    if (idx === -1) break
    centerIdx.push(idx)
    used[idx] = 1
    const lab = colors[idx].lab
    for (let i = 0; i < uniques.length; i++) {
      const d = dist2(uniques[i].lab, lab)
      if (d < minDist[i]) minDist[i] = d
    }
  }

  const kk = centerIdx.length

  // Lloyd 迭代
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const sumL = new Float64Array(kk)
    const sumA = new Float64Array(kk)
    const sumB = new Float64Array(kk)
    const cnt = new Float64Array(kk)

    for (const u of uniques) {
      let bi = 0
      let bd = Infinity
      for (let c = 0; c < kk; c++) {
        const d = dist2(u.lab, colors[centerIdx[c]].lab)
        if (d < bd) {
          bd = d
          bi = c
        }
      }
      sumL[bi] += u.lab[0] * u.count
      sumA[bi] += u.lab[1] * u.count
      sumB[bi] += u.lab[2] * u.count
      cnt[bi] += u.count
    }

    // 大聚类优先吸附，保证选出的色号互不相同
    const order = Array.from({ length: kk }, (_, i) => i).sort((a, b) => cnt[b] - cnt[a])
    const newUsed = new Uint8Array(colors.length)
    const newIdx = new Array<number>(kk).fill(0)
    for (const c of order) {
      const target: LAB =
        cnt[c] === 0
          ? colors[centerIdx[c]].lab
          : [sumL[c] / cnt[c], sumA[c] / cnt[c], sumB[c] / cnt[c]]
      let idx = nearestUnused(target, colors, newUsed)
      if (idx === -1) idx = nearestUnused(target, colors, new Uint8Array(colors.length))
      newIdx[c] = idx
      newUsed[idx] = 1
    }

    let changed = false
    for (let i = 0; i < kk; i++) {
      if (newIdx[i] !== centerIdx[i]) {
        changed = true
        break
      }
    }
    centerIdx.length = 0
    centerIdx.push(...newIdx)
    if (!changed) break
  }

  const selected = centerIdx.map((i) => colors[i])
  const uniqueSelected = Array.from(new Map(selected.map((c) => [c.id, c])).values())
  return { ...palette, colorCount: uniqueSelected.length, colors: uniqueSelected }
}
