import './app.css'
import { bootRestore, installMirror } from './lib/native-mirror'

// 关键顺序:先从原生镜像补回 localStorage 缺失的键(抗 WebView 存储被清),
// 再 installMirror 打补丁,最后**动态 import** App —— 保证 App 及其 runes 状态模块
// (settings/config 等在 import 时即读 localStorage)在恢复完成后才求值。
async function start() {
  await bootRestore()
  installMirror()
  const { mount } = await import('svelte')
  const App = (await import('./App.svelte')).default
  mount(App, { target: document.getElementById('app')! })
}

void start()
