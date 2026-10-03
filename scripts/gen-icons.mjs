// 生成 PWA / 站点图标（纯 Node，无第三方依赖）。
// 画一个「拼豆爱心」：靛蓝底 + 像素心，输出 PNG（含 maskable 与 apple-touch）。
// 用法：node scripts/gen-icons.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public')
const iconDir = resolve(outDir, 'icons')

// ---- 极简 PNG 编码（RGBA8，无滤波）----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- 画图 ----
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000']
const HIGHLIGHT = new Set(['0,1', '1,0', '1,1']) // 左上高光
const BG = [79, 70, 229] // #4f46e5
const BEAD = [244, 63, 94] // #f43f5e
const BEAD_LIGHT = [253, 164, 175] // #fda4af

function drawIcon(size, { padding }) {
  const rgba = new Uint8Array(size * size * 4)
  const setPx = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  // 背景铺满
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) setPx(x, y, BG)

  const cols = HEART[0].length
  const rows = HEART.length
  const area = size - 2 * padding
  const cell = Math.floor(Math.min(area / cols, area / rows))
  const gap = Math.max(1, Math.round(cell * 0.12))
  const originX = Math.round((size - cell * cols) / 2)
  const originY = Math.round((size - cell * rows) / 2)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (HEART[r][c] !== '1') continue
      const color = HIGHLIGHT.has(`${r},${c}`) ? BEAD_LIGHT : BEAD
      const x0 = originX + c * cell + Math.floor(gap / 2)
      const y0 = originY + r * cell + Math.floor(gap / 2)
      const w = cell - gap
      for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, color)
    }
  }
  return encodePng(size, size, rgba)
}

function faviconSvg() {
  const cells = HEART.map((row, r) =>
    row
      .split('')
      .map((v, c) => {
        if (v !== '1') return ''
        const color = HIGHLIGHT.has(`${r},${c}`) ? '#fda4af' : '#f43f5e'
        return `<rect x="${c + 1}" y="${r + 1}" width="0.86" height="0.86" fill="${color}"/>`
      })
      .join(''),
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 8" width="32" height="32">
<rect width="9" height="8" rx="1.6" fill="#4f46e5"/>
<g transform="translate(1,1)">${cells}</g>
</svg>
`
}

mkdirSync(iconDir, { recursive: true })
writeFileSync(resolve(iconDir, 'icon-192.png'), drawIcon(192, { padding: 27 }))
writeFileSync(resolve(iconDir, 'icon-512.png'), drawIcon(512, { padding: 72 }))
writeFileSync(resolve(iconDir, 'icon-maskable-512.png'), drawIcon(512, { padding: 128 }))
writeFileSync(resolve(outDir, 'apple-touch-icon.png'), drawIcon(180, { padding: 26 }))
writeFileSync(resolve(outDir, 'favicon.svg'), faviconSvg())

console.log('图标已生成到 public/')
