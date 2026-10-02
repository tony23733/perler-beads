// 颜色空间转换与色差计算
// sRGB -> XYZ(D65) -> CIELAB，以及 CIEDE2000 色差。
// 参考：IEC 61966-2-1 (sRGB)、CIE 15:2004、Sharma et al. (2005) CIEDE2000。

import type { LAB, RGB } from '../types'

/** "#RRGGBB" / "#RGB" -> [r, g, b] */
export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
    throw new Error(`非法 HEX 颜色: ${hex}`)
  }
  const n = Number.parseInt(h, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** [r, g, b] -> "#RRGGBB"（大写） */
export function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

/** sRGB 单通道（0-255）-> 线性光（0-1） */
export function srgbToLinear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
] as const

/** sRGB -> CIE XYZ（D65 白点，Y 归一化到 1） */
export function rgbToXyz([r, g, b]: RGB): RGB {
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  return [
    XYZ_MATRIX[0][0] * R + XYZ_MATRIX[0][1] * G + XYZ_MATRIX[0][2] * B,
    XYZ_MATRIX[1][0] * R + XYZ_MATRIX[1][1] * G + XYZ_MATRIX[1][2] * B,
    XYZ_MATRIX[2][0] * R + XYZ_MATRIX[2][1] * G + XYZ_MATRIX[2][2] * B,
  ]
}

// D65 参考白点
const Xn = 0.95047
const Yn = 1.0
const Zn = 1.08883
const EPSILON = 216 / 24389 // (6/29)^3
const KAPPA = 24389 / 27

function f(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116
}

/** CIE XYZ -> CIELAB */
export function xyzToLab([x, y, z]: RGB): LAB {
  const fx = f(x / Xn)
  const fy = f(y / Yn)
  const fz = f(z / Zn)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** sRGB -> CIELAB */
export function rgbToLab(rgb: RGB): LAB {
  return xyzToLab(rgbToXyz(rgb))
}

const RAD = Math.PI / 180
const POW25_7 = Math.pow(25, 7)

/**
 * CIEDE2000 色差（kL = kC = kH = 1）。
 * 结果越小越接近；0 表示完全相同。
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Math.pow(Cbar, 7)
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + POW25_7)))

  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)

  const h1p = hueAngle(b1, a1p)
  const h2p = hueAngle(b2, a2p)

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp: number
  if (C1p * C2p === 0) {
    dhp = 0
  } else {
    const diff = h2p - h1p
    if (Math.abs(diff) <= 180) dhp = diff
    else if (diff > 180) dhp = diff - 360
    else dhp = diff + 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let hbarp: number
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p
  } else {
    const diff = Math.abs(h1p - h2p)
    const sum = h1p + h2p
    if (diff <= 180) hbarp = sum / 2
    else if (sum < 360) hbarp = (sum + 360) / 2
    else hbarp = (sum - 360) / 2
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * RAD) +
    0.24 * Math.cos(2 * hbarp * RAD) +
    0.32 * Math.cos((3 * hbarp + 6) * RAD) -
    0.2 * Math.cos((4 * hbarp - 63) * RAD)

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2))
  const Cbarp7 = Math.pow(Cbarp, 7)
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + POW25_7))
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc

  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2))
  const Sc = 1 + 0.045 * Cbarp
  const Sh = 1 + 0.015 * Cbarp * T

  const termL = dLp / Sl
  const termC = dCp / Sc
  const termH = dHp / Sh

  return Math.sqrt(termL * termL + termC * termC + termH * termH + Rt * termC * termH)
}

/** 色相角（度，0-360）；a、b 均为 0 时返回 0 */
function hueAngle(b: number, a: number): number {
  if (b === 0 && a === 0) return 0
  const deg = Math.atan2(b, a) / RAD
  return deg >= 0 ? deg : deg + 360
}
