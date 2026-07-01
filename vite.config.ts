import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// 单一版本源:桌面与网页都从 src-tauri/tauri.conf.json 读版本号,避免硬编码漂移
const appVersion = JSON.parse(readFileSync('./src-tauri/tauri.conf.json', 'utf-8')).version

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // ⚠️ 桌面端(Tauri)绝不启用 PWA service worker:Tauri 自带本地打包资源 + 自动更新,不需要 SW;
  // 而 SW 的 precache 会在 WebView2 用户目录(%LOCALAPPDATA%\...\EBWebView)里缓存旧前端、随安装存活,
  // 导致**更新后仍显示旧界面**(本会话所有"装了新版却没变化"的元凶)。
  // 显式经 `vite build --mode tauri`(tauri.conf 的 beforeBuildCommand)触发,可控;兜底再认 Tauri 注入的
  // TAURI_ENV_PLATFORM,双保险。网页构建(CF Pages 跑 `npm run build`)保留 PWA(离线 + 可安装)。
  const isTauriBuild = mode === 'tauri' || !!process.env.TAURI_ENV_PLATFORM
  // 安卓(Capacitor)同理:WebView 会被 SW precache 缓存旧前端,导致更新后仍显示旧界面。
  // 经 `vite build --mode android` 触发,跳过 PWA,与桌面端一致。
  const isNativeBuild = isTauriBuild || mode === 'android'

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      svelte(),
      // 桌面构建跳过 PWA;网页构建照常注入 service worker
      ...(isNativeBuild
        ? []
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: ['icons/apple-touch-icon.png'],
              manifest: {
                name: '自由日记 · 通往财富自由之路',
                short_name: '自由日记',
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
          ]),
    ],
  }
})
