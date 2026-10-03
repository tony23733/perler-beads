import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pwaManifest } from '../pwa.config'

describe('PWA manifest', () => {
  it('包含安装所需的基本字段', () => {
    expect(pwaManifest.name).toBeTruthy()
    expect(pwaManifest.short_name).toBeTruthy()
    expect(pwaManifest.display).toBe('standalone')
    expect(pwaManifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(pwaManifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('包含 192/512 与 maskable 图标，且图标文件确实存在', () => {
    const icons = pwaManifest.icons ?? []
    const sizes = icons.map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(icons.some((i) => String(i.purpose ?? '').includes('maskable'))).toBe(true)

    for (const icon of icons) {
      const file = resolve(__dirname, '..', 'public', String(icon.src))
      expect(existsSync(file), `缺少图标文件：${icon.src}`).toBe(true)
    }
  })
})
