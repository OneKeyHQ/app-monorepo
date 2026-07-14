# Native Home UI Continuation Handoff Prompt

你正在继续维护 OneKey `app-monorepo` 的原生首页。这个文档最初用于 Windows/Android 交接；2026-07-14 的 iOS 真机复测又发现了分页、下拉刷新和业务语义问题，因此现在同时记录 Android UI 对齐要求与 iOS/shared 遗留问题。

如果当前环境是 Windows，只处理并验证 Android 能覆盖的部分，不要宣称 iOS 问题已经通过。如果当前环境是 macOS，先在 iOS 模拟器复现本文新增的 5 个遗留问题，再修改 iOS；涉及公共 schema 或 JS action 的修改必须回归 Android。

## 仓库与分支

- 仓库：`OneKeyHQ/app-monorepo`
- 分支：`codex/native-home-container`
- 原生首页最新基准 commit：`3d15d3efe5317adb57dc5bc526833ff1d6f7e856`
- Base branch 是 `x`，但本次不要切换、合并或 rebase `x`。

开始前执行：

```powershell
git fetch origin
git switch codex/native-home-container
git pull --ff-only
git merge-base --is-ancestor 3d15d3efe5317adb57dc5bc526833ff1d6f7e856 HEAD
```

最后一条命令必须成功。

## 2026-07-14 最新复测结论

复测基线为 `3d15d3efe5`，本地分支与 `origin/codex/native-home-container` 一致。问题来自 iOS 真机上的 split release 包（`main` 与 `bg` 两个 bundle）；这些截图证明 iOS 视觉已接近目标，但不能再把“iOS 已经完成”作为前提。

下面先保留当时的问题、现有代码证据、修复约束和验收标准。其后的“2026-07-14 macOS 实施进展”记录了基于这些结论产生的本地未提交实现；继续工作时必须先核对当前 diff 和实际运行结果，不允许只凭截图调固定像素。

新增问题优先级：

1. **P0：横向切页时出现两个页面内容错位、半页空白和行动画。**
2. **P0：从共享 Header/Slot 区开始下拉时，手势中途失去阻尼，松手直接跳到顶部。**
3. **P1：Show more / View more 的业务语义被错误合并。**
4. **P1：More 使用了临时 Dialog，没有复用原版 Wallet action menu。**
5. **P2：iOS Tab 间距与 Android/原版不一致。**

### 问题 1：Tab 间距

当前 iOS `HomeContainerTabsView` 使用：

- `UIStackView.spacing = 12`
- 根据 `tab.title.count` 将按钮宽度硬编码为 `44` 或 `72`
- accessory 宽 `36`，右侧间距 `12`

当前 Android `HomeTabsView` 使用的是更接近目标的布局：

- 左右内容 padding 为 `16dp`
- Tab 宽度由文字实际测量决定，不按字符数量分档
- 每个 Tab 后保留 `24dp` 间距
- 给右侧 accessory 保留 `52dp`，accessory 本身宽 `44dp`

修复要求：

- iOS 以 Android 的 intrinsic-width 规则为参考，删除 `title.count > 3 ? 72 : 44`。
- 不能按中文/英文字符数量猜宽度；必须兼容本地化、动态字体和 `fontScale`。
- 五个 Tab 可横向滚动，但默认设备宽度下不能像当前截图一样间距忽大忽小或让 History 被异常截断。
- accessory 保持固定命中区域，不能挤压最后一个 Tab 的点击区域。

验收：至少覆盖中英文、默认字体和大一档系统字体；逐个点击五个 Tab，文字中心、点击区及 accessory 均无重叠。

### 问题 2：More 必须复用原版 ActionList 业务链路

当前 `NativeHomePage.native.tsx` 对 `home.header.more` 调用 `Dialog.show()`，只临时渲染“复制地址”和“管理 Token”两项。这不等价于原版。

原版调用链：

```text
WalletActions
  -> WalletActionMore
  -> RawActions.More
  -> ActionList.show({ renderItemsAsync })
```

相关源码：

- `packages/kit/src/views/Home/components/WalletActions/index.tsx`
- `packages/kit/src/views/Home/components/WalletActions/WalletActionMore.tsx`
- `packages/kit/src/views/Home/components/WalletActions/RawActions.tsx`
- `packages/kit/src/views/Home/components/WalletActions/useWalletActionConfig.ts`

`WalletActionMore` 会根据账户、网络、钱包类型、审核控制、Vault 设置、BTC fresh address、Coin Control、批量授权、奖励中心、开发者设置和 Bot Wallet 状态，异步生成 trading/tools/developer 分组；还会包裹正确的 AccountSelector 与 HomeTokenList context。

修复要求：

- 复用或抽取原版 `WalletActionMore` 的 `renderItemsAsync`/show 逻辑，再由原生 action 触发。
- 只把现有两项菜单换成 `ActionList.show()` 仍然不算通过。
- 不在 Native 复制业务可见性判断，不把完整 React 菜单渲染进每个列表行。
- 打开、关闭、分组、条件展示、导航、埋点和测试 ID 与原版保持一致。
- More 的 trigger 可继续是 Header JSX Slot；弹层本身由已有 React Native `ActionList` 展示即可，它不是滚动热路径。

验收：至少测试 All Networks、单网络、只读/外部账户、普通 HD 钱包；菜单项和原版首页一致，关闭任一 action 后不会残留遮罩或阻塞原生 Pager。

### 问题 3：Show more / View more 行为矩阵

不要再用一个“通用 Show more”含义覆盖所有 section。Native 只负责展示按钮和发出稳定 action ID，具体业务语义由 main JS runtime 执行。

| 位置 | 原版语义 | 当前原生问题 | 正确行为 |
| --- | --- | --- | --- |
| Spot Token 列表 | `TokenListView` 默认显示 6 项，Show more 原地取消 slice，随后可 Show less | `home.portfolio.manageTokens` 打开 Token 管理页 | 原地扩展/收起，保留当前滚动位置，通过精确 section patch 增删行 |
| Spot 内 DeFi / DeFi Tab | `DeFiOverviewGrid` / `DeFiListBlock` 切换 `isSliced`，Show more/less 原地增减 Protocol | `openDeFiOverview` 仅选择 DeFi Tab；在 DeFi Tab 内是无效动作 | 当前 section 原地扩展/收起；不得重建整个 HomeContainer |
| Market View more | `PopularTrading.handleViewMore()` 根据当前 category 跳 Perps category、Spot category 或 Watchlist | 仅粗粒度切到 Discovery | 复用 `navigateToMarketTab()` 和原版参数 |
| Earn View more | `EarnListView.handleViewMore()` 通过 `safePushToEarnRoute(..., EarnHome)`，Extension 还有 expand-tab 分支 | 仅切换顶层 Earn Tab | 复用原版 helper 和平台分支 |
| History | `TxHistoryContainer` 在 `onEndReached` 调用分页 `loadMore()` | 不能改造成 Show more 按钮或一次性全量列表 | 保留滚动到底分页、并发锁、cursor 与错误恢复语义 |

实现约束：

- 为 `expand/collapse/navigate/loadMore` 使用清晰且互不混淆的 action/state，不依赖按钮文案判断行为。
- 原地展开只改变目标 section；不重置 Tab、Header collapse offset、其他列表 offset 或刷新状态。
- 结构 patch 在横向 Pager 正在交互时必须遵守下面的分页一致性规则。

### 问题 4：横向 Pager 内容撕裂与奇怪动画

复现：在 Spot/Perps/DeFi/NFT/History 之间连续左右拖动，尤其在页面滚动深度不同或数据恰好刷新时，会同时看到两个页面不相干的列、左半页旧列表/右半页新列表、空白区域、图片和金额错位，以及 UITableView diff 动画。

当前 iOS 代码证据：

- `pager.panGestureRecognizer.isEnabled = false`，外层 `interactionPan` 手动改变 `pager.contentOffset.x`。
- `moveToTab()` 只在手势结束选中目标页时同步 collapse offset。
- 每个 Page 有独立 `UITableView` 和独立 diffable data source。
- `rebuildRows()` 在已有数据时始终 `animatingDifferences: true`，即使 Pager 正处于两页之间。
- 页面的数据、结构和 Slot frame 可能在横向拖动期间独立更新。

不要直接假定单一原因；先用日志/断点确认 transition state、page frame、content offset、snapshot revision 和 visible rows。但修复必须满足：

- Pager 建立明确的 `idle / dragging / settling` 状态；一次手势期间 page width、frame、selected index 和相邻页身份保持稳定。
- 手势开始、相邻页露出之前，就同步共享 Header 的 collapse 状态；完成/取消后再一次性提交 selected Tab。
- 横滑期间禁止 diffable 的结构动画。结构更新应排队并按 Tab 合并到最新 revision，或无动画应用；不能让 offscreen/adjacent page 在半屏可见时做插入删除动画。
- 价格等非结构更新仍应精确更新可见行，但不能触发行重排、整个 snapshot reload 或 HomeContainer 重建。
- 手势取消必须回到原页且完全恢复；完成后目标页保持自己的正文纵向位置策略，但共享 Header/Tab 只能有一份且状态一致。
- 禁止用关闭横向切页、把列表截图化、`reloadData()` 或 `notifyDataSetChanged()` 掩盖问题。

验收矩阵：

1. 五个 Tab 在顶部连续往返横滑 20 次。
2. 当前页 Header 半折叠、完全吸顶和正文深处各重复 10 次。
3. 横滑过程中触发价格 patch、section expand/collapse 和刷新完成。
4. 慢拖后取消、快速 flick 完成、到第一页/最后一页继续越界拖。
5. 全程录屏逐帧检查：不能出现跨页 cell、半页空白、行飞入飞出、旧图复用或 selected Tab 提前跳变。

### 问题 5：Header 区开始下拉时手势中断

列表正文区域使用 `UITableView + UIRefreshControl`，体验正常；共享 Header/Tab/JSX Slot 区域则由外层 `interactionPan` 模拟滚动：

- 开始时记录 `externalPanStartOffset`。
- 下拉时手工设置 `contentOffset = max(-120, proposedOffset * 0.55)`。
- `-72` 作为刷新阈值，刷新时动画到 `-60`。
- 松手后用 `velocity * 0.18` 自行投影回弹。

这套手工阻尼与 `UIScrollView/UIRefreshControl` 的原生状态机不同，也是“拉到一半拉不动，松手直接重置顶部”的高风险来源。Header、Native View 与 JSX Slot 之间的 hit-test/手势竞争还可能在触点跨区域后取消当前 owner。

修复目标不是调小几个常量，而是让从 Header 任意区域开始的垂直手势与从列表开始的手势使用同一个权威滚动状态和等价的原生物理过程：

- active page 的 Native scroll view 是唯一 `contentOffset`/refresh state owner。
- touch slop 后只决定一次方向与 owner；直到 `up/cancel` 前，手指跨过账户 Slot、金额、操作按钮、Banner、Tab 或列表边界都不能换 owner。
- 下拉阻尼、spinner progress、触发阈值、refresh inset、取消和刷新结束回弹必须与列表区域一致。
- 手势过程中禁止把 offset 突然写回 `0`，禁止重建 Header 或 active Page。
- Tap 仍然要触发 Slot 点击；只有超过 touch slop 的垂直拖动才取消点击。
- Banner 内横向拖动仍归 Banner；明显的纵向拖动必须无缝转给同一垂直 owner。

推荐先评估能否让 Header/Slot 的纵向 pan 直接参与 active table 的 scroll/refresh 状态机，而不是继续维护第二套固定 `0.55/-120/-72/-60` 物理模型。如果必须保留外层 recognizer，也必须以同一 refresh state machine 为核心并通过逐帧对比证明等价。

验收必须从以下起点分别下拉：账户选择器、网络选择器、金额、Header 空白、Send/Receive/Buy & Sell/More、Banner 卡片、Banner 空白、Tab 文字、Tab accessory、列表第一行。

每个起点都验证：

1. 小于阈值松手，平滑回到手势前状态，不跳到错误的 collapse offset。
2. 慢慢跨过阈值，spinner progress 与列表区域一致。
3. 达到阈值只触发一次 refresh。
4. refresh 完成后不遮住账户行、不向上弹一截、不重置非当前 Tab。
5. 斜向拖动和触点跨 Slot/Native 边界不中断。

## 2026-07-14 macOS 实施进展（本地未提交）

以下修改已经存在于当前工作区，但尚未提交或推送。后续接手者必须保留这些改动，先验证再继续调整；不要从 `3d15d3efe5` 重新实现一遍。

### 已实现

1. **Tab intrinsic spacing**
   - iOS 删除了按 `title.count` 固定为 `44/72` 的按钮宽度。
   - `UIStackView.spacing` 调整为 `24`，Tab 使用文本 intrinsic width，accessory 继续保留独立命中区。

2. **More 复用原版 ActionList**
   - `WalletActionMore.tsx` 抽出了共享的异步 items hook 和 `useShowWalletActionMore()`。
   - Native Home 的 `home.header.more` 直接调用原版 `ActionList.show()` 链路，没有在 Native 或 Native Home 复制菜单可见性判断。

3. **拆分 Show more / View more / load more 语义**
   - Spot Token、Spot 内 DeFi、DeFi Tab 分别维护独立的展开/收起状态和 action ID。
   - Market View more 复用 `navigateToMarketTab()`；Earn View more 复用 `safePushToEarnRoute(..., EarnHome)`。
   - History 复用 `useHistoryListLoadMore()` 的 cursor、并发锁和 appended page 状态；iOS `willDisplay` 与 Android `onBindViewHolder` 只在最后一个带 `.loadMore` section 的末行触发 JS action。
   - section 更新继续走现有精确 snapshot/patch；没有为这些动作重建整个 HomeContainer。

4. **iOS Pager transition state**
   - 增加 `idle / dragging / settling` 状态和 animation generation。
   - 手势开始时先同步相邻页的 shared collapse offset，落页后再提交 selected Tab。
   - 横滑期间不再播放 diffable row insertion/deletion 动画；snapshot 以无动画方式精确应用 changed rows。
   - settling 期间拒绝新的 container pan，layout 只在 idle 时强制对齐 pager offset。

5. **iOS Header-origin pull-to-refresh**
   - 账户行、金额、操作按钮、Banner 和 Tab 继续由同一个 active table offset 驱动整体位移。
   - 外层 vertical pan 改用与 `UIScrollView` rubber-band 公式一致的阻尼，不再使用固定 `max(-120, offset * 0.55)` 截断。
   - 移除了 refresh 结束后延迟强写 `contentOffset = 0` 的 settling workaround；`endRefreshing()` 只结束 `UIRefreshControl`，避免刷新完成后向上弹一截或遮住账户行。
   - container pan 可与子手势同时识别，但方向和 owner 仍只在一次手势开始时决定。

### 修改文件

- `packages/native-components/ios/HomeContainerView.swift`
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt`
- `packages/kit/src/views/Home/NativeHomePage.native.tsx`
- `packages/kit/src/views/Home/components/WalletActions/WalletActionMore.tsx`
- `packages/kit/src/views/Home/nativeHomeDataAdapters.ts`
- `packages/kit/src/views/Home/nativeHomeDataAdapters.test.ts`
- `packages/kit/src/views/Home/useNativeHomeHistoryData.ts`

### 已完成的构建与静态验证

- `xcrun swiftc -frontend -parse packages/native-components/ios/HomeContainerView.swift`：通过。
- iOS Debug `xcodebuild`：通过；设备为 iPhone 17 Pro Simulator，iOS 26.5，scheme `OneKeyWallet`。
- 使用同一 App bundle 覆盖安装到现有 simulator：钱包数据仍存在；禁止改成 uninstall/reinstall。
- Android Native module 使用 JDK 17 执行 `:onekeyhq_native-components:compileDebugKotlin`：通过。
- `nativeHomeDataAdapters.test.ts`：7/7 通过。
- 本轮 Home 相关 TypeScript 文件 targeted ESLint：通过。
- `git diff --check`：通过。
- `packages/kit` 全量 `tsc` 仍被工作区其他未提交文件中的 9 处既有错误阻塞；本轮 Home 目标文件没有 diagnostic。不得把这些无关文件混入 Native Home 提交。

### 已完成的运行时验证

- 覆盖安装后 Account #1、余额和 Token/DeFi/History 数据均保留并正常显示。
- More 已实际打开原版菜单，能看到 Trade、Copy address、Approvals、Bulk send、Sign & verify message 等异步条目。
- Spot、Perps、DeFi、History 均已通过 Tab 点击切换并落到正确的独立列表；History 能从 skeleton 完成首屏加载。
- 证据目录：`.tmp/native-home-validation/`；关键截图包括 `post-overlay-more-2.png`、`post-overlay-defi.png`、`post-overlay-perps.png`、`post-overlay-history-loaded.png`。

### 尚未宣称通过的动态验收

当前 `agent-device` 能可靠执行坐标点击，但 Native/Nitro 子树没有足够 accessibility 节点，自动化 horizontal pan 和 Header pan 没有稳定产生可判定的逐帧手势证据。`header-pull-after-fix.mp4` 已生成，但不能单独证明拖动中的阻尼和 spinner progress 正确。因此以下项目仍必须由人工在 simulator/真机录屏验收，不能因为静态代码、最终截图或“出现 spinner”而勾选通过：

1. 五个 Tab 顶部/半折叠/正文深处连续横滑、慢拖取消和快速 flick，确认无跨页 cell、空白和行动画。
2. 从账户、网络、金额、按钮、Banner、Tab、accessory 和列表第一行分别开始下拉，与列表区域逐帧比较阻尼、阈值、spinner progress 和刷新完成回弹。
3. 滚动到 History 末尾，确认只触发一次分页、追加下一页且不重置 Header/Tab/offset。
4. Spot Token 与两个 DeFi section 的 Show more/less；Market/Earn View more 的真实导航目的地。
5. 中英文与大一档动态字体下的 Tab intrinsic spacing 和 accessory 命中区。

### 运行时边界（本轮实现）

- **Runtime scope：** 展开状态、More trigger、History load-more action 和 Native Home UI 都在 main JS runtime；bg 只通过既有 service proxy 提供数据。
- **Native resource ownership：** Pager、refresh、list offset 和 transition state 都属于每个 HomeContainer Native View 实例；本轮没有新增跨实例 singleton。图片 cache 仍是进程级共享 Native 资源。
- **JS heap copies：** main/bg JS heap 彼此隔离；首页 section、adapter 和展开状态只在 main heap 反序列化和持有，没有复制到 bg。
- **Timing/order：** main 与 bg 独立初始化；More 异步 items 和历史分页可晚于页面出现返回，但返回时只 patch 目标 section，不假设 bg 已和 main 同步 ready。

## 核心目标

iOS 原生首页的主体结构已经成型，但存在上述 P0/P1 遗留问题。Android UI 继续以确认过的原版行为和逐项参考为基准；Tab 间距以当前 Android 规则为基准，More/Show more 以旧 React Native 首页业务实现为基准，下拉体验以列表正文区域的原生行为为基准。不要笼统地把任一平台当前截图当作完整 golden sample。

这不是把页面重新改回 React Native。页面主体、列表、滚动、吸顶、下拉刷新、横向手势和增量更新必须继续由 Native 持有。

## 开始方式

先阅读：

- 根目录 `AGENTS.md`
- `packages/native-components/README.md`
- `.skillshare/skills/1k-cross-platform/SKILL.md`
- `.skillshare/skills/1k-code-quality/SKILL.md`
- `.skillshare/skills/1k-performance/SKILL.md`
- `.skillshare/skills/1k-ui-verify/SKILL.md`

先构建并运行当前平台版本，分别截图 Spot、Perps、DeFi、NFT、History 五个 Tab，形成当前效果与本文逐项参考的差异清单。然后按优先级直接修复，不要只做静态代码分析。

推荐执行顺序：

1. 先修 Pager 内容撕裂，并建立明确的 transition state；否则后续结构 patch 都可能继续触发错位。
2. 再修 Header 区下拉，让列表与 Header 共用权威 refresh/scroll state。
3. 修正 More，直接复用原版 ActionList 业务链路。
4. 按行为矩阵拆分 Show more / View more；同时验证结构 patch 不破坏 Pager。
5. 最后调整 Tab intrinsic spacing 并做多语言/动态字体视觉回归。

每完成一步都要在模拟器录制慢拖、快滑和取消手势；不能等五项全部完成后才首次运行。

## 关键源码

### iOS 视觉实现与本轮重点修改位置

- `packages/native-components/ios/HomeContainerView.swift`
- `packages/native-components/ios/HomeContainerModels.swift`
- `packages/native-components/ios/HomeContainerImageLoader.swift`
- `packages/native-components/ios/HomeContainerSlotComponentView.mm`
- `packages/native-components/ios/HomeContainerSurfaceComponentView.mm`

### 需要重点修改的 Android 文件

- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerView.kt`
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerModels.kt`
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerImageLoader.kt`
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerSlotView.kt`
- `packages/native-components/android/src/main/java/com/margelo/nitro/onekeynativecomponents/HomeContainerSurfaceView.kt`

### JS 数据和 Slot 契约

- `packages/native-components/src/HomeContainer.native.tsx`
- `packages/native-components/src/HomeContainer.types.ts`
- `packages/native-components/src/HomeContainerController.ts`
- `packages/kit/src/views/Home/NativeHomePage.native.tsx`
- `packages/kit/src/views/Home/nativeHomeDataAdapters.ts`
- `packages/kit/src/views/Home/useNativeHome*.ts`

## 必须保留的架构决策

1. 所有原生页面组件统一注册在 `packages/native-components` 这一个 module 中，不再新增按页面划分的 Native module。

2. 源码保持当前扁平结构，不新增 `home-container` 等子 package。

3. `.native.tsx` 使用原生实现，`.tsx` 保持 Web 兼容。

4. 默认使用新原生首页，不通过编译变量开启。以后由开发模式开关切换。

5. 五个 Tab 必须共用一个 Header。禁止每个列表复制自己的 Header。

6. DeFi、NFT、Perps、Spot、History 全部包含，而且五个 Tab 各有独立列表样式，不能套用一个通用列表模板。

7. 保留横向 Banner 滚动、Tab 横向手势及页面切换。

8. Header 的账户选择器、网络选择器、金额、操作按钮、Tab 文案及右侧 accessory 使用现有 JSX Slot。不要重新添加 Native 复制按钮，也不要为缺失 Slot 增加 Native 降级 UI。

9. Slot 只负责受控视觉和语义点击区域。垂直滚动、横向滚动、Pager、吸顶和手势竞争仍由 Native 协调，不能恢复 JS 每帧滚动监听。

10. 数据更新必须使用 revision 和增量 patch。价格或单个 Tab 更新不能 reload 整个首页、重置其他列表或改变用户当前滚动位置。

11. 图片继续使用现有 Android Glide 加载器及共享缓存策略，不能为每一行创建独立无界缓存。

12. iOS 视觉稳定区域不要无关重构；但本文 2026-07-14 新增的 iOS Pager、Header 下拉、Tab 间距问题需要在 macOS 环境直接修复。公共契约变更必须保持旧 Native 二进制兼容并回归 Android。

## UI 对齐重点

### Header

- 账户选择器与网络选择器处于同一行。
- 账户行、金额、操作按钮、Banner 和 Tab 在下拉刷新时作为一个整体移动。
- 下拉刷新完成后必须精确回到顶部，不能向上弹一截，也不能遮住账户选择器。
- 金额、按钮、账户行、网络 Slot 的 frame、间距、圆角、字体、颜色和暗色模式对齐 iOS。
- 操作按钮数量根据实际 Slot 决定，不要用硬编码占位。
- Banner 保持横向滚动、关闭按钮点击和纵向滚动手势协调。
- Tab 吸顶时只能存在一份 Header/Tab，不能出现跳动或高度切换。

### 五个 Tab

- Spot：Token 标题、DeFi tokens 开关、Token 行、网络角标、涨跌颜色、Show more、Market、Earn、Upgrade、Support hub。
- Perps：`Perps · 金额`、Deposit 按钮、资产列标题、USDC 行、Hot Markets 和各自独立行样式。
- DeFi：`DeFi · 金额`、Protocol/Position collection 样式、Position 数量、金额、箭头、Show more、底部模块。
- NFT：必须是 Collection 样式，不是普通 Token 列表；包括 Collection 图片、名称、数量、网络角标和空状态。
- History：按日期分组，交易类型、应用或地址、双 Token 图标、状态角标、主副金额、过滤器和原版 Empty View。
- 每个 Tab 的标题、右侧组件、section header、row 高度、分隔线和底部间距都应独立对齐 iOS。

### 列表与底部内容

- 接回原版 Empty View，不要使用简单文字占位。
- Upgrade、Prime、Support hub、Quiz Challenge、OneKey Sifu、Support、Help Center/Trading Guide 等底部内容不能遗漏。
- Show more、View more、Deposit、过滤器、开关、列表项和 Banner 关闭按钮都必须可点击。
- 底部导航栏不能覆盖最后一行内容，应有正确 safe-area/content inset。

## Android 手势和性能

- 使用一个明确的 Native 手势协调器处理：
  - 垂直列表滚动
  - `ViewPager2` 横向翻页
  - Banner 横向滚动
  - 可点击 JSX Slot
  - 行点击
- 根据手势方向和 touch slop 判定归属，避免横向组件导致外层无法竖向滚动。
- Slot 点击不能因为外层 `RecyclerView`/`ViewPager2` 抢手势而失效。
- 不要通过 JS 测量 Header 高度或持续发送 scroll offset。
- `RecyclerView` 必须正确复用 `ViewHolder`；更新单行时使用精确 notify/patch，不能使用 `notifyDataSetChanged()` 刷新整个页面。
- `ViewPager2` 的 page root 必须是 `MATCH_PARENT × MATCH_PARENT`，避免页面高度和触摸区域异常。
- 快速刷新数据、切换 Tab、横向滑动 Banner、连续点击列表时不能出现明显卡顿或列表元素跟不上。
- 注意 Android density、fontScale、RTL、暗色模式和不同状态栏高度，不要使用只适配单一设备的绝对像素。

## 运行时边界

- **Runtime scope：** `HomeContainer`、Pager、Slot、ActionList trigger、Show more 状态都只属于 main UI JS runtime；bg runtime 不得实例化或持有 Native View。
- **Native resource ownership：** 每个 `HomeContainer` View 独立持有列表、scroll offset、refresh 和 pager state；图片 loader/cache 是进程级共享 Native 资源，不能把某个 View 的 transition state 放进共享 singleton。
- **JS heap copies：** main 与 bg 有独立 JS heap。首页 adapter、section 数据和 UI state 只在 main heap 中持有；不要假设 bg 中存在同一个 JS 对象，也不要通过全量序列化在两个 runtime 各复制一份 UI 列表。
- **Timing/order：** bg 与 main 独立初始化。More 的异步 action 配置、刷新和后台 service proxy 可能在 bg 尚未 ready 时返回较晚；必须保留 loading/error/cancel 处理，不能借此重建 HomeContainer 或重置手势状态。

## 构建与数据安全

严禁执行：

- `adb uninstall`
- `adb shell pm clear`
- Gradle uninstall task
- 删除应用数据目录
- 为解决签名或安装问题先卸载 App

Android 包名是：

```text
so.onekey.app.wallet
```

安装调试 APK 时只能使用保留数据的覆盖安装，例如：

```powershell
adb install -r <apk-path>
```

如果覆盖安装因为签名不一致失败，立即停止并报告，不得通过卸载解决。钱包数据必须保留。

iOS 模拟器或真机同样禁止使用会清空数据的 reinstall/uninstall 流程，包括 `simctl uninstall`、删除 App container、Erase All Content and Settings。Native 代码变更需要重新 build 并覆盖安装；仅刷新 Metro/JS bundle 不能证明 Swift/Kotlin 修复已生效。签名不一致时停止并报告。

## macOS / iOS 验证要求

- 用当前分支重新编译包含 `packages/native-components/ios` 的 App，并覆盖安装到现有模拟器或设备；不要误用 reinstall。
- 验证时记录 commit、构建配置、设备型号和 iOS 版本。只重启 JS bundle 不算 Native 修复验证。
- 优先使用 `agent-device` 的 accessibility/testID 定位；只有没有语义节点时才使用坐标，并在报告中说明。
- 对 Pager 和 Header 下拉必须提供录屏；静态截图看不出手势中断、回弹曲线和 diff 动画，不能作为单独通过证据。
- 如果改到公共 `HomeContainer.types.ts`/Nitro schema，必须再执行一次 Android Native module 编译；只通过 iOS 编译不算完成。

## Windows 验证命令

先验证 Native module：

```powershell
cd apps/mobile/android
.\gradlew.bat :onekeyhq_native-components:compileDebugKotlin
```

再执行完整 Android Debug 构建：

```powershell
.\gradlew.bat :app:assembleDebug
```

JS/TypeScript 与测试：

```powershell
yarn workspace @onekeyhq/native-components lint
yarn jest packages/native-components/src/HomeContainerController.test.ts packages/kit/src/views/Home/nativeHomeDataAdapters.test.ts --runInBand
```

提交前：

```powershell
yarn agent:check --profile commit
```

不要把工作区中与 Android `HomeContainer` 无关的 Desktop、Swap、Firmware、硬件钱包或其他 Perps 修改混入本次改动。

## 验收过程

必须在实际目标平台的模拟器或设备上验证，不能以“元素存在”作为通过标准。Android UI 工作使用 Android 模拟器/设备；2026-07-14 的 iOS 遗留问题必须使用 iOS 模拟器或真机。至少提供以下截图或录屏：

1. Spot 顶部完整 Header。
2. Spot Tab 吸顶后的状态。
3. 下拉未达到阈值、达到阈值、刷新中、刷新完成四个阶段。
4. Perps 完整页面。
5. DeFi Protocol 列表与底部内容。
6. NFT Collection 列表和 Empty View。
7. History 日期分组、过滤器和长列表滚动。
8. Banner 横向滚动后，立即纵向滚动外层页面。
9. 点击账户、网络、操作按钮、Banner、Tab accessory、列表行。
10. Light/Dark 两套主题。
11. 最后一行位于底部导航栏上方，没有被遮挡。
12. 五个 Tab 连续横滑、慢拖取消及数据更新中的逐帧录屏。
13. 从本文列出的每个 Header/Slot 起点下拉，与列表区域并排对比的录屏。
14. More 在多种账户/网络下与原版菜单项的对比。
15. Spot Token、DeFi、Market、Earn、History 五类 more/load-more 行为录屏。

使用以下命令或 Perfetto 检查滚动和切 Tab：

```powershell
adb shell dumpsys gfxinfo so.onekey.app.wallet
```

不允许为了视觉一致性重新引入 JS bridge 高频事件。

## 完成标准

- Android 五个 Tab 的视觉结构与逐项确认的参考基本一致；iOS 新增的五个遗留问题全部有独立验证证据。
- Header、Tab、列表、Empty View 和底部模块无缺失。
- 下拉刷新、吸顶、横向滑动、Slot 点击和行点击均正常；Pager 无内容撕裂，Header 下拉与列表下拉体验一致。
- 刷新后不跳动、不遮挡账户行、不重置非当前列表。
- 数据更新是精确 patch，不是全量 reload；横滑期间结构更新不会播放列表 diff 动画。
- More 复用原版 `WalletActionMore`/`ActionList` 逻辑，不保留两项临时 Dialog。
- 所有 Show more / View more / load more 都符合本文行为矩阵。
- 编译、测试和 commit gate 全部通过。
- 给出修改文件清单、每项根因与修复原因、验证设备/API Level 或 iOS 版本、截图/录屏路径、剩余差异和性能结果。
- 完成后先展示跨平台对比证据和验证报告，不要自动提交或推送，等待用户确认。
