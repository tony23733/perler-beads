import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaManifest } from './pwa.config'

// 第一阶段：纯本地静态页面，无后端。
// PWA：manifest + Service Worker（离线可用、可添加到主屏幕）。
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // 有新版本时自动更新，无需用户手动操作
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // jsPDF / html2canvas 等懒加载分包较大，放宽上限以便离线也能导出 PDF
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
})
