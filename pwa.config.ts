// PWA manifest 配置（单独放这里，便于单测与复用）。

import type { ManifestOptions } from 'vite-plugin-pwa'

export const APP_NAME = '拼豆图纸生成器'
export const APP_SHORT_NAME = '拼豆图纸'
export const THEME_COLOR = '#4f46e5'
export const BACKGROUND_COLOR = '#f1f5f9'

export const pwaManifest: Partial<ManifestOptions> = {
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description: '把照片转成 MARD 色号拼豆图纸，全程本地计算，图片不上传。',
  lang: 'zh-CN',
  dir: 'ltr',
  display: 'standalone',
  orientation: 'any',
  start_url: '.',
  scope: '.',
  theme_color: THEME_COLOR,
  background_color: BACKGROUND_COLOR,
  categories: ['graphics', 'utilities'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
