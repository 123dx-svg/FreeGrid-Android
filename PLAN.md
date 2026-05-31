# FreeGrid Web · 迁移计划 + 进度

> 把 iOS 版 FreeGrid(SwiftUI + SwiftData)1:1 复刻为浏览器 PWA。
> 源规格 = `/Users/coni/Desktop/FreeGrid` 的 iOS 代码 + commit 历史(功能最全,带所有已修 bug)。

## 形态与栈(已定)

- **形态**:浏览器网页应用 / PWA(Mac/PC/Linux/安卓/iOS 浏览器全覆盖)。以后需要 Mac/Win 桌面安装包,再用 Tauri 套同一套网页内核。
- **栈**:Vite + **Svelte 5(runes,$state ≈ SwiftUI @State)** + TypeScript。**客户端纯静态**(无 SSR)→ CF Pages 部署 + Tauri 套壳都简单。
- **数据**:本地 localStorage/IndexedDB(隐私:数据不离开浏览器)。
- **部署**:静态构建 → Cloudflare Pages(用户已有账号)。

## Advisor 护栏(必须执行,不是口号)

1. **算法带 bug fix 一起移植**:floor 不四舍五入 / startOfDay 自然日 / trackDays_i+1 / netBurn→∞。✅ 已移植 + 14 断言通过。
2. **JS Date 地雷**:一切天数差走本地零点(startOfDay)+ round,绝不裸 Date 算。✅ `freedom-math.ts` 顶部 daysBetween/startOfDay/addDays。
3. **数据桥**:模型从第一天对齐 iOS `BackupJSON` 的 **snake_case**(is_passive/monthly_amount/passive_sources/first_record_date/created_at)→ iOS 导出 JSON 能直接导进 web。✅ `models.ts`。导入去重用**整数分** `Math.round(amount*100)`(iOS HANDOFF 坑#9:跨设备导入会咬 raw float)。
4. **隐私对等**:**自托管字体**(iOS 那份 .design HTML 外链了 Google Fonts,会破"零网络"承诺),无埋点,只本地存储。
5. 客户端纯静态 + 独立 git(不污染 iOS 仓库)。

## 进度

- [x] 脚手架(Vite+Svelte5+TS+vitest)+ 独立 git
- [x] **引擎移植 + 验证**:`freedom-math.ts`(FreedomMath 全套)+ `models.ts`(模型 + BackupJSON snake_case + ExpenseCategory 9 类 + 别名)→ **14/14 vitest 通过**(78 天案例 / ∞ / floor 一致 / 自然日同日收入不丢 / 双色满格)
- [x] **Dashboard 桌面版**(侧栏导航 + hero 2 列 + FreedomGrid + sparkline + 3 联 stat + 操作行)— 截图验收 ✓
- [x] **Assets / History / Check 三屏**(workflow 并行 build→审查,svelte-check 0 错误,逐屏截图验收 ✓)
      · Assets:净值 + 双桶 + 被动卡 + 调拨 + 解释卡 + 数据卡(导出 CSV/JSON + 从 JSON 导入 + 清空)
      · History:segmented 筛选 + 分类 chip + 流水(中文日期 + 支出 flame/收入 sky + × 删除)
      · Check:3/8 进度 hero + 8 项自检(1:1 移植,达成态自洽)
      · ⚠️ 待统一:页面大标题语言不一致(Dashboard/Check 中文 h1,Assets/History 英文 h1)
- [x] **真持久化 + 导入(让它真能用)**:`store.svelte.ts` 响应式中央 store + localStorage(序列化格式 = BackupJSON,一份 codec 三用:本地存/导入 iOS/导出)。四屏改读 store($derived 全响应)。**已端到端验证**:导入 JSON → 四屏实时更新 → 刷新不丢 → 分类归一(shopping→购物)→ ∞ 态。已接:导入/导出 JSON+CSV/清空/调拨/删除。修了 ∞ 态网格画爆 bug(gridState 统一切分 count)+ ∞ 网格单位标签
- [ ] 各输入 Sheet(记支出/记收入/编辑桶/加被动源/模拟决策)— 目前只能导入,还不能手输
- [ ] 月度汇总(History 日历入口)
- [ ] 动画(呼吸网格 / 流星 / 格子级联 —— TimelineView → requestAnimationFrame/CSS)
- [x] **PWA**(vite-plugin-pwa:manifest + autoUpdate SW + precache,可离线 + 添加到主屏)+ 系统字体(零外链)+ index.html PWA meta + 图标 192/512/maskable
- [x] **GitHub 公开仓库**:[coni555/FreeGrid-Web](https://github.com/coni555/FreeGrid-Web)(README+LICENSE+topics,curl 直连建仓绕 gh 代理)
- [ ] **部署 CF Pages — 待用户在 CF 后台连接 GitHub 仓库**(构建 `npm run build` / 输出 `dist` / Node 由 .node-version=22.12 锁)。连完即自动部署,以后 push 自动更新

## 设计源（2026-05-30 续2 修正)

⚠️ **不要参考 `.design/freegrid-silverline.html`** —— 那只是早期草稿,且在后来一堆 UI refinement(亮色提质/surfaceHi/PassiveCard/格子推演)之前。**真正完整的 UI 在 app 实现代码里**。

- **精确设计 token**:`FreeGrid/DesignSystem.swift`(已提取):
  - 主底 paper 浅 `rgb(242.5,243,245)` 冷银灰 / 深 `rgb(10,11.5,19)`;卡片 mist 浅纯白 / 深 `rgb(20,22,33)`
  - accent sky 浅 `rgb(115,184,235)` / skyDeep 浅 `rgb(71,133,199)`;琥珀金 incomeGold 浅 `rgb(230,166,56)`;flame `rgb(209,102,82)`;mossGreen `rgb(92,158,107)`
  - hairline 浅 `rgb(222,222,225)`;VaultCard 圆角 18 + 1px hairline 描边 **无阴影**;hero 数字 SF Rounded ultraLight 110pt monospacedDigit;kicker mono uppercase tracking 1.8;Sparkline 1.2pt skyDeep 无填充无轴 + 终点 5pt 圆点
  - 间距 4/8/12/16/24/32/48
- **构图结构**:`FreeGrid/ContentView.swift` 各 View(DashboardView 261 / AssetsView 1016 / HistoryView 2375 / CheckView 2900)
  - Dashboard 顺序:topBar → hero 大卡 → 1825 格网格 → 3 联 stat → 操作行 → 模拟 → 今日对比
  - hero:kicker+trend badge / 110pt 数字 + italic 衬线强调字"自由" / hairline + "N 周以来" + sparkline;∞ 态数字转 mossGreen「你已 财富 自由」
- **桌面重排**:iOS 是单列窄屏。桌面版**重新布局**(宽屏:可能侧栏导航替代底 tab、多列排布、hero 居中限宽),但**严格保留 silverline 视觉语言**(上面那套 token + 组件 + 双主题镜像)。不是把手机界面拉宽。
