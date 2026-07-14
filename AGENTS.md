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
- **铁律 2**：每次发布 **`versionCode` 必须 +1**（在 `android/app/build.gradle`）。当前已到 93（v2.70）。
- **铁律 3**：**debug 签名与 release 签名互不兼容**。给用户/装真机**永远用 release 版**（`build-release.bat`）。debug↔release 互切必须卸载=丢数据。
- **铁律 4**：升级用 `adb install -r <release-apk>`（不卸载，保数据）。✅ 已实测 vc2→vc3 数据保留。
- 用户的**小米 14 Pro 从第一次就装 release 版**，否则将来切 release 要卸载丢数据。

## 数据存储与迁移（现状）
- **存储**：localStorage 单 key `freegrid-data-v1`（在 WebView 沙盒）。升级保留；**卸载会清空**。另有 `freegrid-fq-v1`（财商测试)、`freegrid-settings-v1`（设置/个人档案)、`freegrid-theme`（旧主题,已被 settings 迁移接管)——**这些 key 全部绝不能改**(改=用户对应数据丢失)。
- **JSON 格式三端通用**（iOS/web/安卓），是迁移基础。
- ✅ **导入**：`<input type=file>`（`Assets.svelte`），安卓 WebView 可用（系统文件选择器）。已实测导入成功。
- ✅ **导出（已修复）**：原 `Blob+a.download` 在安卓 WebView 是**静默空操作**。已改为：原生平台用 `@capacitor/filesystem` 写缓存目录 + `@capacitor/share` 弹系统分享面板（另存到「文件」/微信/云盘）；web/桌面保留 blob 下载。改动在 `Assets.svelte` 的 `download()`。已实测：导出 → 分享面板 → freegrid-backup.json，内容合法、与导入格式一致（换机迁移闭环打通）。CSV 导出走同一函数，一并修复。
- 自动备份策略：以**手动导出为主**，不依赖 Google 自动云备份（隐私+小米国行不生效）。vc69 起加**备份提醒**（`settings.lastBackupAt` + 数据页「上次备份 N 天前 / 从未备份」+ 久未备份警示），但仍只提醒、不做自动镜像（App 私有目录卸载也会清，off-device 靠用户导出）。
- 未做：原生存储镜像兜底、版本化 schema 迁移（改数据结构时需补"读旧版→迁移"）。

## 数据保护(vc83/v2.60,升级不丢 + 换机迁移)
- **全部数据键**(8 个,`backup-full.ts` 的 `APP_DATA_KEYS`):`freegrid-data-v1`(资产+收支)、`-badges-v1`(徽章)、`-fq-v1`(财商)、`-fq-progress-v1`、`-level-v1`、`-settings-v1`(设置/个人档案/模板)、`-theme`(遗留)、`-ai-v1`(AI)。
- **原生持久化镜像 + 启动自动恢复**(`src/lib/native-mirror.ts`,仅原生):把全部键镜像成 `Directory.Data/freegrid-mirror.json`;给 `localStorage.setItem/removeItem` 打补丁,凡 `freegrid-*` 写入 → 防抖 800ms `mirrorNow()`,`@capacitor/app` pause 时立即写。`bootRestore()` 在 `main.ts` **挂载 App 之前** `await` 执行,只补 localStorage **缺失**的键(overwrite:false,不覆盖已有)。**`main.ts` 用动态 import 挂载 App**(先 bootRestore→installMirror,再 `import('./App.svelte')`),保证 settings/config 等在 import 时读 localStorage 的模块在恢复之后才求值。效果:`install -r` 升级本就保留 + **即便 WebView 存储被系统清掉,重启也自动恢复**。真机实测:删掉整个 `app_webview/.../Local Storage/leveldb` → 重启 → 仪表盘数据完整回来。
- **完整备份 · 换机迁移**(设置 → 数据,`DataTools.svelte` 新块 + `backup-full.ts`):`buildFullBackup()` 打包 `EXPORT_KEYS`(全部键**排除 `freegrid-ai-v1`**,密钥不进明文备份)成 `{app,kind:"freegrid-full",version,exportedAt,keys}` → `download()` 存 `freegrid-full-YYYYMMDD.json`。「一键导入全部」= 选文件 → `parseFullBackup` 认 `kind` → **二次确认(覆盖式整机替换,不可撤销)** → `restore(keys,{overwrite:true})` → `mirrorNow()` → `location.reload()` 让所有模块重新水合。真机实测:导出(不含 ai 键)→ 清空 → 一键导入 → 资产/自检/设置全回来。
- **红线**:全本机、不联网、不进跨端账单备份(`freegrid-backup.json` 格式不变、iOS/web 兼容);AI 密钥不进导出文件;`restore` 仅接受 `freegrid-` 前缀键(防越权写)。无新依赖(Filesystem/App 已装)。`backup-full.test.ts` 6 测,`npm test` 46/46,`svelte-check` 0 error。

## 已完成的适配
- ✅ 省电:隐藏时暂停装饰动画(vc92/v2.69):真机反馈耗电偏高(≈0.54%/min,接近视频 App)——根因是仪表盘星空/流星/辉光的**持续 CSS 动画**在没人看时仍满帧合成。方案(用户选「离开仪表盘停止就行」,不精简辉光):`app.css` 加 `:root[data-idle="1"] *{animation-play-state:paused!important}`;`App.svelte` 切换 `<html data-idle>` —— **原生用 `@capacitor/app` 的 `appStateChange`(isActive→"0"/"1")**,web 用 `visibilitychange`。**⚠ 坑**:原生 WebView 的 `visibilitychange` 在 resume 后可能仍报 hidden,会把动画卡死(实测),故原生**只用 appStateChange**、不挂 visibilitychange。tab 切换本就 unmount 仪表盘(动画随之停),故只需覆盖息屏/切后台。真机验证:? 科普 sheet 前台能正常动画入场(证明未卡死);背景→前台循环后仍正常。paused 保留进度、恢复无缝。**注**:只在隐藏时省电,前台主动看仪表盘的动画开销不变(用户接受)。
- ✅ 自由天数科普单位对齐 hero(vc90/v2.67):真机反馈「? 科普弹窗里自由天数的单位和外部面板不一致」。根因:`freedomDaysDisplay(fd)` 返回**按档位换算后的显示数**(≥1年时是「月」值,如 35),但科普弹窗 `= 自由天数` 行硬编码「天」→ 显示「35 天」(其实是 35 月),与 hero「35 月」矛盾且公式(净值÷日均净烧=天)不自洽。修:`Dashboard.svelte` 科普行改为显示**原始天数**(`Math.round(vm.freedomDays)` + 千分位 + 「天」,公式除法自洽),`vm.unit !== "day"` 时再追加「· ≈ {freedomDaysDisplay} {unitLabel}」与 hero 对齐。真机验证:195990÷180.4 → 「1,086 天 · ≈ 35 月」,月值与 hero 一致。
- ✅ 资产/负债明细排序(vc89/v2.66):`Assets.svelte` 明细区标题加排序按钮(≥2 项才显示,「↕ 金额/收益·利率/类型」循环);`sortItems()` 金额↓ / 利率↓(收益或利率,并列按金额)/ 类型(按 `ASSET_TYPES`/`LIABILITY_TYPES` 预设序);选择持久化在 `settings.assetSort`/`liabilitySort`(默认 amount)。CSS:`.detail-head .kicker{margin-right:auto}` 把排序钮+加号推到右侧(排序钮隐藏时加号仍右对齐)。真机验证:负债切「利率」→ 信用卡 18.25% 升到房贷 4.9% 之上(呼应 AI「先还高息」)。
- ✅ 账单导入后引导校准资产/现金 + 替换不丢资产(vc88/v2.65):真机反馈「AI 导入完账单后仪表盘/资产没更新」。**排查结论:不是响应式 bug** —— 真机实测 merge 后仪表盘的流水派生量(日均/自由天数/被动占比/网格/年报)全部即时更新;只有**净值/现金/资产不变**,因为 `mergeBackup` 只加流水、不动资产快照(账单也不含资产)。这是 UX 认知落差,非崩溃。修:
  - **可选「反映到现金」+ 引导**:`mergeBackup` 现返回 `cashDelta`(新增收入−新增支出);`store` 加 `adjustCash(delta)`(允许透支为负,与记一笔一致)。`DataTools.doImport` 合并有新增 → 弹**导入后引导 Sheet**「已合并 N 笔·自由天数/年报已更新;账单不含现金/资产,净值不会自动变。净支出 ¥X —— 若还没从现金扣可一键更新,否则跳过、到资产页手动校准」+ 按钮「从现金扣 ¥X / 跳过·手动校准」。真机验证:合并 3 笔(净支出¥4010)→ 点「从现金扣」→ 现金 60000→55990、净值 200000→195990、资产/负债明细完好。
  - **替换不再清空已录资产**:`runAiImport` 构造的 backup 之前只带 `{total}`,「替换」会把定期/基金/负债等塌成现金、丢明细。现改为带上当前 `asset_items`/`liability_items`/`liabilities`,替换也完整保留资产明细。决策 Sheet 文案同步:合并「账单只更新流水与统计,不改动你的现金/资产」;替换(AI/CSV 来源)「保留你已录的资产/负债」。
  - `svelte-check` 0 error;`npm test` 46/46。红线不动。
- ✅ 资产/负债总额去重(vc87/v2.64,方案 B):顶部三列总览(资产/现金/负债)与「资产明细/负债明细」标题里的总额重复。改:①删「资产明细」「负债明细」标题里的 `.detail-total`(:248/:274)→ 标题只留 kicker + 右侧「＋」;②去掉资产/负债总览卡的铅笔(加项走明细区「＋」、编辑走点明细行),**现金卡保留铅笔**(现金无明细,只能直接编辑);③删无用 `.detail-total` CSS。心智模型:上=三个总额一眼看全,下=组成项列表。纯布局,不动数据/净值/备份/AI。真机验证:总额只出现一次、「＋」加项 sheet 正常。
- ✅ 资产明细也可填年化收益率 + 编辑 sheet 按钮对齐(vc86/v2.63):
  - **资产年化收益率**:`AssetItem` 加 `rate`(年化收益率%,0=未填);`BackupAssetItemJSON` 加 `rate`;`toBackup/fromBackup`、`addAssetItem(...,rate)`/`updateAssetItem({rate})`、`demo.ts` 均带上。`Assets.svelte` 资产 sheet 加「年化收益率%(可选)」字段(提示「定期/债券/基金等有预期年化的可填」);资产项行显示**绿色** `.item-rate.gain` 徽章(`--moss`,区别于负债的红色徽章)。
  - **AI 参考资产收益**:`History` `assetAllocation` 按类型聚合时算**金额加权平均年化**;`annualMessages` `allocation:[{type,pct,rate?}]`,allocLine 输出「定期 37%(年化2.6%)…」,sys 追加「若给了各类年化收益率,可点评配置效率、低收益占比是否过高」,cacheKey allocSig 纳入 rate。
  - **编辑 sheet 按钮对齐**:`.sheet-actions .fg-btn` 由「删除 `flex:0 0 auto`+定宽 / 保存 `flex:1`」(保存被挤出)改为**两者 `flex:1 1 0`+`min-width:0` 等宽两列**;`.ghostbtn.danger` 去掉定宽/额外 padding。资产/负债两个 sheet 共用。真机验证:删除/保存等宽,资产可填年化并显示绿徽章。
- ✅ 资产/负债类型化 + 年报饼图 + AI 纳入配置/高息负债(vc85/v2.62):
  - **数据模型(加字段,向后兼容,不改 localStorage 键)**:`models.ts` 加 `AssetItem{id,type,name,amount}` / `LiabilityItem{id,type,amount,rate}`;`UserAssets` 加 `assetItems[]`/`liabilityItems[]`;`ASSET_TYPES`(定期/基金/股票/债券/房产/黄金/**加密货币**/其他)、`LIABILITY_TYPES`(房贷/车贷/信用卡/消费贷/花呗白条/网贷/其他)。`lockedAssets`/`liabilities` 变成「明细之和」(仍是净值/自由天数的权威总额);**现金**保持单独直接编辑桶(不细分)。
  - **配色**:`categoryColors.ts` 加 `assetTypeColor()`(暖/金色系)、`liabilityTypeColor()`(暖红/警示系),记账色点、明细列表、年报饼图共用。
  - **store**:`recomputeAssetTotals()`(总额=明细和)、`migrateAssetsToItems()`(旧单值 lockedAssets/liabilities>0 且无明细 → 各生成一条「其他」)、CRUD `add/update/removeAssetItem` + `add/update/removeLiabilityItem`(每次改后 recompute+persist);`initStore` 水合后 `migrateCategories()`→`migrateAssetsToItems()`→`recomputeAssetTotals()`。`updateBucket` 现仅管 `"cash"`。
  - **备份(跨端兼容)**:`BackupAssetsJSON` 加可选 `asset_items`/`liability_items`(snake_case);`toBackup` 写明细(空则 undefined),`total`=资产+现金、`liabilities`=负债和(iOS/web 仍读总额)。`fromBackup`:有明细→`lockedAssets`=明细和、`cash`=`total−明细和`(还原分桶)、`liabilities`=明细和;无明细→回落旧逻辑(total→cash)。真机 import 验证:定期/基金/股票/黄金 + 房贷@4.9%/信用卡@18.25% 全还原,净值不变、被动收入回来。
  - **资产页 `Assets.svelte`**:**移除调拨**(`transfer` 已删,`.transfer/.seg/.amount-row/.vbtn` CSS 也删);3 张汇总卡保留(资产/现金/负债 total,现金 pencil 直接编辑,资产/负债 pencil→加项);新增「资产明细」「负债明细」两区(色点+类型+名称/利率徽章+金额,点行编辑,`.detail/.item-row/.item-dot/.item-rate` 等);新增/编辑项 Sheet 用 `CatSelect` 选类型 + 金额(+资产 name / +负债 年化利率%)+ 删除;说明文案改「资产按类型分条记…负债建议标注年化利率…资产/负债只在手动增删改时变」。
  - **年报饼图(`History.svelte` 数据看板)**:`slicesByType()` 按类型聚合成 `Slice[]`;`资产配置·当前` + `负债构成·当前` 两个 `DonutChart`(有明细才显示,当前存量快照)。真机验证:资产配置 定期 37.5%/基金 28.13%/股票 21.88%/黄金 12.5%,负债构成 房贷 75%/信用卡 25%。
  - **AI(`prompts.ts` `annualMessages`)**:`assets` 入参加 `allocation:[{type,pct}]` + `debts:[{type,amount,rate}]`;有明细则 sys 追加「点评资产配置(集中度/流动性)+ 高息负债优先(先还年化最高的,雪崩法;低息房贷不必急)」;user 加 `资产配置`/`负债清单` 行;cacheKey 纳入 alloc/debt 签名(`shortHash`)。`History` letterMsgs 传 `allocation`(=assetSlices)+`debts`(=liabilityItems)。真机验证:董事长报告「优先还清年化18.25%的信用卡(雪崩法),房贷4.9%可正常月供;资产配置定期占比偏高,可提高基金/黄金比例」。
  - **promo 生成器**(`tools/gen-promo-data.mjs`):`backup.assets` 加 `asset_items`/`liability_items`(定期6w/基金4.5w/股票3.5w/黄金2w + 房贷1.5w@4.9%/信用卡0.5w@18.25%),供演示与真机测试。
  - `svelte-check` 0 error(5 warning),`npm test` 46/46,真机 7 项全过(迁移/明细增删改/净值不变/饼图/AI/备份还原/passive 恢复)。
- ✅ 仪表盘紧凑化(照搬 iOS)+ 分类下拉 + 记账内联预览 + 今日条 + 格子/动画(vc84/v2.61):对齐 iOS `coni555/FreeGrid-Freedom`。
  - **三数据横排**:`Dashboard.svelte` `.stats` 由竖排(vc33)改回 `grid repeat(3,1fr)`,数字 40→26px,少占约 2 张卡高。
  - **按钮一行**:`.actions` 拆成 `.act-pair`(记支出/记收入 固定两列,手机也不塌)+ `.act-sim`(⚡模拟一笔 独占一行);移除旧 `<720px` 塌成竖排规则。
  - **分类下拉(新 `components/CatSelect.svelte`)**:一行触发「● 分类 ⌄」→ 点开带**色点**面板(常用置顶 + 当前高亮 + `＋自定义`);`TxSheet` 分类与来源都换成它(`CatPicker` 现未用)。
  - **今日 vs 日均条(移植 iOS `todaySection`)**:`Dashboard` 加 `todaySpending`/`todayPct`/`todayDeltaText`;新块 today = 左今日¥ · 进度条(sky 填充+末端标记,低于日均转 moss)· 右日均¥ · 下方「低于日均 N%·节省¥Y / 高于日均 N%·多花¥Y / 今日尚未消费」。作为**第 4 个可重排块**(`KNOWN_BLOCKS`+默认 order 加 `"today"`,老用户 `normalizeOrder` 自动追加)。
  - **记账内联「自由影响」预览(新 `components/FreedomImpact.svelte`)**:`TxSheet` 新增态按当前金额用现成 `simOutcome` 实时算,**单行**「这笔 ≈ 削/多 N 天自由」(支出红/收入绿),金额 0 或 Δ<1 天自动隐藏,点「详情」展开三行。中性措辞、无开关。
  - **模拟决策输入金额自动播**:`Dashboard` 演示 `$effect` 里,金额/模式变化后停 450ms 且有可播格差 → 自动 `playDemo()`(保留重播)。真机:输 ¥50000 自动播完、按钮显「重播」。
  - **格子「今天」闪烁增强**(`FreedomGrid.svelte`):`.current` scale 1.02→1.2、白芯 + **金/蓝同色光晕**(`--halo`)双层辉光、周期 2.8→2.6s;reduced-motion 保底。仅 transform/box-shadow/filter。
  - **资产三列小卡**(`Assets.svelte`):`.buckets` 2 列→`repeat(3,1fr)`,负债并入成第 3 列;内边距缩小 + `moneyFont` 26→21;窄屏折叠断点 420→340px。
  - **类目「育儿」→「日用」**:`models.ts`(分类表+`CATEGORY_GROUPS`)、`categoryColors.ts`(色沿用、旧「育儿」键留兼容)、`annual.ts`(RIGID)。加别名 `育儿/日用品/生活用品/日杂→日用`,**删** `孩子/教育→育儿`;`store.initStore` 加 `migrateCategories()` 就地改已存「育儿」记录为「日用」。
  - `svelte-check` 0 error;`npm test` 46/46。红线:包名与 localStorage 键不变、零新联网、动画仅 transform/opacity。
- ✅ 合并去重修复 + 年报董事长口吻 + AI 余额 + B站推广物料(vc82/v2.59):三件事一起做。
  - **合并去重只对已存在记录(Task1,`store.svelte.ts` `mergeBackup`)**:旧逻辑把本次导入的新记录指纹也回填 `seen` → 同一批里"真·多笔完全相同的小额"(如同日两笔一样的外卖)会被误当重复折叠(2026 合并丢 3 笔/¥52 的根因)。改为:`existing` 只收当前 store 记录的指纹,过滤新记录时**不再回填**,于是本批内部相同条目全部保留;重复导入同一文件仍能跳过已存在的。首次导入(空账本)从此一笔不少。指纹仍是 `kind|YMD|amount|key|note`。
  - **年报「董事长」口吻 + 综合分析(Task2a,`prompts.ts` `annualMessages`)**:三档语气(正向/谨慎/求生)统一开头「**尊敬的董事长,您的公司本{年/季}……**」。新增入参 `assets`(净值/资产/现金/负债/被动%)+ `prev`(上一期营收/成本/结余,做**同比**)。体例改为**分条**(`· 综合经营 / · 同比往期 / · 亮点表扬 / · 改进建议`),**先真诚表扬再克制建议**、控篇幅(≤~320 字)。cacheKey 升为 `annual2:` 前缀并纳入资产+同比签名(旧缓存自动重生成新格式)。`History.svelte` 加**不受 Lv5 门控的 `aiPrevReport`**(专供 AI 同比)并把 `vm` 资产 + prev 传入 `letterMsgs`。真机验证 2025 报告:开头称呼✓、四条分条✓、引用净值20万/被动31%/较去年+2.5万/储蓄率+4个百分点/恩格尔16%/应急储备建议——全达标。
  - **AI 设置显示 Key 余额(Task2b,手动)**:`providers.ts` 加可选 `balanceUrl`,仅 DeepSeek = `https://api.deepseek.com/user/balance`;`llm.ts` 加 `fetchBalance(provider,key)`(CapacitorHttp GET,Bearer key,读 `balance_infos[0].total_balance`+currency;**不计入月调用上限**);`AiSettings.svelte` 测试连接下加「Key 余额 · 刷新」行——**纯手动**,只在点「刷新」时联网(不自动、不轮询),显示 ¥余额 + 拉取时间;切服务商清空;无 `balanceUrl` 的服务商显「暂不支持余额查询」。真机验证:点刷新 → **¥19.85 · 17:06 刷新**。
  - **B站推广物料(Task3,不入 App)**:`tools/gen-promo-data.mjs` 生成三年(2024–2026)代表性演示数据(成长story/正净值/被动收入/丰富分类/健康自由天数/复利建筑师人格)→ `tools/freegrid-promo.json`(app 备份格式,直接导入替换)。真机导入后手动「调拨」现金→资产得漂亮金/蓝分桶(净值¥20万=资产16万+现金6万−负债2万、被动31%)。10 张真机截图存 `promo/assets/`。`promo/index.html` = 自包含**深色星空 HTML 幻灯片**(Noto Serif SC + Unbounded,starfield+meteor,scroll-snap + 键盘←→/↑↓ 导航,手机边框嵌截图,11 屏:封面→痛点→自由天数→资产→年报→AI董事长→财商人格→模拟器→求生→隐私→CTA)。用 headless Chrome 验证渲染正常。红线:动画只 transform/opacity;演示数据只在模拟器,不改任何 App 代码红线。
  - `svelte-check` 0 error;`npm test` 40/40。
- ✅ 年报入口收敛 + 省钱模拟 + AI 解读常驻 + 国情增强(vc78/v2.55):四项一起发。
  - **年报单入口**:移除经营概览卡底部「查看完整年报 →」(`.ov-more`),只保留顶部「年报」按钮(两者原都调 `openReport`)。腾出的位置放新模拟器入口。
  - **省钱模拟 · 拿铁因子(流水页新模拟器)**:`sim-spend.ts`(纯函数 + 单测 7/7:`monthlySavingByPct/ByPerDay`、`annualSaving`、`contributedTotal`、`investedFutureValue`[年金终值复利]、`investedGain`)+ `components/SpendSimSheet.svelte`。入口 = 经营概览卡内金色 `⚡ 省钱模拟 · 拿铁因子 →`(`.sim-btn`,与资产/自检同款)。**基于真实记账**:类目 chips 自动取 `report.expenseSlices ÷ monthsSpan` 的月均(默认选最大类)、月支出预填可改;少花「按比例(25/50/100% 预设 + 自定义)」或「按每天 ¥」→ 每月/每年省 → `freedomDaysFor` 换自由天数 → 累计投入 vs 复利估算(默认年化 3% 稳健可调)+ 三条诚实陷阱(收益不保证/别砍必要开支/通胀)。全本地零网络零 AI。真机实测:饮食 ¥868×30%=¥260/月、年省¥3,125≈23天自由、定投10年累计¥31,248→复利¥36,389(收益¥5,141)。
  - **AI 年度解读常驻 + 上次生成时间**:此前解读文本只存组件 `aiLetter`,重启/切数据即"消失"(其实缓存里有,需再点生成才免费恢复)。现:`History` 加 `$effect` —— 打开解读 tab 且 `aiReady("annual")` 且 `aiLetter` 空 → 用统一派生 `letterMsgs.cacheKey` `cacheGet` 自动回填(**免费、不联网**);`config.svelte.ts` 加 `cacheAt: Record<string,number>`(load/persist/默认 `{}`)+ `cacheGetAt`,`cacheSet` 顺带盖时间戳;解读页脚显示 `aiLetterCost || fmtAgo(aiLetterAt)`(今天/N天前/日期)。真机实测:生成后强杀重启 → 重新打开解读 tab **自动显示 + 「今天生成」**,不再需要重点生成。红线:绝不自动联网(仍 opt-in);AI config 仍不进财务备份。
  - **AI 建议国情增强(指令 + 个人档案个性化)**:`prompts.ts` 加 `CHINA_CONTEXT`(人民币;应急储备 3–6 个月支出;警惕超前消费/网贷/信用卡分期;以储蓄率/恩格尔系数作依据;不照搬 4% 法则等国外经验)注入 `annualMessages` 三档人格 + `FQ_SYS`。`annualMessages` 新增可选 `profile`(个人背景摘要),`settings.svelte.ts` 加 `profileSummary()`(城市/家庭/赡养抚养/年龄/风险偏好 代号→标签);`config` 加 **`sendProfile`**(默认关)+ `AiSettings` 年报下加 opt-in 子开关「结合个人档案个性化」;`History` 仅当 `aiConfig.sendProfile` 才把 `profileSummary()` 传入,cacheKey 含 profile 哈希(`shortHash`)。真机实测:生成的解读引用储蓄率/健康分/自由天数作依据,建议含"人情砍到10%/拼车/定存/周末副业时薪50/网贷信用卡分期用雪球法先还高息/每月15号转生存储备金"——明显贴合国情。红线:profile 是新外发数据 → 默认关、显式 opt-in + 披露。
  - `svelte-check` 0 error;`npm test` 44/44(新增 sim-spend 7)。
- ✅ 导入归一 + 饼图占比精度(vc76–77/v2.53–54):承接上条真机实测 `2025.csv` 后的两轮修正。
  - **收入来源归一(vc76)**:AI 导入时收入 `source` 之前不受约束 → 同义来源被拆成多种(实测「工作收入 82% + 工资 17%」本是一回事)。修:把「记一笔·记收入」的预设 `SOURCE_PRESETS` 抽到 `models.ts` 的 **`INCOME_SOURCES`**(单一来源;`TxSheet` 改引用);`importMessages` 新增可选入参 `incomeSources`,系统提示加一行「收入 source 必须从这些里选最接近的一个(同义合并,如工作收入/薪水都归工资)」;`DataTools.runAiImport` 传 `[...INCOME_SOURCES, ...settings.customIncomeSources]`。**格式无关**:约束用的是 app 自己的收入类目,不写死任何外部平台字段。真机重导 `2025.csv` → 营收构成合并成「工资 98.60% / 红包 1.40%」。
  - **饼图隐藏 0% 碎片(vc76)**:`DonutChart` 的 `visibleSlices` 由 `value>0` 收紧为 `value>0 && Math.round(pct)>=1` —— 占比四舍五入 <0.5% 的碎片(会显示成「0%」)在**弧段 + 图例**都不渲染。用户诉求:0% 不该出现在饼图。
  - **占比两位小数(vc77)**:`DonutChart` 图例/中心占比、`History` 的 `pctText`(利润率/被动占比/财务自由进度/恩格尔/刚弹成长)、年报成本排名 `rp-rank-pct` 全部 `Math.round` → `toFixed(2)`。真机验证:利润率 42.70%、房租 30.28%…其他 0.52%(仍 >0.5% 阈值,故显示;人情 0.46% 仍隐藏)。**注**:隐藏阈值仍是 0.5%(整数四舍五入到 0),与两位小数显示并存;若要连 <0.5% 也显示需另调阈值。给 AI 提示词用的 `savingRatePct/topCategories` 等仍保持整数(非显示)。
- ✅ 外部账单大文件·通用分批送 AI(vc75/v2.52,`DataTools.svelte`):
  - **背景/红线**:用户明确「外部平台 CSV 不得把任何格式写死进 App」。故**不做**针对特定平台的本地 CSV 解析/列名映射/分类别名(此前一版误加了 `parseLedgerCsv` + models.ts 外部分类别名,已全部撤回)。外部 CSV/任意账单一律走**通用 AI 识别**(严格 opt-in、每次点击才联网)。
  - **痛点**:几百行账单一次性送 AI 会撞 `maxTokens` 上限被截断(≈100~130 笔后 JSON 失败/只导入一部分)。实测用户两份文件 356/322 笔。
  - **解法(格式无关)**:`runAiImport` 把原文按「逻辑行」等分成块、逐块调 `importMessages` → `parseImport` → 合并所有 transactions。只做两件通用事:① `splitLogicalLines` 引号内换行不算换行(RFC4180 通用文本规则,防一行记录被切断);② `splitForAi` 若首行不含日期(像列说明/表头)→ 带到每块作上下文;`CHUNK_LINES=80`(≈3000 tokens 安全落在 4000 内)。每块最多重试 2 次,失败块计数、其余照常导入并提示「有 N 批未识别」。
  - **UI**:决策 Sheet 预告「文件较大,会分 N 批发送(约 N 次额度)」(`aiBatches` 派生);进度条文案显「AI 正在识别账单…第 x/N 批」(`aiProgress`)。合并/替换确认沿用。
  - **验证**:两份真实 CSV 经 `splitForAi` 均切 5 批(80+80+80+80+37 / 80+80+80+80+4),**行数零丢失**、表头正确识别、引号内 `¥1,360.00`/嵌入换行 `"外卖\n"` 不断行。`svelte-check` 0 error、单测 37/37。**未做端到端真机 AI 跑**(每份约 5 次真实 DeepSeek 调用,消耗用户额度 + 需手动过系统文件选择器)——CSV 已推到模拟器 `/sdcard/Download/2025.csv`、`bill-2026.csv` 待手动选文件实测。
- ✅ 导入数据体验强化(vc74/v2.51,`DataTools.svelte`):
  - **AI 开启时按钮变样**:`aiReady("import")` 为真 → 「导入数据」按钮换成 **✨ 火花图标 + 「AI」蓝色徽章**、天蓝描边(`.data-import.aion`);关闭则维持原下载图标。下方说明文案也随 AI 开/关切换。
  - **耗时行为进度条 + 提示语**:新增 `phase: "idle"|"ai"|"importing"`。AI 识别中 → 按钮显 `⟳ AI 识别中…`(spinner)+ 不定量滑动**进度条** + 「AI 正在识别账单…请稍候(联网中,勿关闭)」;大量数据(>300 笔)写库前 `phase="importing"` + `await tick()` + 40ms 让进度条渲染,显「正在导入 N 笔…」。进度条 CSS 纯 transform 动画 + `prefers-reduced-motion` 兜底。
  - **普通导入格式不对直接返回错误**:本机 `parseImport` 失败且 **AI 关闭** → 立即红字错误「文件格式不支持:{具体原因}。仅支持本机 JSON 备份;CSV/其他账单需在设置开启 AI」。错误态用独立 `importErr` 布尔(不再靠字符串匹配"失败/无法")。
  - **AI 识别的取舍交给用户**:本机识别失败且 **AI 开启** → 不再自动联网,而是弹**决策 Sheet**「用 AI 识别这份文件?」告知会联网上传该文件内容+消耗额度(只发这份、不含其它),用户选「✨ 用 AI 识别」或「取消」;识别完仍走「合并/替换」确认。
  - 真机验证:AI 开 → 按钮✨+AI 徽章;选本机 JSON(1805/2435 笔)直接进合并/替换;选自造 CSV(3 行)→ 决策 Sheet → 用 AI 识别 → 进度条+提示 → 真 AI 转成「3 笔支出·AI 转换」→ 合并/替换。`svelte-check` 0 error。红线不动(AI 仍 opt-in、只在用户点击时联网)。
- ✅ 决策模拟 · 跳槽 / 创业(vc73/v2.50):自检页新增入口卡「决策模拟 · 跳槽 / 创业」(成就墙与设置之间)→ Sheet 顶部分段「跳槽|创业」。人生大决策的提前预估、看清代价,客观口吻。**全本地零网络零依赖零 AI**。
  - 计算 `src/lib/sim-life.ts`(纯函数 + 单测 7/7):跳槽 `jobStats`(真实时薪=年总额÷(年上班+年通勤),`daysPerWeek` 双休5/大小周5.5/单休6/无休7 × 48 工作周);创业 `startupMonthlyBurn`(月消费+固定成本−营收)、`startupRunwayMonths`((净值−启动)÷净烧,盈利→∞)、`monthlyVsEmployed`(放弃月薪−生意盈余)、`freedomDaysFor`(金额÷日均净烧)。
  - `components/LifeSimSheet.svelte`(极简双模式):
    - 跳槽 = **现在 vs 新机会 两栏卡**,各填 月薪/每天工时/每天通勤/休息(4段);揭穿「真实时薪 ¥X→¥Y」(涨/跌配 moss/flame 色)+ 年总额/年上班/年通勤对比 + 结论(年多赚¥/多搭N小时≈M工作日/真实时薪更高👍或反而更低⚠)+ 翻译成自由(多赚够多买D天/多花E天)+ 陷阱(总额≠时薪、通勤是隐形无薪工时)。核心=**money=时间**:总额高≠更值。
    - 创业 = 四项(启动资金/每月固定成本/预计月营收/放弃月薪·机会成本);揭穿 每月净烧 · 烧钱跑道 M 月 · 比打工每月少攒 · **每月烧掉 N 天自由** + 陷阱(营收多半高估/机会成本别忘/跑道比想的短)。
  - `Check.svelte`:入口卡 + 智能默认(`dailyNetBurn`、`vm.netWorth`、`avgMonthlyIncome`=近期非被动月均收入 传入,预填 现在月薪/放弃月薪)。**净值/备份/红线不动**。入口做成**金色 ⚡ 胶囊按钮**「⚡ 决策模拟 · 跳槽 / 创业 →」(`.sim-btn`),与仪表盘/资产的「⚡ 模拟一笔」三处同风格统一。
  - 真机验证:跳槽 现1万/8h/1h双休 vs 新1.3万/10h/2h单休 → 真实时薪 ¥56→¥45(反而更低⚠)、年多搭1,296小时(≈162工作日)、多赚≈31月自由/多花54天;创业 启动5万/固定2万/营收8千/放弃1.5万 → 每月净烧¥13,128·烧钱跑道不到1月(净值撑不起)·比打工少攒¥27,000·每月烧掉349天自由。`svelte-check` 0 error、单测 7/7。
- ✅ 模拟一笔 升级为「投资 / 月供」双模式(vc72/v2.49):资产页按钮改「⚡ 模拟一笔 · 看清金融陷阱」→ Sheet 顶部分段「投资|月供」。纯本地科普,一正(投资收益没宣传的香)一反(月供成本比宣传的狠)。**全本地零网络零依赖零 AI**。
  - 计算 `src/lib/sim-finance.ts`(取代 sim-invest.ts,纯函数 + 单测 `sim-finance.test.ts` 7/7):投资 realizedGain(单利);月供 `equalInstallment`(等额本息)、`equalPrincipal`(等额本金,含首月/末月/总利息 r·P·(n+1)/2)、`installmentFee`(分期费率,月供=P/n+P·f + **真实年化 IRR 二分**)、`lostFreedomDays`(总利息÷日均净烧)。
  - `components/SimSheet.svelte`(取代 InvestSimSheet,渐进展示保极简):
    - 投资块 = 原极简内容(本金/年化/持有→实得+自由+陷阱)。
    - 月供块:二级分段「年利率|分期费率·每月」;年利率下三级「等额本息|等额本金」+「用 LPR+加点算」勾选(LPR 默认3.95+加点bp→合成年利率)。揭穿:月供(等额本金显首月→末月递减)· 总利息/手续费 · 总还款 · (分期)真实年化≈X%(约宣传×2)/(年利率)换另一种还款方式的总利息对比 · **翻译成自由「总利息=少自由 N 年」** · 陷阱三行(月供≠总成本 / 费率≠年化 或 LPR会浮动 / 借越久利息越多)。
  - `Assets.svelte`:按钮文案 + import 改 SimSheet。**净值/备份/freedom-math/红线不动**。
  - 真机验证:投资仍正常;房贷100万/30年/4.9% 等额本息 月供¥5,307·总利息¥910,616·**少自由66.3年**,切等额本金 首月¥6,861→末月¥2,789·总利息¥737,042(对比省¥173,575);分期1万/12期0.6% 真实年化~13%(单测);分期100万/360月0.6% 真实年化10.0%(约宣传1.4倍)。`svelte-check` 0 error、单测 7/7。
- ✅ 模拟一笔投资 · 看清「年化收益率」陷阱(vc71/v2.48):资产页新增「⚡ 模拟一笔投资」按钮(金色,放被动收入与调拨之间)→ Sheet。纯本地科普,专拆机构最爱用来吸引人的「年化收益率」。**只算实得、不画大饼、无图、零网络零依赖零 AI**。
  - 计算 `src/lib/sim-invest.ts`(纯函数):`holdYears(值,月/年)`、`realizedGain(本金,年化%,年数)=本金×年化×年数`(**单利、税费前的诚实口径**,刻意不复利)、`realizedPct`、`extraFreedomDays(实得,日均净烧)`(净烧≤0→∞)。
  - `components/InvestSimSheet.svelte`(**极简版**,一屏放下、去掉「7日年化」选框与长段落):输入 本金/宣传年化%/持有(月·年);揭穿卡 = 「销售话术 年化X% · 你实得」→ 大数 `+¥X` →「持有 T·约本金 Y%(单利·税费前)」→「≈ 多自由 N 月」(<1天显「还不够多买1天」、∞态特殊);下方三行短陷阱 年化≠到手/≠承诺/≠净收益。
  - `Assets.svelte`:`dailyNetBurn = max(0, vm.dailyBurn − vm.dailyPassive)` 传入;按钮 + 挂 `<InvestSimSheet>`。**净值/备份/freedom-math/红线全不动**。
  - 定位:客观中立,把"年化"翻译成"实得",非反投资;大白话科普口吻。真机验证:本金10万/年化8%,持有3年→实得+¥24,000(24%)、多自由20月;切3个月→仅+¥2,000(2%),鲜明拆穿"年化≠到手"。`svelte-check` 0 error。
  - **后续**:资产细分(理财/股票/基金/债券等本地分类+构成环形图)已设计待做(纯本地、叠加+未分类余额模型,不改净值/备份);多币种/实时汇率/实时行情 **明确不做**(破零服务器与隐私红线)。
- ✅ Sparkline 右端间隙 + 「今天」星光点根因修复(vc70 微调):此前折线**右端顶到面板边界、终点星光点被裁掉不可见**。**根因 = flex/grid 经典 `min-width:auto` 溢出**——svg 初始 `width` 撑大容器超出 hero 的 32px 内边距,被 `.hero{overflow:hidden}` 裁掉右段(含终点)。**修:给 `.hero-side`/`.spark-block`(Dashboard)+ `.spark`(Sparkline)加 `min-width:0`**,让容器回到真实内容宽(clientWidth 正确),`padL=12/padR=16` 的左右间隙才生效;svg 初值 `w` 由 600 降到 300 减少首帧过冲。终点=拟星光高亮点(halo twinkle + 白芯),现清晰落在折线右端 = 今天。排障手法:临时把终点圆填成亮红,一眼看出它被裁到可视区外 → 定位到溢出问题。
- ✅ 波动测试数据生成器:`tools/gen-wavy.mjs`(近 12 周交替大额收入/支出制造历史净值锯齿 → sparkline 明显起伏)→ 输出 `tools/freegrid-wavy.json`(gitignore 同 demo)→ `adb push /sdcard/Download/` → 设置·数据·导入·替换 载入。用于验证折线右端/星光点。
- ✅ Sparkline「今天」星光点 + 左右间隙(vc70 微调):`components/Sparkline.svelte` 原来 x 从 0 到 w(两端贴边),改为左右各留内边距(`padL=10`、`padR=22` 右侧多留给光晕);终点(=最右=今天)从小圆升级为**拟星光高亮点**(外晕 twinkle 脉冲 + 实心 + 白色星芯,r 8.5/4.6/3/1.3),一眼看出右端是今天。数据顺序:`freedomDaysHistory` 从 `i=最大`(12周前)递减到 `i=0`(今天)push,故 `history[0]`=最老、末尾=今天 → 折线**左=最老、右=今天**。
- ✅ 求生模式(净值见底的第二套风格)+ AI 联动(vc70/v2.47):把"自由天数=0/净值≤0"的见底态做成一整套**求生**语言与视觉,并让 AI 解读跟着变调。
  - **状态机**:`freedom-math.ts` 加 `financialState(netWorth, freedomDays)→ "free"|"normal"|"warning"|"survival"` + `WARN_DAYS=14` + 单测(freedom-math.test 现 18 项)。free=∞;survival=freedomDays===0(净值≤0);warning=0<天数<14;normal≥14。`derive.ts` 的 `DashboardVM` 加 `state` + `shortfall=max(0,-净值)`(注:`models.netWorth` 不 clamp,可负 → 拿真实缺口;`freedomDays` 内部 `max(0,·)` 兜底,故天数永不为负、最低 0)。
  - **整 App 变色**:`App.svelte` 加 `$effect` 按 `deriveDashboard(store).state` 设/清根属性 `data-mode="survival|warning"`(仿 `data-skin`)。`app.css` 加 `:root[data-mode="survival"]`(ember 暗红)/`[data-mode="warning"]`(amber 琥珀)覆写 `--sky` 系强调色 + `--mode-glow` 背景红晕(body::before 固定层),**放在 `data-skin` 规则之后**以压过皮肤;dark/light 双版本(light 变体用两属性选择器提特异性)。
  - **全局警戒条**:`App.svelte` 顶部 `position:fixed` 条(survival 暗红「求生模式·净值已见底,先回正」/ warning 琥珀「临界·自由跑道只剩 N 天」),`:root[data-mode] main` 加 padding-top 让位;跨所有 tab。
  - **仪表盘 hero 三态**(`Dashboard.svelte`):survival → kicker `SURVIVAL·求生模式`、「回正还需」+ 大数字 `¥469`(shortfall,ember;=0 边界显「见底」;**按字符长度自适应字号 `survivalFont` 104/76/54/42 + `white-space:nowrap`,防大额缺口如 ¥4,994,469 溢出屏幕**)、副标题「净值已见底—先回正,才谈自由」、caption「日均失血 ¥X·先止血/开源」;warning → 保留「N 天」但 kicker 加「·临界」、caption「⚠只够撑 N 天,注意开源」、仅变琥珀。∞/normal 不变。
  - **求生天空**(纯 CSS,零新增 DOM,`:global(:root[data-mode="survival"])` 前缀):`.stars` 停 twinkle、星点转暗红降透明(部分"熄灭")、`.meteor` **改成圆形余烬颗粒上飘**(不再是流星条 —— 原来把流星倒放会头尾方向反,现覆写 width/height/border-radius 成 3.5px 圆点 + ember-rise 上升,圆点无头尾问题)、hero `::after` 底部炉火辉光(辉光 fix:原中心 135% 太靠下几乎不可见 → 改 114% + flame 50%/22% 双色停,并给 `.hero-main/.hero-side` `z-index:1` 抬到辉光之上);**求生态隐藏 hero-side**(趋势 + "12周自由天数"sparkline)—— 求生时历史全 0、sparkline 是贴底一条平直线,既无意义又看着没居中,故 `{#if !isSurvival}` 整块不渲染。reduced-motion 关上飘。warning 天空不换,靠强调色自动转琥珀。
  - **大额金额防溢出**:hero 求生大数字按字符长度自适应 `survivalFont`(104/76/54/42)+ `white-space:nowrap`;资产页 `Assets.svelte` 加 `moneyFont(v,base,extra)` 给 净值(base56)/资产·现金(26)/负债(22)按长度降字号 + `.bucket{min-width:0;overflow:hidden}` + `nowrap`,大额(如 ¥-99,999,446 / −¥99,999,999)不再撑破面板。
  - **回正回血条**:survival 时 FREEDOM GRID 卡换成「回正进度」卡。**进度 = 债务覆盖率 `gross ÷ (gross + shortfall)`**(gross=资产+现金,分母=负债总额)。原用「1−shortfall÷(一个月净烧)」在负债很大时永远≈0、记收入/加资产都推不动;改覆盖率后 记收入(现金↑)/加资产/还债(负债↓)都即时按比例推进、不受负债绝对值影响,补满即净值回正脱离求生。卡头「回正进度·已覆盖 X%」+缺口,note 点明「记收入/加资产/还债都在推进回正」。真机验证:负债 999万(覆盖1%)→ 记收入+100万 → 覆盖 11%、缺口同步降。
  - **桌面小部件联动**:`widget.ts` payload 扩 survival/warning 分支(survival:kicker「求生模式」/number「¥469」/sub「净值见底·先回正」;warning:原数字/sub「⚠只够撑N天」)+ 传 `state`;`FreedomWidgetProvider.render` 读 state 用 `setTextColor` 给主数字上色(survival ember/warning amber/inf moss/其余白)。
  - **AI 解读联动**(`ai/prompts.ts`):`annualMessages` 加 `annualTone`(按该周期数字定档:结余<0 / 健康分<40 / freedomDays=0 → crisis;偏紧 → caution;否则 positive)分支系统提示——crisis=求生视角(诚实点破、止血/开源/债务优先、回正第一步、稳重支持不制造焦虑、收玩笑)、caution=温和预警、positive=原诙谐版;并加 `liveState`(由 `History` 传当前实时态)作背景让展望呼应现实;cacheKey 带 tone+liveState。`fqMessages` 轻触:真实储蓄率<0 时 advice 偏务实回正。`importMessages` 不动。
  - **真机验证**:造负债 6000(净值−469)→ survival 全套(暗红警戒条/hero ¥469/炉火辉光/回血条/全 App ember/资产页净值−469);负债 5150(净值 381≈10 天)→ warning 全套(琥珀条/kicker·临界/⚠10 天/保留网格/流星在);负债 0 → 回 normal 146 天无条。`svelte-check` 0 error;freedom-math 单测 18/18。红线不动(包名/键/无 SW)、动画只 transform/opacity+reduced-motion、仅新增根属性 data-mode(非存储)。
- ✅ 四项体验优化:编辑交易 / 紧凑日期 / 常用模板 / 备份提醒 + 科普(vc69/v2.46):
  - **编辑交易(核心闭环补齐)**:`store.svelte.ts` 加 `updateTransaction(id,kind,{amount,name,note,dateTime})` —— 按金额差修正现金(支出增→现金减、收入增→现金增)+ 改日期后 `recomputeFirstRecordDate()`。History 消费日历「当天明细」行改**可点**:`count===1` 直接编辑;`count>1`(同类合并组)先展开成单笔子列表(时间/金额,`groupItems`)再选一笔编辑或删(单笔删走 `askDeleteSingle` 复用二次确认)。**踩坑**:`date`(归档自然日,YMD)与 `createdAt`(含时刻,ISO)经序列化会分叉(demo/时区)→ 编辑初值 dateTime 必须用 **date 的年月日 + createdAt 的时刻** 拼(`openEdit`),否则保存会把这笔悄悄挪到别的一天。真机验证:改 生活费 1600→2000 当天汇总即时变、仍归 7 月 1 日不跳日;改回 1600 复原。
  - **共享 TxSheet(去重)**:新 `components/TxSheet.svelte` —— 金额 + CatPicker + 备注 + DateField + 提交,`props kind/mode:"add"|"edit"/initial/onSubmit`。**记支出 / 记收入 / 编辑 三处共用一份**;Dashboard 删掉两套内联记账 Sheet + 相关 state(expenseOptions/incFrequent/submit* 等),onSubmit 回调里 addExpense/addIncome+toast;`open` 关→开边沿 `loadInitial`(mode=edit 载初值、add 重置)。`.fg-*` 表单类是 app.css 全局。
  - **紧凑日期 + 滚轮到分钟(用户诉求)**:先前(vc69 初)`DateField.svelte` 用快捷 chip + 折叠月历,后按用户"时间选择别用日历表、要滚动选到分、还要显示星期"改为 **`WheelDateTime.svelte` 滚轮**;再按"移除今天/昨天/前天、只留滚动框"删快捷 chip;最终按"不用点开、直接显示滚轮"**删掉 `DateField` 包装**,TxSheet 的「日期」字段直接内联 `WheelDateTime`(记支出/记收入/编辑三处即时可滚)。滚轮 3 列(日期含星期 | 时 | 分)scroll-snap 竖滑、中间高亮band、精确到分钟;**可滚过去也可滚未来**(`daysBack/daysForward` 各 365,今天居中),默认当前时刻(add 态 `new Date()`)。**只显示 3 行**(`VISIBLE=3`,高 108px,减少上下占用)。实现要点:`ITEM_H=36`,程序设 scrollTop 用 `guard` 标志忽略回滚;滚动 110ms 防抖后 `commit()` 按 `round(scrollTop/ITEM_H)` 取索引重建 Date;`commit` 里先写 `lastSet` 再赋 value,防 `$effect` 重定位打断滑动。**格式(用户要"读作一个整体")**:日期列每行 `M月D日(星期X)` 全称括号、时/分两列紧贴成 `HH:MM`、顶部醒目 readout `7月6日(星期一)-08:18`。真机验证:3 行紧凑、默认当前时刻、向未来滚到 7月12日(星期日) readout/band 同步。(旧 `CalendarPicker.svelte` 仅历史保留、`DateField.svelte` 已删。)
  - **常用模板 + 重复上一笔**:`settings` 加 `txTemplates:{id,kind,name,amount?,note}[]` + `addTemplate/removeTemplate`(独立 key `freegrid-settings-v1`,不进财务备份)。TxSheet 顶部「常用」chip 行(仅 add 态):模板 chip 点选预填 + 「↻ 重复上一笔」(取该类型最近一笔)+ 表单有效时「＋ 存为常用」。Settings 顶层「分类管理」升级为「**分类 · 常用管理**」(`manageCount = 自定义 + 模板`,>0 才显示),子页加「常用记账模板」块(删除)。真机验证:存为常用→chip「饮食 ¥100」即现→管理页删除→行消失。
  - **备份提醒(只提醒,不做自动镜像)**:`settings` 加 `lastBackupAt`(ISO)+ `markBackupNow()`/`daysSinceBackup()`;`DataTools.download()` 导出成功即写。数据页顶部横幅「上次备份:N 天前 / 从未备份」;`needBackup`(有数据且从未/≥14 天)转警示样式 + 「数据只存本机,卸载/清缓存会丢,建议导出到设备外」。真机验证:显示「从未备份」警示条。
  - **可解释性/发现/无障碍(克制版)**:Dashboard hero 右上「?」→ `showExplain` 科普 Sheet(公式 `自由天数=净值÷(日均消费−日均被动)` + **当前真实数字**净值/日均/被动/=天数 + 三杠杆),真机验证 145=5531÷(71.4−33.3)✓。空态引导补一句"记着还能解锁 财商测试/年报/等级"。a11y:图标按钮补 `aria-label`(hero-help/单笔删)、backup 图标 `aria-hidden`、dd-main/dd-submain 为含文本按钮。
  - **红线守住**:仅新增 `settings` 字段(txTemplates/lastBackupAt,不进财务备份);无新增 localStorage key;包名/既有键不动;动画只碰 transform/opacity + `prefers-reduced-motion`。`svelte-check` 0 error / 5 既有 warning。构建 vc69/v2.46 → `install -r` 真机全流程验证通过。
- ✅ 可选 AI 助手 · BYOK · 多服务商(vc53/v2.30):
  - **定位调整(重要)**:原铁律「零网络/零 AI/数据不离设备」新增**唯一例外** —— AI 助手,**严格 opt-in、默认关闭**。应用本身仍无服务器、不收集数据;开启后用**用户自带密钥(BYOK)直连服务商**,每次仅在用户主动点击时联网、只发送该功能所需最小信息。设置底部 footer 动态:关→「纯本地·零网络·数据只存本机」,开→「本地优先·AI 由你开启并自带密钥」。
  - **架构(唯一联网边界)**:`src/lib/ai/` 新目录。`providers.ts`(服务商注册表:DeepSeek=current 已验证;通义千问/豆包 Doubao/腾讯混元=reserved 预留,均 OpenAI 兼容 `/chat/completions`)、`config.svelte.ts`(reactive 配置,**新 key `freegrid-ai-v1`**;per-provider `keys`/`models`、功能开关、每月上限+计数、结果缓存;**绝不进财务备份导出**)、`llm.ts`(通用 OpenAI 兼容客户端,**走 `CapacitorHttp.request()` 原生请求绕过 WebView CORS**,不全局劫持 fetch 以免影响 fq-share 的本地 data: URL;`chat`/`testConnection`/`fmtCost`)、`prompts.ts`(缓存友好:固定指令在前、用户数据在末)。
  - **三个功能**:① 财商结果·个性化解读(`FqTest` 结果卡背面「✨ AI 深度解读」→ summary/优势/盲点/建议 JSON;只发人格代号+四维倾向,记账聚合需额外开 `sendRealMetrics`);② 年报·致股东的信(`History` 年度解读 tab「✨ 让 AI 为你写一封」;只发该年聚合数字);③ 智能账单导入(`DataTools`「✨ AI 智能导入(粘贴账单)」→ `importMessages` JSON → 复用 `parseImport`+现有合并/替换弹窗;保留原「复制转换提示词」为无密钥兜底)。三者均:本地功能默认常在、AI 为增强层;结果按输入缓存(重开不重复调用,仅「重新生成」才再调);失败优雅回退。
  - **成本设计**:BYOK(开发者零成本、无后端、最安全,绝不内置共享密钥)、仅按需调用、便宜模型默认(deepseek-chat)、前缀缓存友好、`max_tokens` 上限、聚合非明细、结果本地缓存、可设每月调用上限、调用后展示 token/预估花费(读 `usage`)。真机成本≈分级。
  - **UI**:`AiSettings.svelte`(设置抽屉新增「AI 助手·实验」子页:总开关+隐私告知+服务商选择+密钥(掩码/显示/获取/清除)+模型+测试连接+功能开关+每月上限+用量)。
  - **红线守住**:仅新增 key `freegrid-ai-v1`;包名/其余 key/`freegrid-` 前缀不动;`INTERNET` 权限本就在 Manifest;仍 `vite build --mode android`(无 SW)。真机实测:设置显示「AI 助手·实验」、开关展开完整 UI、四家服务商(DeepSeek 当前 + 三家预留)、填 dummy key→测试连接→「密钥无效」(证明 CapacitorHttp 已打通到 DeepSeek、CORS 绕过成功)。
- ✅ 财商测试中途可退出+续答进度 & 默认深色主题(vc48/v2.25):
  - **中途退出 bug 修复**:原 `FqTest.svelte` 开场 `$effect(() => { if(!open) return; if(startFresh) beginQuiz(); ... })` 无「关→开」边沿守卫 → X/返回/遮罩点击后关不掉(reactive 反复重跑打断关闭)。改为 `let prevOpen; $effect(() => { if(open && !prevOpen){…决定阶段…} prevOpen=open })`,只在打开那一次决定阶段。真机实测:X/返回/遮罩都能正常关闭。
  - **续答进度**:新 key `freegrid-fq-progress-v1`(`fq-test.ts` 加 `saveFqProgress/loadFqProgress/clearFqProgress` + `FqProgress{questions,answers,current,date}`)。`FqTest` 加 `requestClose()`——中途退出(stage==="quiz")保存本次 50 题 + 已答 + current;`Sheet onClose={requestClose}`。开场:有结果→结果;有进度→`resumeQuiz`(同一套题续答);否则→`startFreshQuiz`。`finish()`/重测都 `clearFqProgress()`。`Check.svelte` 入口卡按 `loadFqProgress()` 显示「继续测试 →」,用 `openTest(false)`。真机实测:答 3 题→X 关→卡片变「继续测试」→续答回 4/50。
  - **默认深色主题**:`settings.svelte.ts` `defaults().theme` 由 `"system"` 改为 `"dark"`(新装/未显式选主题的用户默认深色;已显式选过主题的老用户不变)。
- ✅ 启动动画(vc39–46,已回退):曾做 chevron 飞入启动动画,按用户要求整体 `git restore` 回退到默认启动界面。经验:纯 web 启动层 + 原生纯深色启动窗;`@capacitor/splash-screen` 手动 hide 时机不稳、WebView 首帧 `prefers-color-scheme` 不稳,均已踩坑;验证启动用 `screenrecord + ffmpeg tile`。
- ✅ 小部件美化 + 快捷记账(vc38/v2.25):
  - **星空/流星背景**:小部件不能做动画(RemoteViews 无动画),改用**静态 PNG 背景**呼应 hero 夜空——`tools` 里用 GDI+(PowerShell System.Drawing)生成 `res/drawable-nodpi/widget_sky.png`(480×480 圆角方形:深蓝渐变 + 顶部微光 + 55 颗星点 + 3 道流星带亮头)。`freedom_widget.xml` 根 `FrameLayout` 背景换成它(API 31+ 系统还会自动圆角)。
  - **圆角**:PNG 烘焙圆角 + 系统自动圆角,视觉是圆角方形卡(2×2,近正方)。
  - **快捷记账按钮**:底部两枚低调 pill「− 支出」/「+ 收入」(`widget_btn_expense/income.xml` 半透明橙/蓝底+描边),复用**已有桌面快捷方式深链** `freegrid://record/expense|income` → `FreedomWidgetProvider` 给两个按钮各设 PendingIntent(`ACTION_VIEW`+setClass MainActivity,requestCode 1/2),中部区域点击=打开 App(requestCode 0)。
  - 真机实测:小部件显示星空+流星+FREEDOM DAYS/143 天/见底日 + 两枚快捷按钮;点「− 支出」直接打开记支出面板。`build-release` 内含 cap sync 带入原生。
- ✅ 桌面小部件「自由时间」+ demo 数据重导入(vc37/v2.25):
  - **方形桌面小部件(2×2)**:把首页 hero 的自由时间做成标准 Android App Widget。数据流:Web 侧 `src/lib/widget.ts` `updateFreedomWidget(vm)`(仅原生,所有格式化在 JS——`state/kicker/number/unit/sub` 快照)→ `App.svelte` `$effect`(随 store 变)调用 → Capacitor 插件 `FreedomWidgetPlugin`(`@CapacitorPlugin(name="FreedomWidget")`)写 `SharedPreferences("freegrid_widget")` + `AppWidgetManager.updateAppWidget` 刷新 → `FreedomWidgetProvider`(AppWidgetProvider)`onUpdate` 读 prefs 填 RemoteViews。**快照式**:记账/改资产/导入后 App 主动推,小部件跟着变;App 不开时数字不变。点击小部件 = 打开 App。
    - 原生新增:`res/layout/freedom_widget.xml`(深色圆角卡,呼应 hero:kicker + 大数字 sans-serif-thin + 单位 + 副标题)、`res/drawable/widget_bg.xml`、`res/xml/freedom_widget_info.xml`(2×2 `targetCellWidth/Height`、`updatePeriodMillis=0`)、`FreedomWidgetProvider.java`、`FreedomWidgetPlugin.java`、`MainActivity.java`(`registerPlugin(FreedomWidgetPlugin.class)`)、`AndroidManifest.xml`(`<receiver .FreedomWidgetProvider>` + appwidget meta)、`strings.xml`(`widget_name`=自由时间 / `widget_desc`,无 BOM)。
    - 状态:正常=kicker(FREEDOM DAYS/MONTHS/YEARS)+ 数字 + 单位 + 「约X月Y日见底」;∞=「∞ 你已财富自由」;空=「打开 App 记一笔」。
    - 真机(模拟器)实测:`dumpsys appwidget` 见 provider 注册;小部件面板底部「自由日记 · 自由时间 · 2×2」;拖到桌面渲染实时「FREEDOM DAYS / 143 天 / 约 11 月 21 日见底」(与 hero 一致);点击打开 App。
    - ⚠️ **负一屏**:标准 App Widget **进不了小米/华为的私有「负一屏」卡片**(需厂商私有 SDK);覆盖范围=主屏 + 系统小部件面板(绝大多数桌面可识别放置)。
    - 红线:仅新增 `SharedPreferences("freegrid_widget")`(与 localStorage 无关);包名/数据键/前缀不动。
  - **demo 数据重导入工具**:`tools/gen-demo-backup.mjs` 复刻 `src/lib/demo.ts` 的 `makeDemoData`(1805 笔支出 + 4 笔收入 + 股票分红被动源 ¥1000/月 + 净值 5531)→ 输出 app 备份格式 `tools/freegrid-demo.json`。流程:`node tools/gen-demo-backup.mjs` → `adb push` 到 `/sdcard/Download/` → App 设置→数据→导入→替换。**注**:app 备份只存净值 total,导入后资产/现金分桶合并进现金(net 不变,金/蓝格配色略变),可用「调拨」还原。
- ✅ 徽章墙折叠 + 完成测试即解锁 + 自由徽章守卫(vc36/v2.24):
  - **徽章墙可折叠**(`BadgeWall.svelte`):23 枚网格太占竖向空间 → **默认收起**,只显示 count 头(N/总 + 分享)+ 一行**紧凑图标条**(全 23 枚 mini,已解锁在前、可横滑总览)+ 「展开全部 N 枚 ▾」;展开=带分组的大网格 + 「收起 ▴」。Check 页一屏可见到设置入口,不再长滚。真机实测:收起态紧凑、展开/收起正常。
  - **「认识自己」改事件型**:原 `test:(a)=>a.fqDone`(数据型 → 老用户被静默 seed,重测看不到庆祝)→ 改 `event:"completed_fq"`,`FqTest.finish()` 调 `markBadgeEvent("completed_fq")`;`reconcileAchievements` 基线 seeding 时若 `input.fqDone` 则静默补上(兼容此前已测过的老用户)。这样**答完整套题当场解锁+弹庆祝**(与「年度回望」同一 markBadgeEvent→BadgeToast 路径)。
  - **自由徽章守卫**:空数据新用户 `freedomDays=∞`(无消费→永不见底)会让自由类 4 枚(180/365/1095/3650)在基线被误点亮。给这 4 枚 test 加 `&& a.txCount > 0`(需已有记录才算数)。真机实测:`pm clear` 全新空数据 → 0/23(不再误亮),记录后才逐步点亮。
  - `svelte-check` 0 error / 5 既有 warning。注:模拟器 `pm clear` 后 WebView 有几秒 input 丢事件的卡顿(强杀重启即恢复,非 app 问题)。
- ✅ 去滚动条 + 成就徽章墙 + 题库随机化 + 跨设备迁移(vc35/v2.24):
  - **① 去滚动条 + 流水悬浮**:`app.css` 全局 `::-webkit-scrollbar{display:none}` + `*{scrollbar-width:none}`(原 `width:10px` 经典滚动条占布局宽 → 居中内容被挤偏)。`App.svelte`(持 `main` 滚动)`onscroll`(rAF 节流):`tab==='history'` 且 `scrollTop>600` 浮右下 **「↑ 回顶」**(平滑回顶);`scrollTop>200` 用 `elementFromPoint(中点,132)` 探测视口顶部那行的 `data-month`(O(1),不遍历上百行)→ 顶部居中浮 **年月胶囊**,停 1s 淡出。History 行加 `data-month="YYYY 年 M 月"`。纯 transform/opacity。真机实测:上滑内容居中无灰条、胶囊「2026 年 6 月」、回顶按钮生效。
  - **② 成就徽章墙(替换 8 项自检)**:新 `achievements.ts`(23 枚里程碑:记账天数 7/30/100/365、笔数 100/1000、储蓄率 >0/30/50%、净值 1/10/50/100 万、自由 180/365/1095/3650 天、被动 有/50/100%、完成财商测试、记录资产、看过年报)+ `achievements.svelte.ts`(runes 模块状态,独立 key `freegrid-badges-v1` 存 `{id:解锁ISO时间}`;**粘性只增不减**;`reconcileAchievements` 对账;**首次静默设基线**不弹;庆祝队列)。`BadgeWall.svelte`(分组网格,解锁彩色 emoji+点亮时间,未解锁灰锁;点徽章→详情 sheet+分享)接入 `Check.svelte`(删掉旧 8 项清单+其样式)。
  - **解锁动画**:`BadgeToast.svelte` 全局浮层(挂 `App.svelte`),`App.svelte` 用 `$effect` 监听 store→`reconcileFromData`(记账/改资产/**导入**任何入口都即时对账);单枚=完整庆祝卡(图标 pop),多枚(含导入批量)=合并「🎉 解锁 N 枚」卡;点击进徽章墙;2.8s 自动消失;`prefers-reduced-motion` 只淡入。`FqTest.finish` 完测即时对账(「认识自己」即时点亮)。`History.openReport` → `markBadgeEvent('viewed_annual')`。真机实测:首次静默点亮 15/23、开年报弹「年度回望」单徽章庆祝、计数变 16/23。
  - **徽章分享**:`fq-share.ts` 的 `svgToPngDataUrl` 导出复用;新 `badge-share.ts` 出**单枚徽章卡**(medal + emoji + 名/说明/点亮时间)与**整面成就墙长图**(网格,高度随数量)→ `sharePngDataUrl`(原生写 Cache PNG + `Share.share({files})`)。emoji 用 `Noto Color Emoji` 字体栈,rasterize 后彩色正常。真机实测:整墙「已点亮 16/23」+ 单枚「初来乍到」都出图分享成功。
  - **③ 跨设备迁移(徽章+财商随备份)**:`models.ts` `BackupJSON` 加可选 `app_meta`(badges/fq)。`store.exportJSONString` 在**全部导出**时附 `app_meta`(徽章 `exportBadgeMeta` + `loadFqResult`);`toBackup`/本机 `freegrid-data-v1` 不加;**指定年份导出仍纯交易**。`DataTools.doImport` 导入后 `restoreBadgeMeta`(并集取更早时戳)+ 财商仅在本机无存档时补上。iOS/web 忽略未知字段 → 向后兼容,**AI 提示词 `buildImportPrompt` 一字不改**(AI 只产 `transactions`,不碰 `app_meta`)。
  - **④ 题库 120 + 每次随机抽 50**:`fq-test.ts` `QUESTIONS` 扩到 **120 题**(全 3 选项、行为学+生活化);新 `sampleQuestions(50)` 按维度分层随机(4 维各 ~12–13,保证 16 型分型)+ 洗牌;`scoreAnswers(answers, questions)`/`buildResult(answers, questions, metrics)` 加题目列表参(仅 `FqTest` 一处调用)。`FqTest.beginQuiz` 抽样存 state 全程用;测试固定 50。文案改"题库 120 · 每次随机 50"。真机实测:重测「1/50」、首题随机、答满 50 正确出型(龟速存钱罐 55)。
  - `svelte-check` 0 error / 5 既有 warning。**红线不破**:仅新增 `freegrid-badges-v1` 键 + 备份可选 `app_meta` 字段(向后兼容);包名/其余 key/`freegrid-` 前缀不动。
- ✅ 分享人格卡取消不再弹文字(vc34/v2.23):`FqTest.share()` 原逻辑把 `sharePersonalityCard` 整体包在一个 try,用户在系统分享面板**取消**时 `Share.share` 会 reject → 被当成"出图失败" → 又弹了一次纯文字分享。修复:拆成两步——先 `renderPersonalityPng`(仅这步失败才回退文字),再 `sharePngDataUrl`(分享阶段的取消/失败**单独 catch 静默**,不做文字兜底)。`fq-share.ts` 相应拆出 `sharePngDataUrl(dataUrl, caption)`(不含兜底)替代原 `sharePersonalityCard`。真机实测:分享→出图面板→取消→直接回人格卡,不再二次弹文字。
- ✅ 四项体验修复(vc33/v2.22):
  - **饼图不再拦截纵向滚动 + 双向连线**(`DonutChart.svelte`,流水概览卡 + 年报 sheet 共用即全覆盖):原 `touch-action:none`+`onpointerdown` 立刻 `preventDefault` → 手指一碰就卡住滚动。改 `pan-y` + **意图判定**(按下起 180ms 长按计时器,触发前纵向/横向移动 >10px 判为滚动、取消并放行原生滚;计时到才捕获指针、显示读数+连线,之后 move 才 scrub)。**双向**:图例每个 `<li>` 加同款长按处理 → 按住图例行 → 高亮对应扇区(加粗+其余变暗)+ 中心读数切换 + 画同一条折线(`computeLeader` 本就是扇区↔图例,反向天然成立);桌面端 hover 图例即预览。真机实测:饼图上快速上滑正常滚动到流水列表;长按图例「车贷」→ 扇区高亮+反向折线+中心显示车贷金额。
  - **仪表盘 stats 纵向堆叠**(`Dashboard.svelte`):`.stats` 由 `grid-template-columns:repeat(3,1fr)` → `flex column`,DAILY/PASSIVE/TRACK 三张 vault-card 全宽竖排。**顺带修了既有 CSS 括号错乱**:`@media(max-width:720px)` 从 hero 一直没闭合,把 vc31 的 `.dblock`/布局编辑全套样式误关进 <720px 媒体查询(手机 <720 所以能用、桌面失效)→ 重新理顺:媒体查询只留 hero/actions/hero-number,dblock 系列提到全局。
  - **资产说明补负债**(`Assets.svelte`):标题「净值 · 资产 · 现金」→「净值 · 资产 · 现金 · 负债」;正文润色(资产=暂时不动的钱、现金=随时能花、负债=欠的钱会拉低净值/缩短自由天数)。
  - **分享人格=卡片截图**(新 `fq-share.ts` + `FqTest.svelte`):原来只分享文字。新 `fq-share.ts` 零依赖生成海报——`mix()` 用 JS 实现 `color-mix(in srgb,…)`(预乘 alpha,含 transparent),把 `FqEmblem` 的 16 变体几何**内联着色**输出 SVG(隔离图像里也不变黑),`posterSVG` 拼 1080×1350 海报(家族色底+小精灵+型名+chips+tagline+财商分),`svgToPngDataUrl` 经 `Image(data:svg)`→`canvas.toDataURL` 转 PNG。`sharePersonalityCard`:原生写 Cache PNG(`Filesystem` base64)+`Share.share({files:[uri]})`;web 走 `navigator.share({files})` 或下载。`share()` 首选出图、失败兜底文字。真机实测:分享面板显示「Sharing image」+ 卡片缩略图(青蓝龟壳精灵着色正确 + 财商分 56 + tagline)。
  - **导出可选年份**(`DataTools.svelte` + `store.exportJSONStringForYear`):导出区顶部加「导出范围」chip(全部 + `availableYears()` 各年,横滑)。CSV 按 `getFullYear()` 过滤,文件名 `freegrid-2025.csv`;JSON 全部=整包(含资产/被动),**指定年份=仅该年流水**(`passive_sources:[]`、assets 置最小、first_record_date=该年最早),文件名 `freegrid-backup-2025.json`,提示回导建议「合并」。真机实测:选 2025 → 导出 → 分享面板显示 `freegrid-backup-2025.json`。
  - `svelte-check` 0 error / 5 既有 warning。
- ✅ 财商测试全 3 选项 + 生活化行为学题(vc32/v2.21):`fq-test.ts` 的 `QUESTIONS` 由原 50 题(多数 2 选项)重写为 **51 题、每题 3 选项**。计分模型不变(每选项映射 `axis/pole/fq`,fq 上限 2,`scoreAnswers` 原样兼容任意选项数)——第 3 项多为"中间/看情况"档。
  - **四维配额**:收入 11 / 风险 12 / 时间 14 / 决策 14(保证 16 型分型)。
  - **新增 13 道行为学题**(措辞刻意生活化、不学术):现时偏好(现在500 vs 一个月600)、沉没成本(烂片走不走)、锚定(原价划掉的打折)、心理账户(红包/中奖怎么花)、框架效应(每天一杯奶茶钱的分期)、相对性(为省5块跑远路)、办卡双曲贴现(年卡vs月卡)、凑单免运费、购物车冷静期、从众追高、泡沫警惕、高息陷阱、攀比换手机。分散挂在 决策/时间/风险 三维,强化对应极。
  - **文案**:intro 用动态 `{total}`(显示"51 道生活小题");`Check.svelte` 入口卡"51 题";文件头注释同步。
  - 真机实测:入口→结果卡→翻面→重新测试→答题界面每题 **3 选项 + 高亮 + 上一题**、自动翻页、行为学题(现时偏好 25/51)正常渲染、答满 51 题正确算出新型(龟速存钱罐·省稳远感、家族色青蓝、真实记账并入 -3 分)。`svelte-check` 0 错误。
- ✅ 仪表盘布局编辑 + 预设(vc31/v2.20):hero(FREEDOM MONTHS)**钉住不可动**;下方三块 `grid`(FREEDOM GRID)/`stats`(DAILY·PASSIVE·TRACK 行)/`actions`(记账按钮)**可重排**。
  - **进编辑态**:长按任一可排卡片(grid/stats,550ms,滚动/移动取消)**或**底部「⇅ 调整布局」按钮。编辑态:卡片虚线框+轻微 wiggle、右上 ↑↓ 手柄、顶部工具栏(预设 chip + 完成)、卡片内容 `pointer-events:none` 防误触。
  - **预设**:默认(grid/stats/actions)/ 数据优先(stats/grid/actions)/ 记账优先(actions/grid/stats),一键套用并高亮当前匹配项。
  - **持久化**:`settings.dashboardOrder[]`(`freegrid-settings-v1`);`Dashboard.svelte` 按 `normalizeOrder`(补缺/去重/丢未知)后的 order `{#each}` 渲染三块。真机实测:长按/按钮进编辑、↑↓ 重排、预设切换、完成退出、冷重启顺序保留、`prefers-reduced-motion` 关 wiggle。`svelte-check` 0 错误。
- ✅ 资产加「负债」(vc30/v2.19,单一负债总额):`净值 = 资产 + 现金 − 负债`。
  - `models.ts`:`UserAssets` 加 `liabilities`;`netWorth(a)` 减去 `liabilities`(参数改宽松对象、向后兼容);`BackupAssetsJSON` 加 `liabilities?`。
  - `store.svelte.ts`:store.assets 初始化 + applyEmpty 加 `liabilities:0`;`toBackup`/`fromBackup` 往返(`liabilities: x||undefined` / `?? 0`,经 `freegrid-data-v1` 主数据持久化,无需动 buckets);`updateBucket` 加 `"liabilities"` 分支。`derive.ts` 暴露 `vm.liabilities`。
  - `freedom-math.ts`:`gridState` 加 `liabilities` 参(总格数按 `net=gross−负债` 算,金/蓝配色仍按 资产/现金 gross 比例)→ **FREEDOM GRID 也扣负债、与顶部一致**。`freedomDays` 早已 `Math.max(0,净值)`,净值变负归 0。
  - `Assets.svelte`:双桶下加**全宽负债桶**(红 flame 图标 + 负值红字 `−¥x` + 铅笔)+ 编辑负债 Sheet(镜像编辑现金)+ 说明改「净值=资产+现金−负债」。年报净值(`netWorth`)也自动含负债。
  - 真机实测:负债 5 万 → 净值 22 万→17 万、自由 30→23 月、格子 30→23、`svelte-check` 0 错、freedom-math 单测 14/14。
- ✅ 去点击蓝框 + 星空动效(vc29/v2.18):
  - **点击淡蓝框**(WebView 触摸高亮,看着像调试框):`src/app.css` 全局 `* { -webkit-tap-highlight-color: transparent }` + `button/a/[role=button]` 触摸时 `:focus:not(:focus-visible){outline:none}`(**保留键盘 `:focus-visible` 焦点环**,不伤无障碍)+ 可点元素 `user-select:none`+`-webkit-touch-callout:none`(输入框不受影响)+ `:active{opacity:.72}` 轻按下反馈(去掉高亮后仍跟手)。
  - **FREEDOM MONTHS 星空**(原来只原地闪烁、单调):`Dashboard.svelte` 的 `.stars` 层加**缓慢视差漂移**(`star-drift` 46s alternate,透明层漂移无边缝)+ twinkle 改**透明度+微缩放呼吸** + `:nth-child(4n)` 一批**更亮脉冲亮星**(`twinkle-bright` 到 opacity1/scale1.45)。纯 transform/opacity,`prefers-reduced-motion` 关漂移与动画。流星层不变。
- ✅ 设置入口置底(vc28/v2.17):`Check.svelte` 把「设置」入口卡从财商卡与自检清单之间挪到**自检清单之后**(低频工具置尾,内容先行)。
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
