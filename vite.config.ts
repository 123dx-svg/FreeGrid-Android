import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// 单一版本源:桌面与网页都从 src-tauri/tauri.conf.json 读版本号,避免硬编码漂移
const appVersion = JSON.parse(readFileSync('./src-tauri/tauri.conf.json', 'utf-8')).version

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'FreeGrid · 通往财富自由之路',
        short_name: 'FreeGrid',
        description: '把财富自由翻译成「自由天数」的纯本地记账。零网络,数据只存本机浏览器。',
        lang: 'zh-CN',
        theme_color: '#0a0b13',
        background_color: '#0a0b13',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
})
