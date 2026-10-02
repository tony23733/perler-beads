import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 第一阶段：纯本地静态页面，无 PWA、无后端。
export default defineConfig({
  plugins: [vue(), tailwindcss()],
})
