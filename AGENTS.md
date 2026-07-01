# AGENTS.md — FreeGrid 安卓适配项目（跨会话工作手册）

> 本文件由 OpenCode 自动加载，固化本项目所有环境约定与"踩过的坑"。修改代码/构建前务必先读。

## 项目概览
- **这是什么**：把 `coni555/FreeGrid-Web`（Svelte 5 + Vite + TS 的纯本地记账 web 应用）用 **Capacitor** 套壳成安卓 App。fork 自 FreeGrid-Web。
- **不是原生 Kotlin 应用**。任何"重写成 Kotlin/Compose"的建议都偏离方向——本项目复用 web 代码。
- **包名**：`com.freegrid.app`
- **显示名（品牌名）**：**「自由日记」**（vc19 起,slogan 仍「通往财富自由之路」）。⚠️ **显示名 ≠ 包名**：显示名(strings.xml `app_name`/`title_activity_main`、`capacitor.appName`、App.svelte/Sidebar 顶部名、index.html/PWA manifest、年报封面/分享/引导等文案)可随意改;**包名 `com.freegrid.app`(applicationId/namespace/MainActivity 包/strings 的 package_name+url_scheme)与 localStorage 键(`freegrid-data-v1`/`freegrid-fq-v1`/`freegrid-theme`)绝不能改**——一改老用户数据全丢、无法 `install -r` 升级。导出文件名 `freegrid-backup.json/.csv` 也保留(跨版本备份兼容)。代码内部标识/注释里的 "FreeGrid"/"freegrid-" 保持不动。
- **核心算法**：自由天数/自由网格在 `src/lib/freedom-math.ts`（带 vitest 单测，`npm test`）。
- **数据模型**：`src/lib/models.ts`、`src/lib/store.svelte.ts`。

## 构建环境（关键，机器相关）
- **JDK：必须用 21**（Capacitor 8 要求；JDK 17 会报"无效源发行版:21"）。
  - 便携 JDK21：`F:\AIGenerate\APP\tools\jdk-21.0.11+10`
  - 机器系统 PATH 里另有个 winget 装的 JDK17，所以命令行 `java` 显示 17——**别被误导**，构建一律走 `JAVA_HOME`/`F:\g\gradle.properties` 锁定的 21。
- **Android SDK**：`%LOCALAPPDATA%\Android\Sdk`（platform 35/36、build-tools 35、platform-tools、emulator + 系统镜像 android-35 google_apis x86_64）。
- **GRADLE_USER_HOME=`F:\g`**（短路径，避开超长路径问题；内含 `gradle.properties` 锁定 JDK21）。
- 环境变量已用户级配好：`JAVA_HOME`(21) / `ANDROID_HOME` / `ANDROID_SDK_ROOT` / PATH。

## ⚠️ 三个必须知道的坑
1. **杀毒软件锁文件（深信服 aES / Sangfor EDR）**：Gradle 解压缓存瞬间被锁，报 `Could not move temporary workspace to immutable location`。
   - **对策**：所有构建脚本用「单线程 + 自动重试」（`--no-parallel --max-workers=1` + 循环重试），成功的缓存会复用，通常第 2 次过。**不要手动一次次重试，用脚本。**
   - 若有管理员权限，把 `F:\g` 和项目目录加入杀软白名单可根治。
2. **PWA Service Worker 缓存旧前端**：改了代码"装了新版却没变化"的元凶。
   - **对策**：安卓构建必须用 `vite build --mode android`（在 `vite.config.ts` 里走"无 SW"分支）。脚本已内置。
   - 若仍显示旧界面：`adb uninstall com.freegrid.app` 清掉 SW 缓存后重装（注意：卸载会清数据，仅调试期可用）。
3. **国内下载慢**：
   - Gradle 发行包源已切腾讯镜像（`android/gradle/wrapper/gradle-wrapper.properties`）。
   - Maven 已加阿里云镜像（`android/build.gradle`）。
   - 大文件（系统镜像等）用 aria2 多线程：`F:\AIGenerate\APP\tools\aria2-1.37.0-win-64bit-build1\aria2c.exe -x16 -s16 -c`。

## 便捷脚本（`F:\AIGenerate\APP\tools\`，均为 CRLF 编码）
> 注意：bat 里 for 循环块内 echo 文本**不能带英文/中文括号**，会破坏 cmd 块解析。
- **`dev-android.bat`** — 日常迭代：构建(--mode android)→cap sync→打 **debug** APK(重试)→装模拟器→启动。改完 `src/` 双击即可。
- **`build-release.bat`** — 出**签名 release** APK（给用户/装真机用这个）。
- **`build-apk-retry.bat`** — 只打 debug APK（带重试）。
- **`start-emulator.bat`** — 启动模拟器（默认 Xiaomi_14_Pro_API35）。

## 模拟器 AVD
- **`Xiaomi_14_Pro_API35`**（默认，1440×3200/560dpi，匹配用户真机小米 14 Pro）
- `FreeGrid_Pixel_API35`（Pixel 7，备用）
- 硬件加速 WHPX 可用。

## 🔐 签名铁律（升级不丢数据的地基，绝不可破）
- **release keystore**：`F:\AIGenerate\APP\keystore\freegrid-release.jks`（仓库外，有效期 ~27 年，别名 `freegrid`）。
- **口令**：在 `android/keystore.properties`（**已 gitignore，不入库**）。证书 `CN=FreeGrid`，SHA-256 指纹 `0ce657932cd56ec583fd081812d2870a3c50ed9f655d33abadd5dadab6405d87`。
- **铁律 1**：`freegrid-release.jks` + `keystore.properties` **必须异地备份**。丢了 = 所有老用户永远无法再升级。
- **铁律 2**：每次发布 **`versionCode` 必须 +1**（在 `android/app/build.gradle`）。当前已到 28（v2.17）。
- **铁律 3**：**debug 签名与 release 签名互不兼容**。给用户/装真机**永远用 release 版**（`build-release.bat`）。debug↔release 互切必须卸载=丢数据。
- **铁律 4**：升级用 `adb install -r <release-apk>`（不卸载，保数据）。✅ 已实测 vc2→vc3 数据保留。
- 用户的**小米 14 Pro 从第一次就装 release 版**，否则将来切 release 要卸载丢数据。

## 数据存储与迁移（现状）
- **存储**：localStorage 单 key `freegrid-data-v1`（在 WebView 沙盒）。升级保留；**卸载会清空**。另有 `freegrid-fq-v1`（财商测试)、`freegrid-settings-v1`（设置/个人档案)、`freegrid-theme`（旧主题,已被 settings 迁移接管)——**这些 key 全部绝不能改**(改=用户对应数据丢失)。
- **JSON 格式三端通用**（iOS/web/安卓），是迁移基础。
- ✅ **导入**：`<input type=file>`（`Assets.svelte`），安卓 WebView 可用（系统文件选择器）。已实测导入成功。
- ✅ **导出（已修复）**：原 `Blob+a.download` 在安卓 WebView 是**静默空操作**。已改为：原生平台用 `@capacitor/filesystem` 写缓存目录 + `@capacitor/share` 弹系统分享面板（另存到「文件」/微信/云盘）；web/桌面保留 blob 下载。改动在 `Assets.svelte` 的 `download()`。已实测：导出 → 分享面板 → freegrid-backup.json，内容合法、与导入格式一致（换机迁移闭环打通）。CSV 导出走同一函数，一并修复。
- 自动备份策略：以**手动导出为主**，不依赖 Google 自动云备份（隐私+小米国行不生效）。
- 未做：原生存储镜像兜底、版本化 schema 迁移（改数据结构时需补"读旧版→迁移"）。

## 已完成的适配
- ✅ 设置重构为「抽屉式」(vc27/v2.16):原折叠版(vc26)顶层是一堆 11px mono 灰小字分区头,层级倒置(版本号比分区头还大)、像灰字soup、"个人档案·设置"标题与"个人档案"分区撞名 → 一眼看着混乱、字号不协调。重构为**顶层干净设置行列表 + 点行滑入子 Sheet**:
  - **顶层**(`Sheet title="设置"`):每行 = 线性图标(人/滑杆/标签/数据库/info)+ 标题(15px `--ink` 圆体,视觉主体)+ 右侧状态值(13px 灰:已填/深色/N项)+ chevron,统一 54px 行高 + hairline 分隔。**关于行不可点、右侧直显版本**(安卓 `getInfo` 的 `v2.16 (27)`);底部一行「纯本地·零网络」footer;桌面端更新按钮 `{#if isTauri}`。
  - **子页**:个人档案 / APP 个性化 / 分类管理(仅有自定义时) / 数据·备份与导入,各是一个 `<Sheet>`(复用组件,标题=分区名,× + 遮罩 + 物理返回键均由 overlay 栈处理层级)。点顶层行 → 打开对应子 Sheet 叠在列表之上;返回/×/空白 → 关子页回列表。隐私说明移进个人档案子页顶部。
  - **字号统一**:行标题 15 / 值·状态 13 / 子页字段标签 14 / 提示 12。删掉旧 `.set-sec/.set-secbtn` 那套。仅改 `Settings.svelte`(+ `Check.svelte` 入口卡文案改「设置」)。`svelte-check` 0 错误。真机实测:顶层一屏干净列表、钻入个人档案子页、返回逐层回列表、关于直显版本。
- ✅ 设置面板可折叠(vc26/v2.15):(已被 vc27 抽屉式取代,保留历史记录)。
- ✅ 数据区迁入设置 + 桌面图标长按快捷「记一笔」(vc25/v2.14):
  - **数据管理移出资产页 → 设置**:抽出独立组件 `src/lib/components/DataTools.svelte`(导出 CSV/JSON、导入+合并/替换弹窗、复制转换提示词、清空+二次确认弹窗,自带逻辑+样式),`Settings.svelte` 新增「数据 · 备份与导入」区挂载它。`Assets.svelte` 彻底移除 DATA/UPDATE 区及相关 import/state/函数/样式(资产页只留净值/桶/被动/调拨/说明)。理由:数据备份是全 app 级工具,不属"资产"。
  - **设置新增「关于」区**:显示版本号(安卓用 `@capacitor/app` 的 `App.getInfo()` 取真实 `versionName (build)` = v2.14 (25);web/桌面回退 `__APP_VERSION__`)+ 桌面端更新检查(`{#if isTauri}`)。移动端首次有了版本号展示。
  - **Dashboard 空态提示**改指向「自检→个人档案·设置→数据」(原指资产页,数据区已移走)。
  - **桌面图标长按快捷方式**(Android App Shortcuts,静态):`res/xml/shortcuts.xml`(记支出/记收入,VIEW intent + `freegrid://record/expense|income` + 矢量图标 `res/drawable/ic_shortcut_expense|income.xml`)、`AndroidManifest.xml` MainActivity 加 `<meta-data android:name="android.app.shortcuts">` + `freegrid` scheme 的 VIEW intent-filter(DEFAULT/BROWSABLE)、`strings.xml` 快捷标签(无 BOM)。**Web 接线**:`src/lib/quickadd.svelte.ts`(`quickAdd.action` 信号)、`App.svelte` 用 `@capacitor/app` 的 `getLaunchUrl()`(冷启)+ `appUrlOpen`(热启)解析深链 → `requestQuickAdd` + 切 dashboard、`Dashboard.svelte` `$effect` 监听 → 开对应记账 Sheet。真机实测:`adb am start -d freegrid://record/expense` 冷启动直达记支出、热启动 `freegrid://record/income` 直达记收入、`dumpsys shortcut` 确认两条快捷已注册。`svelte-check` 0 错误。
- ✅ AI 辅助导入(vc24/v2.13,app 仍零网络零 AI):外部平台账单转换交给用户自己的 AI,app 只提供「规范提示词 + 稳健导入」。
  - **新 `src/lib/import-adapters.ts`**:`parseImport(text, currentAssetTotal)` JSON.parse 后判形——含 `expenses/incomes`(app 自备份)→ 原样 BackupJSON;含 `transactions`(AI 转换)→ 逐笔归一(日期容错 ISO/YYYY-MM-DD/YYYY-M-D/时间戳,金额取正,type 支出收入,passive)成 BackupJSON。`buildImportPrompt(EXPENSE_CATEGORIES)` 生成给 AI 的完整提示词(目标 JSON 结构 + 规则 + 本地分类清单 + 示例 + 「只输出JSON」)。
  - **`store.svelte.ts` 加 `mergeBackup(json)`**:fromBackup → 追加 + **内容指纹去重**(kind+YMD+amount+分类/来源+备注)+ 被动源按名合并 + firstRecordDate 取更早 + persist;返回 {added, skipped}。原 `importBackup`=替换(不变)。
  - **`Assets.svelte`**:`onFilePicked` 改为 parse → 弹「导入数据」Sheet(显示"识别到 N 支出·M 收入 + app备份/AI转换 tag" + 合并/替换/取消)。合并=`mergeBackup`,替换=`importBackup`。加「复制转换提示词(给 AI)」按钮(`navigator.clipboard`,失败回退 textarea+execCommand;shell 读不到 app 剪贴板是 Android 隐私限制,正常)。`accept` 放开 `.json,text/plain`。文案说明整个 AI 流程。
  - 真机实测:复制提示词(已复制✓,剪贴板粘贴建议验证)、AI transactions 导入(2支出1收入·AI tag)→ 合并「已合并3笔」→ 再导入去重「已合并0·跳过3」→ v3 app备份替换「支出2435·收入45」。`svelte-check` 0 错误。CSV 直接导入不做(交给 AI),保持 app 简洁与隐私。
- ✅ 流水年份条横向滚动(vc23/v2.12,纯 CSS,仅 `History.svelte`):`.ov-years`/`.rp-years`(经营概览卡 + 年报头部两处)由 `inline-flex; flex-wrap:wrap` 改为 `inline-flex; flex-wrap:nowrap; max-width:100%; overflow-x:auto` + 隐藏滚动条(`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`)+ `.ov-year{flex-shrink:0;white-space:nowrap}`。**10+ 年不再换行成"药丸墙",而是单行横滑**;少年份时仍紧贴内容(不拉满宽,无 mask 误淡化)。已用 14 年(2013–2026)测试数据实测:年份条单行横滑可达 2013,4 年时正常。
- ✅ 记账分类选择器统一 + 自定义 + 紧凑(vc22/v2.11):记支出/记收入原来风格不一(支出=6分组+色点+15类占~8行;收入=扁平+无色点+自定义文本框)。
  - **新共享组件 `src/lib/components/CatPicker.svelte`**(风格单一来源):色点 chip 网格 + **常用+更多▾折叠**(默认只显示常用[按 store 使用频次 top6]∪已选∪自定义,点更多铺开全部)+ **＋自定义**内联输入。记支出/记收入都用它 → 风格必然一致、两边都有色点、支出从~8行压到~2行。
  - **配色统一** `categoryColors.ts` 加 `colorForName(name)`(已知支出→固定色 `CATEGORY_COLORS`;其余[自定义/收入来源]→按名 hash 取 `NAME_PALETTE`,稳定唯一)。`annual.ts` 收入饼图由 `incomeColor(idx)`(位置)改 `colorForName(name)`(按名),被动源仍 `PASSIVE_COLOR` → **记账色点 = 年报饼图颜色**,跨年稳定。`annual.ts` 弹性成本改为余量(cost−食−刚−成长)→ 自定义支出类自动落「弹性」桶。
  - **自定义持久化+管理**:`settings.svelte.ts` 加 `customExpenseCategories[]`/`customIncomeSources[]` + `addCustom(kind,name)`/`removeCustom(kind,name)`(存 `freegrid-settings-v1`)。`Settings.svelte` 加「分类管理」区(列自定义 + ✕ 删除,删除不影响已记流水)。
  - `Dashboard.svelte` 两个记账 Sheet 换成 `<CatPicker>`(options=预设∪自定义,frequent 按使用频次);移除旧 6 分组 markup / 内联 SOURCE_PRESETS chip / 自定义来源文本框及对应 CSS。模型 `EXPENSE_CATEGORIES` 不动;`CATEGORY_GROUPS`/`incomeColor` 变为未用(保留导出,不删)。`svelte-check` 0 错误。真机实测:两边风格一致带色点、更多折叠展开、加自定义(Coffee)自动选中+持久化到设置分类管理、可删除。
- ✅ 物理返回键 + 自检页协调(vc21/v2.10):
  - **物理返回键**(装 `@capacitor/app`):新增全局弹层栈 `src/lib/overlay.ts`(`pushOverlay/popOverlay/closeTopOverlay`)。`Sheet.svelte`(所有录入/年报/月历/删除确认等复用它)和 `FqTest` 结果卡模态在打开时登记、关闭时注销。`App.svelte` 用 `@capacitor/app` 的 `backButton` 监听(动态 import,仅原生):**有弹层→关最上层弹层;无弹层且非首页→回仪表盘;首页→`exitApp()`**。修复了"在设置/年报等 Sheet 里按返回直接退出 app"。真机三态实测通过。`build-release.bat` 已含 `cap sync`,新插件自动进原生工程。
  - **自检页协调**:财商卡 + 设置卡做成同款入口卡(统一 46px 左图标槽 `.fqc-media` + 同内边距 + 同淡色箭头 `›`);**删掉财商卡里孤零零的「重新测试」**(重测在结果卡翻面即有)。
- ✅ 顶部重设计 + 设置/个人档案子系统(vc20/v2.9):
  - **顶部**:删除移动端独立品牌栏 `.mobile-top`(自由日记+slogan+主题按钮),状态栏安全区改由 `main` 的 `padding-top: calc(env(safe-area-inset-top)+sp-lg)` 承接。每屏顶部省出一整条、正文上移(用户反馈"顶部一整块浪费")。桌面 Sidebar 不受影响(本就只在窄屏显示 mobile-top)。
  - **设置模块** `src/lib/settings.svelte.ts`:`$state` 存 主题(system/dark/light)+ 起始页 + 个人档案(出生年份/退休年龄/退休后月开销/赡养老人数/抚养子女数/月收入档/城市/家庭结构/风险偏好),持久化到独立 key `freegrid-settings-v1`;首启迁移旧 `freegrid-theme`。导出 `resolvedTheme()`(system→媒体查询)/`toggleThemeManual()`(桌面侧栏用)+ 派生洞察 `currentAge/yearsToRetire/emergencyTargetMonths/fiTargetNetWorth/hasProfile`。App.svelte 改为从此模块读主题(`data-theme` 由 `resolvedTheme()` 驱动)、起始页 `settings.startTab`。
  - **设置 UI** `src/lib/components/Settings.svelte`:全屏 Sheet,入口在自检页新增「个人档案·设置」卡(`Check.svelte`)。含 个人档案(stepper/¥输入/chips)+ **档案洞察**(距目标退休 X 年、应急储备目标 X 个月[基线6+每赡养老人+3+每抚养子女+2,封顶24]·现有 Y 个月、财务自由目标净值=退休后月开销×12×25 的 4% 法则)+ APP 个性化(主题 跟随系统/深/浅、默认起始页)。风险偏好复用 `freegrid-fq-v1` 的 risk 维显示。
  - **分析接入**:本轮"先建框架+少量露出"——洞察只在设置 Sheet 内呈现;更深接入(健康分权重/财商加权/建议文案随参数变)留后续。**隐私红线不破**:全本地、独立 key、不进财务备份。`svelte-check` 0 错误。真机实测:无品牌栏、设置填档、洞察计算正确(赡养1+抚养1→应急目标11月)、主题深↔浅即时切换、旧主题已迁移。
- ✅ 改名「自由日记」(vc19/v2.8,仅显示名+文案,**包名/数据键不变**):`strings.xml`(app_name/title_activity_main)、`capacitor.config.ts`(appName)、`App.svelte`/`Sidebar.svelte`(顶部名,tag「通往财富自由之路」保留)、`index.html`(title/desc/apple-title)、`vite.config.ts`(PWA manifest name/short_name)、文案 `annual.ts`(年报封面)/`FqTest.svelte`(分享)/`Assets.svelte`(分享标题)/`Dashboard.svelte`(引导语) 里的 FreeGrid → 自由日记。真机验证顶栏+年报封面已显示自由日记,包名仍 com.freegrid.app(升级保数据)。
- ✅ 个人经营年报「数据看板 / 年度解读」双 Tab(vc19,仅 `History.svelte`,`annual.ts` 零改动):目的=让不懂财报的人**第一眼看懂全年概览**,第二步自愿看点评。共享头部常显(年份+封面标题+评级/分数)+ 二段 Tab(默认「数据看板」)+ `{#key}` 淡入(reduced-motion 关)。
  - **数据看板(全量大白话)**:①全年速览 hero(赚/花/攒下 三大数+小 SVG 图标 + 一句大白话总结如「今年攒下 ¥X,大约够 N 个月开销 👍」;组件内 `heroLine` $derived 拼,不改 annual.ts)②钱花在哪/钱从哪来(双环形,标题大白话)③每月进出(柱状)④钱主要花在这几处(成本排名)⑤**「进阶指标·看得懂再看」默认折叠**(`advOpen`):利润率/被动占比/财务自由进度/自由跑道/应急储备/恩格尔/刚弹成长 各配一句大白话注解(`advMetrics` $derived)+ 经营健康分构成进度条。
  - **年度解读(第二步)**:封面副标题 → 健康点评卡(verdict,左边框) → 致股东的一封信 → 经营点评。保诙谐拟企业口吻(仅此侧)。
  - 关年报时 `$effect` 复位到 数据看板+进阶收起。删除了旧的 `.rp-cover/.rp-health/.rp-kpis/.rp-ratios` 等未用样式,`svelte-check` 0 错误。
- ✅ 财商人格「翻转卡 + 精灵动画」交互重构(vc18/v2.7):结果由原「Sheet 里海报+下拉详情」改为**翻转卡模态**——点查看/答完 → 半透明遮罩(blur)+ 居中卡 `scale+fade` 弹出、**无 × 按钮**;**单击卡片** `rotateY` 3D 翻面看详解、**点遮罩空白**收回、Esc 关(dev);`touch-action:manipulation` 防误触缩放。**正面**(身份卡/晒):去掉生硬橙色顶带→柔和家族色(极淡径向渐变底+细描边+精灵后柔光+名字下家族色短线),精灵 hero(带 idle 动画)+型名+4 身份 chip(开源·进取·远见·精算)+tagline+**财商分 59/100**(去段位)+提示行。**背面**:四维条+真实记账并入说明+优势/盲点/建议+分享/重测。**稀有度全部从 UI 移除**(入口卡 meta、结果卡、intro 文案、分享文案都不再出现;留作宣传话术;`fq-test.ts` 的 `rarityOf/rarityBand/POLE_SHARE` 逻辑保留备用)。**段位(记账小学生)/传说宝石**移除。模板拆分:`stage!=='result'` 走 Sheet(intro/quiz),result 走自定义模态。
  - **精灵 idle 动画**(`FqEmblem` 加可选 `animated` 属性,仅海报大尺寸用,入口卡小徽章静态):纯 CSS **只动 transform/opacity**(整体呼吸 scale、兔耳偶尔轻抖、火焰 flicker、举币上下浮),GPU 合成、千元机零压力;`@media (prefers-reduced-motion: reduce)` 全关。**铁律**:动画只碰 transform/opacity,绝不逐帧动 SVG filter/宽高/JS rAF 常驻(会 jank)。
  - 改动:`FqEmblem.svelte`(动画+分组 ear/flame/coin/breathe)、`FqTest.svelte`(翻转卡模态+分享/intro 去稀有度)、`Check.svelte`(入口 meta 只留财商分)。`svelte-check` 0 错误。真机深/浅色实测:弹卡→单击翻面→遮罩关闭→重测入 Sheet 全通。
- ✅ 财商人格「小精灵 family」记忆点重构(vc17/v2.6):原抽象 SVG 徽章(圆框+菱形四 glyph+哈希色)16 型几乎无差别、无记忆点。改为**参数化硬币小精灵**——统一基底+会表情的脸,4 维各驱动一个互不碰撞的插槽:时间 即=兔耳/远=龟壳帽、收入 开=举币冒芽/省=抱钱袋、风险 进=火花+前倾+咧嘴/稳=胸口盾徽+扎马步、决策 感=爱心眼/研=圆眼镜。2⁴=16 只同族一眼可辨。**语义色**按「收入×风险」四象限分家族色(开进=焰橙红/开稳=生长绿/省进=靛紫/省稳=青蓝),颜色承载含义。(结果卡样式后续在 vc18 又改为翻转卡,见上。)`familyOf(code)`/`rarityBand(pct)`/`FAMILIES` 在 `fq-test.ts`。
- ✅ 财商人格测试(vc16/v2.5,纯本地零网络零AI):自检页新增「财商人格测试」入口卡 + 8 项体检折叠。一题一屏自动翻页,50 题,问卷(0.6)+真实记账(0.4)自适应加权(`conf=clamp(记账天数/60)`,0→60天权重渐升;类型答完即冻结,财商分真实部分随记账实时重算→成长感)。4 维(省/稳/远/感=开关·稳进·远即·感研)×16 型;稀有度=各极人群占比(POLE_SHARE)相乘×100,显示「仅 X%」;段位 tierOf(钱包黑洞/省钱萌新/记账小学生/理财明白人/钱生钱老手/财务自由候选人);结果海报含参数化 SVG 徽章 + 优势/盲点/一句建议 + `@capacitor/share` 一键分享文案。已实测全流程:50题自动翻页→海报(精算冒险家 59/100·仅4.2%·真实记账储蓄率36%/被动覆盖12% -4分)→系统分享面板文案正确。
  - 新文件:`src/lib/fq-test.ts`(50题+16型+计分+稀有度+段位+本地存 key `freegrid-fq-v1`)、`src/lib/components/FqEmblem.svelte`(参数化 SVG 徽章,8 glyph)、`src/lib/components/FqTest.svelte`(介绍/答题/结果海报/分享,读 store+deriveDashboard 算真实 metrics)。改 `src/lib/Check.svelte`(8项折叠+测试入口卡+挂 FqTest)。`svelte-check` 0 错误。
- ✅ DonutChart 按住交互(components/DonutChart.svelte):按住饼图区块→画折线 leader 连到右侧对应图例 + 该图例行高亮 + 选中区块高亮其余变暗 + 环形中心改显该分类(名称/¥金额/占比);按住滑动可切换(scrub,角度命中);松手消失。pointerdown/move/up+setPointerCapture+	ouch-action:none;leader 用 overlay svg + getBoundingClientRect 实测坐标。成本结构+营收构成两个 donut 同生效。
- ✅ FREEDOM hero 背景修复(Dashboard.svelte):流星亮头改到运动前端(右下,原来亮头在尾部像倒飞);左侧硬光斑→(后又因像油膜)改为星点夜空层(约20颗星点轻微 twinkle 闪烁)+ 中性轻暗角景深;浅色模式启用流星(深蓝 sky-deep,白底可见),原来浅色 .meteors opacity:0 无动画。
- ✅ 支出分类扩展到 15 类(饮食/房租/房贷/水电燃煤/物业费/交通/车贷/购物/育儿/保险/医疗/成长投资/娱乐/人情/其他),录入弹窗改为**按组分区**展示(CATEGORY_GROUPS:饮食/居住/出行/生活/成长社交/其他),解决多分类时的扁平 chip 墙拥挤。新增分类的色板/别名/年报 RIGID 分组已同步。
- ✅ 分类体系调整:三餐合并为「饮食」,新增「房贷/车贷/人情」(`models.ts` `EXPENSE_CATEGORIES` 现为 饮食/房贷/车贷/交通/购物/娱乐/人情/成长投资/医疗/其他)。旧三餐经 `CATEGORY_ALIASES` 映射到饮食(导入兼容);`categoryColors.ts` 加新色并保留旧三餐色;`annual.ts` 的 FOOD/RIGID/FLEX 分组同步(饮食→FOOD,房贷车贷→RIGID,人情→FLEX)。
- ✅ 记完顶部弹 toast(`Dashboard.svelte`):记一笔后顶部弹「已记一笔·分类±金额 + 撤销」,4 秒自动消失;撤销调 `deleteTransaction`。`addExpense/addIncome` 现返回新 id 供撤销。
- ✅ 流水行显示「日期 周几 时:分」(`History.svelte` `fmtRowDateTime`,时间取 `createdAt`)。注意:模拟器默认 UTC 时区会让样本时间偏 8 小时,已 `setprop persist.sys.timezone Asia/Shanghai`;真机(北京时间)正常。
- ✅ 记账弹窗优化(`Dashboard.svelte` + 新组件 `components/WheelDateTime.svelte`)：日期改为「日期+时(到分钟)」滚轮选择器(scroll-snap 竖滑,无日历弹窗);支出分类/收入来源改为带颜色点的 chip 网格(色点取自 `categoryColors`),来源含快捷 chip+自定义输入。`addExpense/addIncome` 加 `createdAt` 参数,选中时间靠 createdAt 持久化(`toBackup` 的 `date` 仍按 YMD 序列化)。
- ✅ 流水删除二次确认弹窗(复用 `Sheet`,显示该笔详情 + 取消/确认删除)。
- ✅ 移动端响应式布局：窄屏隐藏桌面侧栏，改顶部栏 + 底部 tab 栏，处理安全区（`src/App.svelte`）。
- ✅ 安卓禁用 SW（`vite.config.ts` 的 `--mode android`）。
- ✅ 稳定签名 + 升级保数据。
- ✅ 导出修复（Filesystem+Share，见上节）。已装 `@capacitor/filesystem` `@capacitor/share` `@capacitor/app`(返回键)。
- ✅ 流水页「个人经营年报」可视化：实时经营概览卡 + 全屏年报 sheet。纯 SVG 图表（零依赖）。
  - 新文件：`src/lib/categoryColors.ts`（9类调色板）、`src/lib/annual.ts`（年度聚合+金融指标+经营健康分0-100/评级+诙谐自嘲叙事，纯函数）、`src/lib/components/DonutChart.svelte`（环形图）、`src/lib/components/BarChart.svelte`（月度收入×支出柱状）。
  - 改 `src/lib/History.svelte`：顶部概览卡（年份选择+4 KPI+双环形图）、表头「年报」按钮、年报 sheet。
  - 口径：概览卡=实时（默认最近有数据年）；年报=自然年结算（过去年「已结算」/当年「未结算」）。全部 `$derived` 读 store → 记账即时刷新。
  - 指标：利润率/成本收入比/被动收入占比/财务自由进度/自由跑道/恩格尔系数/刚性·弹性·成长占比/应急储备月数 + 健康分(储蓄率40+造血25+应急20+跑道15)+评级 AAA..B。
  - 财年联动：点经营概览的财年(全部/各年)会同时过滤下方「全部/支出/收入」分段、分类汇总与明细列表(`txInScope` 派生);筛选行右侧加「按日期/按金额」排序(`sortBy`)。
  - 叙事多样化(`annual.ts` `buildNarrative`)：按语气档(excellent/good/ok/poor)分池,每判断 3–5 句变体,用「年份+分数+利润率+笔数」做确定性种子(`fnv1a`+`mulberry`式 rng)挑句并洗牌点评;含同比上一年(`buildYoY`,以交易笔数判断上年是否有数据,避免被动源年化误判)、本年最壕单笔(`maxExpense`)。**纯本地阈值模板,零网络零 AI**(隐私红线;不接外部 LLM)。History 传 `prevReport=scope-1` 供同比。

## 已装项目技能（`.agents/skills/`）
- `capawesome-team/skills@capacitor-plugins` / `@capacitor-app-development`（Capacitor 插件/开发）
- `sveltejs/ai-tools@svelte-code-writer` / `@svelte-core-bestpractices`（Svelte 5 官方）
- `wshobson/agents@mobile-android-design`（移动 UX）

## 后续待办（优先级）
1. 设置的更深分析接入(健康分权重、财商加权、建议文案随档案参数变)+ 更多个性化(货币符号/数字格式)。
2. 各页面（Assets/History）窄屏内部排版细节
3. 版本化 schema 迁移脚手架
4. 应用图标 / 启动页
4. 各页面（Assets/History）窄屏内部排版细节
5. 版本化 schema 迁移脚手架
6. 应用图标 / 启动页
