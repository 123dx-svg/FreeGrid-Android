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
- [ ] **垂直切片:Dashboard**(silverline 主题 + 自由天数 hero + LifeGrid 1825 格 + sparkline)→ 跑 dev server 截图自验
- [ ] Assets(双桶 + 被动源 + 调拨)/ History(分类汇总 + 撤销)/ Check(8 项自检)
- [ ] 各 Sheet(记支出/收入/模拟决策/导入预览)
- [ ] 导入导出(JSON 对齐 BackupJSON + CSV)+ 月度汇总
- [ ] 动画(呼吸网格 / 流星 / 格子级联 —— TimelineView → requestAnimationFrame/CSS)
- [ ] PWA(manifest + service worker,可离线 + 添加到主屏)+ 自托管字体
- [ ] 部署 CF Pages

## 设计源

- silverline 设计 token + Dashboard 结构:iOS 仓库 `.design/freegrid-silverline.html`(浏览器直接打开看)
- 设计语言:白银柔和 + 线条极简 + 天空蓝单 accent + 双主题镜像(浅冷白银 / 深天文台冷蓝紫)
