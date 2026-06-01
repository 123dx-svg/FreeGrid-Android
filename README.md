# FreeGrid Web · 通往财富自由之路

> [iOS / macOS 原生版 FreeGrid](https://github.com/coni555/FreeGrid-Freedom) 的网页 / PWA 版 —— 把「财富自由」翻译成一个你每天看得见的数字:**自由天数**。一套 silverline 设计,为桌面宽屏重排,Mac / PC / 手机浏览器都能用。
>
> *The web/PWA companion to the iOS app: how many days you could live without earning another cent.*

![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00.svg?logo=svelte)
![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?logo=vite)
![PWA](https://img.shields.io/badge/PWA-installable·offline-5a0fc8.svg)
![Offline](https://img.shields.io/badge/100%25-本地·零网络-2ea44f.svg)

## 这是什么

FreeGrid Web 是 iOS 版 FreeGrid 的**纯前端复刻**:同一套「自由天数 / 自由网格」核心概念和 silverline 视觉语言,用 Svelte 重写并为桌面重新布局(侧栏导航替代手机底 tab)。**零后端、零网络、零账号** —— 数据只存在你浏览器的 localStorage 里。

四屏:**Dashboard**(自由天数 hero + 自由网格 + 趋势)/ **Assets**(双桶净值 + 被动收入 + 调拨)/ **History**(流水 + 分类筛选)/ **Check**(8 项财富自由自检)。

## 📥 获取 / 下载

| 平台 | 怎么用 | 说明 |
|---|---|---|
| **任意浏览器 / PWA** | **[freegrid-web.pages.dev](https://freegrid-web.pages.dev)** | 打开即用,浏览器「添加到主屏」即离线运行,本仓库即它的源码 |
| **Windows 桌面版** | [Releases](https://github.com/coni555/FreeGrid-Web/releases/latest) → `.exe` / `.msi` | 同一套网页内核 + Tauri 打包。未签名,首次运行 SmartScreen 拦截点「更多信息 → 仍要运行」 |
| **iPhone / iPad · Mac**(原生) | [FreeGrid-Freedom Releases](https://github.com/coni555/FreeGrid-Freedom/releases/latest) → `.ipa` / `.dmg` | 原生 SwiftUI 版,住在 ↗ 独立仓库。数据格式与本网页版完全互通 |

> 🍎 **想要原生 iOS / macOS App?** 去 [**FreeGrid-Freedom**](https://github.com/coni555/FreeGrid-Freedom)——同一套「自由天数」引擎的 Swift 原生实现。两套代码独立维护、技术栈不同(Svelte/Tauri vs Swift),但备份 JSON 完全互通,可自由迁移。

## 核心特性

- 📲 **可装的 PWA**:浏览器「添加到主屏」即像原生 App,支持离线。
- 🔁 **与 iOS 版数据互通**:序列化格式与 iOS 版的备份 JSON 完全一致 —— iOS 版导出 JSON,这里直接导入,数据无缝迁移到桌面。
- 🔒 **隐私优先**:整个代码库没有任何网络请求,数据从不离开你的浏览器。想备份就导出 JSON。
- ⚙️ **真引擎驱动**:自由天数 / 自由网格 / 被动覆盖等算法从 iOS 版 1:1 移植并附带单元测试。

## 构建与运行

```bash
npm install
npm run dev      # 本地开发 http://localhost:5173
npm run build    # 生产构建 → dist/(纯静态)
npm run preview  # 预览生产包
npm test         # 跑算法单元测试(vitest)
```

零第三方运行时依赖业务逻辑,纯 Svelte + Vite。构建产物是静态文件,可部署到任意静态托管(本项目部署在 Cloudflare Pages)。

## 隐私

- ✅ **零网络层** —— 没有任何 `fetch` / 网络请求,数据从不离开设备。
- ✅ 无账号、无云、无埋点、无分析。
- ✅ 系统字体(无外链字体文件)。
- ⚠️ 数据存浏览器 localStorage:清浏览器数据会清掉它,导出 JSON 是你的备份通道。

## 许可

**MIT License + [Commons Clause](https://commonsclause.com/)** —— 源码公开,允许自由使用、修改、学习、非商业分发,但不得出售本软件。详见 [LICENSE](LICENSE)。与 [原生版](https://github.com/coni555/FreeGrid-Freedom) 同。
