# Native Home UI Continuation Handoff Prompt

你正在继续维护 OneKey `app-monorepo` 的原生首页。这个文档最初用于 Windows/Android 交接；2026-07-14 的 iOS 真机复测又发现了分页、下拉刷新和业务语义问题，因此现在同时记录 Android UI 对齐要求与 iOS/shared 遗留问题。

如果当前环境是 Windows，只处理并验证 Android 能覆盖的部分，不要宣称 iOS 问题已经通过。如果当前环境是 macOS，先在 iOS 模拟器复现本文新增的 5 个遗留问题，再修改 iOS；涉及公共 schema 或 JS action 的修改必须回归 Android。

## 仓库与分支

- 仓库：`OneKeyHQ/app-monorepo`
- 分支：`codex/native-home-container`
- 原生首页最新基准 commit：`c7a8d3c086`（`fix: restore native home banner interactions`）
- Base branch 是 `x`，但本次不要切换、合并或 rebase `x`。

开始前执行：

```powershell
git fetch origin
git switch codex/native-home-container
git pull --ff-only
git merge-base --is-ancestor c7a8d3c086 HEAD
```

最后一条命令必须成功。

## 2026-07-14 最新复测结论

第一轮复测基线为 `3d15d3efe5`；随后 `09ff3f0623` 已完成 Tab 间距、More、Show more/View more/History load more 语义，以及针对 Pager/下拉的第一轮稳定性修改。2026-07-14 第二轮慢拖复测确认：前三项已经改善，但 Pager 50% 位置和 Header-origin 下拉仍未通过。问题来自 iOS 真机/模拟器上的 split release 包（`main` 与 `bg` 两个 bundle）；这些截图证明 iOS 视觉已接近目标，但不能再把“iOS 已经完成”作为前提。

下面先保留当时的问题、现有代码证据、修复约束和验收标准。其后的“2026-07-14 macOS 实施进展”记录了 `09ff3f0623` 的实现与验证结果；“第二轮慢拖复测”会覆盖其中两项过时结论。继续工作时必须以第二轮结论为准，不允许只凭最终截图调固定像素。

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

## 2026-07-14 macOS 第一轮实施进展（已提交为 `09ff3f0623`）

以下修改已经提交为 `09ff3f0623`。后续接手者必须保留前三项已经验证的业务修复；Pager 和 Header-origin 下拉只是第一轮尝试，已经被后文第二轮慢拖复测证明仍不充分，不要从 `3d15d3efe5` 重做，也不要继续围绕旧常量做微调。

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

## 2026-07-14 第二轮慢拖复测：两个 P0 仍未解决

用户已确认 Tab 间距、More 和各类 Show more/View more 行为基本符合预期。下面两项仍是阻断项；本节结论覆盖第一轮实现中对 Pager 和 Header-origin pull-to-refresh 的乐观描述。

### P0-A：50% 横滑证明 Page Header 没有随所属 Page 移动

稳定复现方法：在任意相邻 Tab 之间慢拖到约 50% 并保持。此时可见左右两个列表正文各占半屏，但 Perps/DeFi 等 Page 专属 Header 仍以全屏宽度停在 Surface 上，随后出现半屏空白、错列或正文与 Header 属于不同页面的现象。

已确认的代码根因：

- `HomeContainer.native.tsx` 把 `content.header.<tabId>`、`content.state.<tabId>` 和 `content.footer.<tabId>.*` 渲染为 `HomeContainerSurface` 的 JSX 子节点。
- `HomeContainerSurfaceComponentView.mm::layoutManagedChildren()` 再根据 `slotFrameForKey` 把这些 Slot 绝对定位到 Surface 坐标系；它们不是真正的 Page/List row 子视图。
- `HomeContainerView.swift::slotFrame(forKey:)` 只给当前 `selectedTabId` 返回 content Header/State/Footer frame。横滑尚未 settle 时，Pager 的两个 Page 在移动，但 selected Tab 的 Slot 仍保持全宽旧位置。
- `pager.panGestureRecognizer.isEnabled = false`，外层 `interactionPan` 继续手工写 `pager.contentOffset.x`。这让 UIKit 原生 paging、Slot 布局和 selected state 形成三套不同节奏。

因此第一轮增加 `idle/dragging/settling` 和关闭 diff animation 只能减少行动画，不能修复视图层级错误。禁止继续用“横滑时隐藏 Header”“50% 时重算一个 overlay frame”或增加更多 selected/pending 条件掩盖问题。

用户确认的实现决策：**先保留 JSX Slot，并把 Page 专属 Slot 绑定到对应列表 Header/State/Footer row 的 native host；只有经过真机 profiling 证明 Slot 本身仍造成持续掉帧时，才评估把该小块原生化。禁止继续使用 Surface 绝对定位作为正式方案。**

目标结构：

1. 共享 Header 和 Tabs 保持唯一一份，位于横向 Pager 之外。
2. 把当前 `.contentHeader` / empty-state / footer 占位 cell 改成稳定的 native slot-host cell。`content.header.<tabId>`、`content.state.<tabId>` 和 `content.footer.<tabId>.*` 整个 `HomeContainerSlotComponentView` 挂入对应 host 的 `contentView`，成为该 Page 坐标系的真实后代，不能继续作为 Surface 顶层绝对 overlay。
3. 横向切页优先恢复 `UIScrollView` 自己的 `panGestureRecognizer` 和 `isPagingEnabled`，或改用 `UIPageViewController`；不要再用外层 recognizer 逐帧积分 translation/velocity 并手写 `contentOffset.x`。
4. 数据 patch 仍按 Page/section 精确更新；Pager dragging 时可以禁止结构动画，但不能暂停价格等非结构可见行更新，也不能 reload 整个容器。
5. Surface 继续作为 Fabric children 的逻辑 owner 和 slot registry，但不再是 page-scoped Slot 的视觉 layout owner。Header cell 出现时按 `slotKey` attach，离屏/复用时移入隐藏 parking host；Fabric unmount 仍从 registry 解绑。只移动整个 Slot ComponentView，不能拆走它内部的 React children。
6. attach/detach 只发生在 mount/unmount、`willDisplay/didEndDisplaying`、host 复用或结构 patch 时；严禁在 `scrollViewDidScroll`、Pager progress callback 或每帧 `layoutManagedChildren()` 中反复 `removeFromSuperview/addSubview`。
7. host 的 `layoutSubviews` 只把 Slot frame 设为 `bounds`。Slot 高度继续由 snapshot/native row metric 明确给出；动态高度需要显式 revision/patch，不能恢复 JS `onLayout` 每帧测量。
8. 相邻两个 Page 在横滑期间各自持有自己的 Header Slot，因此 25%/50%/75% 时由 Pager 自动移动整棵 Page hierarchy，不需要 JS 更新、不需要 bridge event，也不需要 Surface 重算 presentation frame。
9. Android 使用同一个公开 Slot 契约，在对应 RecyclerView ViewHolder 内提供 host/parking container；iOS/Android 可以分别实现 native host 生命周期，但不能让 `.native.tsx` 分叉业务数据和 slotKey 语义。

这个方案的预期性能优于当前绝对定位方案：每个 Page 只有少量 Header/State/Footer React 子树，列表正文仍由原生虚拟化；横滑热路径只是 UIKit/Android View hierarchy 的合成位移，不产生 React render、JS/native 往返或逐帧 Slot frame 计算。React Native 自身的 Fabric component 也通过 `mountChildComponentView` 把 React child 挂到内部 native container（例如 ScrollView、Modal 和 InputAccessory），因此自定义 container/host 是可行模式；实现时必须保持 mount/unmount 索引和 ownership 一致。

只有满足以下任一条件并有 Instruments/Perfetto 证据时才转原生 Header：

- Slot host 已经没有 per-frame reparent/layout，横滑仍由该 React 子树造成稳定的 frame-budget 超限或 main-thread hitch。
- Fabric 更新会在交互期间反复覆盖 host frame，无法通过 host lifecycle/`layoutSubviews` 安全约束。
- Slot 的交互或 accessibility 在真实 Page hierarchy 中无法保持正确，且不是 host 生命周期 bug。

不能因为单次 Debug build 掉帧、图片首次解码或网络数据 patch 就判定 Slot 性能不合格；必须使用同一数据、同一设备、Release/profile build 对比 native placeholder 基线。

Apple 的 `UIScrollView.isPagingEnabled` 会让滚动自然停在 bounds 的整数倍，`UIPageViewController` 也是系统提供的页面转场容器。这里应让 UIKit 成为横向位置和速度的唯一 owner：

- https://developer.apple.com/documentation/uikit/uiscrollview/ispagingenabled
- https://developer.apple.com/documentation/uikit/uipageviewcontroller

### P0-B：Header-origin 下拉仍是第二套手工物理

稳定复现方法：对账户行、网络选择器、金额、按钮、Banner 或 Tabs 使用与列表第一行完全相同的慢速下拉手势。列表起点的阻尼、spinner progress 和松手回弹自然；Header/Slot 起点仍可能中途失去位移、手指与内容脱节或松手直接复位。

已确认的代码根因：

- 每个 Page 的 `UITableView` 自带一个 `UIRefreshControl`，列表区域的 pan、负 offset、progress、触发和回弹都由 UIKit 管理。
- Surface 另挂一个 `interactionPan`。Header/Slot 起点会进入 `.vertical(page:)`，记录 `externalPanStartOffset`，再把手势 translation 手工换算成 active table 的 `contentOffset.y`。
- 第一轮虽然把固定 `0.55/-120` 换成近似 `UIScrollView` 的 rubber-band 公式，但手势识别、deceleration、bounce、refresh progress 和取消仍不是同一个 `UIScrollView/UIRefreshControl` 状态机，所以无法只靠公式做到逐帧等价。

目标结构采用标准的原生嵌套分页组合，而不是再调常量：

1. 增加一个共享 outer `UIScrollView`（也可以是 `UICollectionView`）作为唯一共享 Header、吸顶 Tabs、负 offset、bounce 和 refresh owner；账户行、金额、按钮、Banner 和 Tabs 都必须在它的 descendant hierarchy 中。
2. outer scroll 下方承载横向 Pager；每个 Page 内保留自己的 `UITableView/UICollectionView` 负责长列表虚拟化和正文纵向位置。
3. 只在 outer scroll 上挂一个 `UIRefreshControl`，并设置 `alwaysBounceVertical = true`。移除每页独立 refresh control，禁止自定义 spinner progress、触发阈值、refresh inset 或刷新结束回弹。
4. outer 与 active child list 的原生 pan recognizer 允许按规则 simultaneous recognition：outer 消费 Header collapse range 和所有顶部负 offset/bounce；只有 outer 到达 sticky threshold 后 child list 才消费正向正文滚动；child 回到顶部后继续下拉时重新由 outer 的原生 bounce/refresh 接管。
5. 协调器可以在 `scrollViewDidScroll` 中做 owner/state gate 和 offset clamp，但不得读取 translation 后自行计算阻尼、速度投影、deceleration 或回弹曲线。一次手势越过 touch slop 后 owner 不变，直到 ended/cancelled。
6. 横向 Banner/Pager 与纵向 outer scroll 通过 `UIGestureRecognizerDelegate` 做方向锁和 failure/simultaneous 规则；Tap Slot 仍可点击，明显纵向拖动不应因手指跨过 Slot 边界而取消。
7. Tabs 的吸顶使用 native supplementary header pinning 或 native layout，不通过 JS scroll event，也不增加 main/bg bridge 热路径。

Apple 官方行为依据：

- `UIRefreshControl` 可直接附着到 `UIScrollView`，由下拉原生展示进度并在完成时 `endRefreshing()`：https://developer.apple.com/documentation/uikit/uirefreshcontrol
- `alwaysBounceVertical` 让内容不足一屏时仍能使用原生纵向拖动/回弹：https://developer.apple.com/documentation/uikit/uiscrollview/alwaysbouncevertical
- 多个 recognizer 的先后与 simultaneous recognition 应通过 delegate 协调：https://developer.apple.com/documentation/uikit/coordinating-multiple-gesture-recognizers
- Collection View 的 section header 可以由系统 pin 到可视区域顶部：https://developer.apple.com/documentation/uikit/uicollectionviewflowlayout/sectionheaderspintovisiblebounds

### 可重复、可自动化的验收方式

不要再依赖“松手后的最终截图”。必须同时提供确定的中间态证据和完整手势曲线。

#### 横向 50% checkpoint

优先增加只在 `#if DEBUG` 可用的 native test seam，例如 `debugSetPagerProgress(from:to:progress:)`，把 Pager 固定在 `0.25/0.5/0.75`，不提交 selected Tab。它只允许设置测试位置，不能进入 release schema 或改变生产手势。

若不增加 seam，则用 XCUITest 的 `XCUICoordinate.press(...thenDragTo:withVelocity:thenHoldForDuration:)` 做慢拖并在终点 hold，同时由外部 `xcrun simctl io <udid> recordVideo` 录制，或在 hold 窗口内执行 `simctl io screenshot`。Apple 的该 API 支持指定 drag velocity 和终点 hold：

- https://developer.apple.com/documentation/xcuiautomation/xcuicoordinate/press%28forduration%3Athendragto%3Awithvelocity%3Athenholdforduration%3A%29

每个相邻组合双向验证 `25%/50%/75%`，并覆盖顶部、Header 半折叠、正文深处、慢拖取消、快速 flick、拖动中数据 patch。50% 截图的通过条件是：左右各自的 Page content Header、empty/footer Slot 和列表行严格一起移动；共享 Header/Tabs 保持唯一且固定；不存在任何全宽 page-scoped overlay。

DEBUG overlay/日志至少输出：`pagerProgress`、from/to index、pager presentation offset、两个 Page frame、page-scoped Slot 的 `superview` 与 frame。只有 Slot 的 superview 确实属于对应 Page host，才算结构通过。

#### 下拉手势曲线

对账户、网络、金额、四个按钮、Banner 内容/空白/关闭按钮、Tab 文案、accessory、列表第一行使用同一组起点到终点坐标、duration 和 velocity，分别录制：未达阈值、刚过阈值、refreshing、`endRefreshing()` 后静止四个阶段。

用 DEBUG `os_signpost` 或 overlay 同时记录 outer offset、active child offset、refresh state、gesture owner。通过条件：

- 相同输入下，从所有起点得到相同的 outer `contentOffset.y` 时间曲线和 spinner 填充距离。
- 同一手势只触发一次 refresh；Header、Tabs 和 active Page 不重建。
- 刷新完成精确回到刷新前合法位置，不遮住账户行，不跳到其他 collapse offset。
- Banner 横滑仍保持横向；斜向拖动只做一次方向判定，过程中不换 owner。
- Simulator 自动化通过后仍需真机慢拖复核，不能用 Simulator 的最终帧替代真机物理体验。

### 运行时和性能边界（第二轮方案）

- **Runtime scope：** 两个 P0 都只涉及 main UI runtime。bg runtime 继续独立提供数据，不参与手势、Pager、refresh 或 Slot frame 计算。
- **Native resource ownership：** outer scroll、Pager、active child list 和共享 `UIRefreshControl` 都属于单个 `HomeContainer` native instance，不新增进程级 singleton；图片 cache 仍是共享 native resource。
- **JS heap copies：** main/bg JS heap 隔离；页面数据只在各自 runtime 独立反序列化。新方案不得把 per-frame offset/progress 复制到 JS，也不得通过 main/bg bridge 同步手势状态。
- **Timing/order：** main 与 bg 独立初始化。数据晚到只允许精确 patch 对应 Page/section，不能假设 bg ready，也不能重建 native scroll hierarchy。
- **性能通过条件：** Instruments/Signpost 中横滑和下拉热路径没有 JS scroll callback、没有每帧 Surface Slot 全量 layout、没有 Page `reloadData()`；60/120 Hz 设备由 UIKit 原生 pan/deceleration 驱动。

## 2026-07-14 两个 P0 的第二轮实现（当前工作区，待提交）

当前 macOS 工作区已经按上面的目标结构完成第二轮实现。不要再恢复 `interactionPan`、Surface 绝对定位或每页独立 `UIRefreshControl`。

### P0-A 已完成的结构修复

1. `content.header.<tabId>`、`content.state.<tabId>`、`content.footer.<tabId>.*` 现在使用 `HomeContainerSlotHostCell`，Slot 整体挂入对应 Page 的 `UITableViewCell.contentView` 后代，不再以 Surface 坐标绝对定位。
2. `HomeContainerSurfaceComponentView` 只保留 Fabric logical ownership、slot registry 和隐藏 parking view；可见 host 出现时把整个 `HomeContainerSlotComponentView` reparent 到 host，离屏时回收到 parking view。
3. host registry 由 `willDisplay/didEndDisplaying` 维护，不再在 diffable update 过程中读取 `visibleCells`；这同时避免了 UIKit reentrancy assertion。
4. Slot host 给 Fabric paragraph 提供明确 accessibility ancestor boundary，避免 XCUITest 枚举 `UITableView` 时在 `RCTParagraphComponentView.isAccessibilityCoopted` 与 table accessibility label 之间递归栈溢出。
5. Pager 恢复 `UIScrollView.isPagingEnabled` 和自身原生 pan/deceleration；生产代码不再逐帧读取 translation、投影 velocity 或手写横向 offset。
6. 原生方向仲裁使用一个只决定纵/横轴的 `HomeContainerVerticalGateGestureRecognizer`：纵向时 Pager 失败并放行 outer/table；横向时 outer/table 等待 Pager。该 recognizer 不计算或写入任何 scroll offset，最终位移、惯性和停靠仍全部由 `UIScrollView` 持有。
7. 横向 Banner/section 仍优先使用自己的原生 scroll pan；到达边界并失败后才允许 Pager 接管。

DEBUG build 现在支持确定的中间态验证，不会进入 Release：

```bash
SIMCTL_CHILD_ONEKEY_HOME_DEBUG_PAGER_PROGRESS=0.5 \
  xcrun simctl launch --terminate-running-process \
  <simulator-udid> so.onekey.wallet
```

环境变量 `ONEKEY_HOME_DEBUG_PAGER_PROGRESS` 只允许 `(0, 1)`，固定当前 Page 到下一 Page 的 presentation progress，不提交 selected Tab，也不改变生产 schema。当前证据：

- `.tmp/native-home-p0-validation/pager-half-slot-bound.png`：Spot/Perps 各自 content Header 与各自列表位于同一半屏 Page hierarchy；共享 Header/Tabs 仍只有一份，没有全宽 page-scoped overlay 或半屏空白。
- `.tmp/native-home-p0-validation/history-after-five-tab-sequence.png`：Spot → Perps → DeFi → NFT → History 顺序切换后 History 页面完整、选中态正确，没有跨页残留。

注意：当前 `agent-device/XCTest` 的 coordinate drag 在该 Simulator/runtime 组合中会把整段位移合并为一次 `touchesMoved`。日志已证明 axis gate 和 Pager 都进入 began，Pager 的 `contentSize.width = 2010`、`bounds.width = 402`，但因为 began 之后没有下一帧 move，不能用这条自动化 drag 的最终帧判断真实手势是否滚动。临时 `[HOME-NATIVE]` 日志已经移除。最终仍需在模拟器鼠标慢拖和真机触摸上录制连续往返横滑；DEBUG 50% seam 只证明层级/布局，不替代真实物理验收。

### P0-B 已完成的结构修复

1. 新增唯一共享 `outerScrollView`，账户行、金额、操作按钮、Banner、Tabs 和 Pager 都是它的真实 descendant。
2. 只有 outer 持有一个 `UIRefreshControl`，并启用 `alwaysBounceVertical`；Page table 不再持有 refresh control，也关闭自己的 bounce/负 offset。
3. Header-origin 与 list-origin 纵向手势进入同一组 native recognizer：outer/table simultaneous，outer 负责顶部负 offset、bounce、spinner progress 和 refresh 完成回弹；child table 只负责 header collapse 后的正文正 offset。
4. 协调代码只做 collapse owner gate 和合法 offset clamp；已经删除旧的 rubber-band 常量、translation 积分、速度投影和自定义 refresh settling。
5. `completeRefresh()` 只按 request id 调用共享 `refreshControl.endRefreshing()`，不再延迟强写 `contentOffset = 0`，因此不会在刷新结束后额外向上弹一截。
6. 2026-07-14 补充修复 Banner-origin 下拉：禁止 outer/table 对横向 Banner 设置 `require(toFail:)`。outer/table 只接受纵向主速度，Banner 只接受横向主速度，并允许两类 recognizer 同时参与方向仲裁；只有 Page 内的横向 section 继续优先于 Pager。恢复 outer/table 等待 Banner 会导致触点从卡片起手时外层 pan 长时间停在 `.possible`，表现为红框区域无法下拉。
7. 2026-07-14 补充修复横向惯性期间的二次手势：旧的 `HomeContainerHorizontalScrollView.gestureRecognizerShouldBegin` 把 `velocity == .zero` 当作非横向并返回 `false`。`UIScrollView` 在惯性期间接收替换触摸时，可能先进入 tracking、再获得新 pan 的速度样本；因此该判断会同时拒绝同向加速和反向接管。`stopScrollingAndZooming()` 不是修复方向，它只会丢弃原生动量，且零速度 gate 仍会拒绝后续 pan。
8. Header 的 Actions、Banner 和共享 Tabs 现在使用不覆盖 `gestureRecognizerShouldBegin` 的原生横向 `UIScrollView`，完整保留 UIKit tracking/dragging/deceleration 状态机。只有 Page 内需要在边界把横向手势交给 Pager 的 section 使用 `HomeContainerPagerChildHorizontalScrollView`；该类在方向尚未产生有效样本时必须返回 `true`，不得把 undecided 当作失败。

这部分自动化仍受上面单次 `touchesMoved` 限制，必须在真机逐项复核账户、网络、金额、按钮、Banner、Tabs、accessory 和列表第一行起点。代码层通过条件已经具备：所有起点共享 outer 原生 pan/UIRefreshControl，不存在 Header 专用的第二套阻尼或 spinner 状态。Banner-origin 的自动化证据位于 `.tmp/native-home-p0-validation/banner-vertical-refresh.mov`；录屏中可以看到从 Banner 正文起手进入共享刷新状态，但真机仍需复核慢速斜向手势和横向 Banner 惯性。横向惯性验收必须覆盖：惯性未结束时再次同向快滑应立即继续并提高速度，反向快滑应在新手势开始后立即反向；等待旧惯性自然结束后才响应不算通过。

2026-07-14 构建验证：`OneKeyWallet` Debug simulator 完整 `xcodebuild` 退出码为 0。对最终 `OneKeyWallet.debug.dylib` 执行 `nm | swift-demangle` 后，`HomeContainerHorizontalScrollView` 只有 `touchesShouldCancel`，不存在 `gestureRecognizerShouldBegin`；`gestureRecognizerShouldBegin` 只存在于 `HomeContainerPagerChildHorizontalScrollView`。这证明 Banner 的最终产物已回到 UIKit 默认 pan delegate 路径，但不替代上述真机连续手势验收。

### 第二轮实现的运行时边界

- **Runtime scope：** 修改仅在 main UI runtime 执行。bg runtime 不创建 native view，也不参与 pan、Pager、Slot host 或 refresh state。
- **Native resource ownership：** outer、Pager、每页 table、Slot host/parking view、方向 gate 和共享 `UIRefreshControl` 都由单个 `HomeContainer` 实例持有；没有新增进程 singleton。图片 cache 仍是既有共享 native resource。
- **JS heap copies：** main/bg 仍各自反序列化自己的 JS 数据；横滑/下拉热路径没有把 offset、progress 或 velocity 复制到任一 JS heap。
- **Timing/order：** main/bg 独立初始化；bg 晚到的数据仍通过 revision/section patch 精确更新，不能假设 bg ready，也不会因 refresh 或横滑重建容器。

## 2026-07-14 Banner 关闭按钮视觉对齐（当前工作区，视觉已完成模拟器验证）

原版 JSX 实现在 `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.tsx`：

- 使用 `CrossedSmallOutline`，`IconButton size="small" variant="tertiary"`。
- 图标 viewport 为 `20 × 20pt`；SVG path 在该 viewport 内的实际可见 bounds 约为 `9.02 × 9.02pt`。
- 颜色来自 `$iconSubdued`（light/dark theme 的 neutral9），不是 `$textSubdued`（neutral11）。
- ButtonFrame 为 `28 × 28pt`：图标 `20pt` 加四边 `4pt` padding。
- 声明位置是 `top/right=$2`（8pt），small tertiary 同时应用 `-5pt` margin，因此 Native 对齐目标为距卡片右上 `3pt` 的按钮 frame。
- 额外 hit slop 为四边 `12pt`；视觉缩小不能缩小这个点击范围。

此前 iOS 使用 `xmark` SF Symbol `12pt/medium`、`$textSubdued` 和 `top/trailing=8pt`，因此 X 的可见尺寸偏大、颜色偏重，并且相对原版偏左偏下。当前修复改为按原版 SVG path 生成 `20pt` template image，新增可选 `subduedIconColor` theme 字段，并保持 Android/旧 JS schema 兼容；按钮 frame/hit slop 维持 `28pt/12pt`，只把视觉锚点对齐到 `3pt`。

验收条件：Light/Dark 下与 JSX 原版并排截图，X 的可见 bounds、颜色和中心位置一致；点击 X 的扩展区域只关闭 Banner，不能触发整卡导航；点击 X 外的卡片正文仍触发 Banner action。

当前验证结果：Swift parse、TypeScript type-aware oxlint、iOS Debug 完整 build、Android `:onekeyhq_native-components:compileDebugKotlin` 和 `HomeContainerController.test.ts`（7/7）均通过。新 `.app` 已覆盖安装到 iPhone 17 Pro Simulator（iOS 26.5），data container 安装前后保持 `23896KB`、394 个文件，没有卸载或清数据。`native-home-banner-dismiss` 的实际 frame 为 `28 × 28pt`、`hittable=true`；Light/Dark 截图分别位于 `.tmp/ui/native-home-banner-dismiss-aligned.png` 和 `.tmp/ui/native-home-banner-dismiss-aligned-dark.png`。关闭按钮的点击链路未改动，本轮没有实际关闭远端 Banner，以免把 `closedForever` 写入当前测试钱包；提交前仍应人工点一次可恢复的测试 Banner，确认关闭点击不冒泡到整卡 action。

## 2026-07-14 Header 横向区域的纵向 Gate

新增问题：手指从 Banner 卡片正文开始上下拖动时，Header 横向 `UIScrollView` 会先取得 pan，`isDirectionalLockEnabled` 只能在它取得手势后约束内容方向，不能把纵向手势所有权交给共享 outer scroll，因此页面不滚动且 Banner 可能执行横向吸附。

本轮采用原生 Gate，不恢复 Header 横向 scroll 的 velocity delegate，也不在 JS 或 Swift 中手算任何 offset、阻尼、惯性或回弹：

1. 每个 `HomeContainerHorizontalScrollView` 持有一个 `HomeContainerVerticalGateGestureRecognizer`，在 4pt touch slop 后只判定一次主方向。
2. 横向 scroll 的原生 pan 使用 `require(toFail: verticalGate)`。明显纵向时 Gate 进入 began，横向 pan 失败；明显横向时 Gate 失败，横向 pan 继续使用 UIKit 原生 tracking/dragging/deceleration。
3. Gate 与 `HomeContainerNestedScrollView` / `HomeContainerNestedTableView` 允许 simultaneous recognition，使纵向手势继续由共享 outer/table 原生状态机消费。
4. outer scroll 覆盖 `touchesShouldCancel(in:) = true`，只有形成真实纵向拖动时才取消 Banner/按钮的 control touch；短按仍由原控件处理。
5. `HomeContainerPagerChildHorizontalScrollView` 继续保留自己的 Pager 边界交接；Header Actions、Banner、共享 Tabs 不新增 `gestureRecognizerShouldBegin`，避免再次破坏横向惯性期间的同向加速和反向接管。

自动化诊断已确认：从 Banner 正文发出的纵向 drag 被 Gate 判定为 vertical，Banner contentOffset 保持横向 `0`，共享 outer pan 进入滚动回调。当前 `agent-device/XCTest` 仍会把 210pt drag 的第一段合并为约 113pt 的单次 `touchesMoved`；Gate 在该帧进入 began 后，outer 只剩约 1.7pt 的后续位移，所以自动化最终截图不能代表真人连续采样的滚动距离。临时 `NSLog` 已移除。必须继续在真机或 Simulator 鼠标连续慢拖中验证 Banner 图片、标题、空白和关闭按钮 hit area 四个起点，并同时回归横向惯性期间的同向/反向二次接管。

本轮 iOS Debug 完整 `xcodebuild` 通过，并使用 `simctl install` 覆盖安装到 iPhone 17 Pro Simulator（iOS 26.5）；没有执行 uninstall/reinstall/clear。首次覆盖安装前后 Data container 都是 `24936KB`、436 个文件；移除临时诊断后的最终增量 build 也已通过并再次覆盖安装，最终安装前后均为 `25976KB`、437 个文件。人工连续手势验收完成前不能把此项标记为完全通过。

### Gate 运行时边界

- **Runtime scope：** 仅 main UI runtime；bg 不参与手势方向、scroll offset、refresh 或 control touch cancellation。
- **Native resource ownership：** 每个 `HomeContainerHorizontalScrollView` 各自持有一个 Gate；outer/table/pager/refresh 继续由单个 `HomeContainer` 实例持有，没有新增共享 singleton。
- **JS heap copies：** main/bg JS heap 隔离；Gate 不创建 JS 状态，也不把逐帧 offset、velocity 或 progress 序列化到任何 JS heap。
- **Timing/order：** Gate 与 UIKit pan 在 main thread 的同一次原生触摸序列内仲裁，不等待 bg 或 JS readiness；异步数据 patch 不应替换 scroll view 或重置 recognizer state。

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

## 2026-07-14 Spot 列表项与 Footer 对齐

### 原版行为基准

- 普通 Token、Market 和 Earn 行以原版 `ListItem` 为准：内容左右边距 20、Token 图标 40、实际行高 56、无可见分割线。
- 可点击行的命中区域覆盖整行；按压时只在左右各缩进 8 的 12 圆角区域显示 `bgActive`，不能只高亮文字或图片。
- `Show more` / `Show less` 是当前列表的展开与收起动作，不显示箭头。
- Market 底部的 `View more ›` 是跳转动作；Earn 标题右侧的 `View more ›` 也是跳转动作，两者不能复用列表展开状态。
- Spot Token 折叠且超过默认数量时，只显示 `Show more`，不提前显示 footer。
- 展开后顺序必须是：全部可见 Token、Low-value assets、Collapsed risk assets、`Can't find your token? Add token →`、`Show less`。
- `Can't find your token? Add token →` 只在存在可见 Token 且 `manageTokenEnabled` 为真时出现，点击复用原版 `useManageToken().handleOnManageToken()`。

### 数据和文案边界

- **Runtime scope：main。** `Show more`、`Show less`、`View more`、Add token instruction/label、Low-value/risk 文案都由 main JS 使用 `ETranslations` 格式化后注入 snapshot；Native 不保存英文默认文案。
- **Runtime scope：bg。** Token、small-balance 和 risk 数据仍由现有 bg service/proxy 独立获取；bg 不持有列表展开状态，也不参与按压或滚动帧。
- **Native resource ownership：per view。** iOS `UITableViewCell` 和 Android `RecyclerView.ViewHolder` 各自持有瞬时 pressed/hover 状态；没有新增进程级 UI singleton。
- **JS heap copies：** main 与 bg 的 JS heap 仍隔离。Native Home snapshot 只在 main 生成并序列化给 Native；不会为按压态或展开动画在 bg 再复制一份 UI 状态。
- **Timing/order：** bg 与 main 独立初始化；loading/empty snapshot 返回时不得显示 Add token footer。数据到达后使用现有 revision/patch 更新，不能假设 bg 已先于 main ready。

### 本轮实现和验证

- JS adapter 新增独立 `addToken` renderer，并将三类文案和 footer 显示条件写入 snapshot；未修改生成翻译文件。
- iOS/Android 行高、内容边距、无分割线、全行点击和 inset pressed/hover 背景已经按原版对齐。
- iOS Debug simulator app 已重新 Native build，并用覆盖安装验证；安装前后 App Data 均为 `31452 KB / 497 files`，未执行 uninstall/reinstall/clear。
- `nativeHomeDataAdapters.test.ts`：8/8 通过；`HomeContainerController.test.ts`：7/7 通过。
- Android Native module 使用 Java 17 执行 `:onekeyhq_native-components:compileDebugKotlin`，构建通过。
- 待人工录屏确认：长按 Token 行时背景色、展开后完整 footer 的逐项视觉，以及 Add token 弹窗入口。自动化坐标手势会把列表 pan 误判为行点击，不能把该自动化结果当作交互通过证据。

## 2026-07-15 Market 分类选择器与 View more 对齐

### 原版结构和交互基准

- Market 分类必须复用原版 `PopularTrading` 的 `CategorySelector` 语义，不能写死为星标、Trending、Stocks 三段静态文字。
- 分类来源顺序为：Watchlist/Favorites、服务端 `homeTab` Spot 分类，以及配置支持时追加 Perps Hot。服务端没有 Spot 分类时才使用原版 fallback categories。
- 选择器总高 48：内容上下各 8、按钮高 32、按钮间距 4、水平内容边距 20。按钮使用 16 号 medium 文本，选中态为 `bgActive` 胶囊，未选中态透明并使用 subdued 文本/图标色。
- Favorites 是仅图标按钮，使用 Star outline；选择后星标胶囊高亮。Trending、Stocks、Perps 等分类点击后应立即切换选中胶囊；main 只重算 Market 数据，现有 transport 发送 portfolio tab 的 atomic sections patch，不发送全量 Home snapshot。
- Market 底部 `View more ›` 是全宽 secondary pill，点击目的地取决于当前分类：Favorites 跳 Watchlist，Spot 分类跳对应 Market category，Perps Hot 跳 Perps/Hot。
- Earn 标题右侧 `View more ›` 是 small tertiary header action，点击进入 Earn Home。它与 Market footer 的外观、位置和目的地均不同。

### 数据与运行时边界

- **Runtime scope：main。** 当前 Market 分类 ID、分类列表、选中态、Market snapshot 和导航 action 都由 main UI JS runtime 持有；切换分类通过现有 controller 生成 portfolio tab 的 atomic sections patch，不重建 `HomeContainer` 或发送全量 snapshot。
- **Runtime scope：bg。** Watchlist、Market basic config、Spot category、Perps Hot 和 Earn 数据继续通过现有 `backgroundApiProxy` 请求；bg 不持有选中态，也不参与按钮按压/hover/滚动帧。
- **Native resource ownership：per view。** iOS `HomeContainerMarketSegmentButton` 与 Android Market segment view 只持有当前 cell/view 的 pressed、hover 和 selected 视觉状态；没有新增共享 Native singleton。
- **JS heap copies：** main 与 bg JS heap 相互隔离。Market service 返回值在调用方 runtime 独立反序列化；Native 只收到 main 生成的轻量 segment/token snapshot，不共享 bg JS 对象。
- **Timing/order：** main 与 bg 独立初始化。配置或分类数据晚到时，main 使用可解析的第一项作为临时 selection；服务端分类到达后再用 monotonic revision patch 更新，不能假设 bg 已在首页首帧前 ready。

### 实现和验证证据

- `HomeContainer` schema 新增 `segments`，Swift/Kotlin model 均解析 `id/title/icon/selected/actionId`；分类按钮具备整项点击、pressed/hover 和 accessibility label。
- iOS Debug 在 iPhone 17 Pro / iOS 26.5 simulator 完成全量 Native build，并使用 `simctl install` 覆盖安装；安装前后 App Data 均为 `35008 KB / 672 files`，未执行 uninstall/reinstall/clear。
- Trending 的真实点击已经使胶囊选中并加载 Trending token 数据。Nitro 子树当前未出现在 accessibility snapshot，因此该次点击使用坐标；坐标验证不能替代后续 Android 语义节点验证。
- iOS 对比截图：`.tmp/ui/native-home-market-stable.png`（Favorites 选中）、`.tmp/ui/native-home-market-trending-2.png`（Trending 选中并加载数据）、`.tmp/ui/native-home-stable-with-defi.png`（Market 与 Earn header action 同屏）。
- TypeScript、Swift parse、Android `:onekeyhq_native-components:compileDebugKotlin` 和 iOS full build 均已通过；`HomeContainerController.test.ts` 覆盖 segment selected 状态在 atomic patch 中不丢失。
- Android 后续必须验证：Favorites/Trending/Stocks/Perps 连续点击、暗色模式、RTL、横向超宽分类滚动、点击后仅 Market section 更新，以及两类 View more 的真实路由。

## 2026-07-15 Market 分类切换与行样式遗留

### 新增问题

1. **P0：Favorites / Trending / Stocks / Perps 切换时列表剧烈抖动。** 当前分类请求开始时会把旧 rows 立即清空，随后 Native diff 再插入新 rows；iOS diffable table 与 Android `ListAdapter` 都可能对 Market section 的删除/插入播放结构动画，导致 Market 以下的 Earn/Support 内容上下跳动。验收要求是选择胶囊立即切换，Market 内容在固定高度 loading/旧内容过渡后原位更新，外层 content offset、Earn 位置和 Header/Tab 均不得跳动。
2. **P0：Market 行缺少左侧收藏按钮。** 原版 `RichTable` 每个 Market row 左侧都有独立 Star 按钮；Favorites 中为实心星，其他分类按 watchlist 状态显示实心/空心星，并可直接增删收藏。Star 点击不能触发行导航，整行其他区域仍进入原版 Market token/Perps 目的地。
3. **P1：长文本截断规则不一致。** 原版 title/subtitle/value/detail 均为单行尾部省略；左侧 identity 区必须在右侧价格列之前收缩，不能把 subtitle 截成硬切、覆盖右侧列或让 badge/market cap 漂移。Stocks 等长名称需保持 token symbol、subtitle 和右侧价格对齐。
4. **P1：Stocks 图标与原版不一致。** Stocks 行必须使用服务端 token `logoUrl`，同时保留右下角 network badge；图片加载失败时才使用原版 identity fallback，不能常态显示首字母圆形占位。Stocks symbol 中的 Ondo/stock 标记属于文本/徽标语义，不得替代 token logo。

### 修复边界与验证要求

- **Runtime scope：main。** 分类选中态、watchlist pressed action、loading/previous rows view model 和文本截断字段由 main UI runtime 生成；分类切换只触发 portfolio tab atomic patch，不重建 `HomeContainer`。
- **Runtime scope：bg。** Market category、watchlist 增删与 token logo 数据继续由现有 Market service 通过 background proxy 提供。每次请求必须带 category/request identity，较旧分类结果不能覆盖新选择。
- **Native resource ownership：per view。** iOS/Android row 持有瞬时 pressed/hover、图片请求和布局状态；图片 cache 仍是进程级共享 Native 资源，但 represented URL 与取消句柄属于具体 cell/view，不能串图。
- **JS heap copies：** main 与 bg JS heap 隔离；watchlist/category/token 数据通过 proxy 序列化为 main 副本，再生成轻量 Native snapshot。Native 不读取 bg JS 对象。
- **Timing/order：** main 可先切换 selected category，bg 数据随后返回。过渡期必须保持 Market section 稳定高度并拒绝 stale result；不能用清空 rows 作为 loading 状态。
- iOS/Android 都要录制连续 `Star → Trending → Stocks → Perps → Star` 切换，确认无高度跳变、无插入/删除行动画、外层滚动位置不变。
- 分别验证空心/实心 Star 的点击、hover/press、事件隔离和 watchlist 数据刷新。
- 使用超长 Stock symbol/name 与失败图片 URL 验证尾部省略、真实 logo、network badge 和 fallback；Light/Dark 均需截图。

### 2026-07-15 当前实现状态

- 分类请求现在携带 request identity；旧分类结果不能覆盖当前 selection。数据等待期间使用一条不可见、固定为三行 Market row 加一行 `View more` 的占位，避免原先 `3/4 rows -> 0 rows -> 3/4 rows` 引起的 content-size 抖动。iOS diffable update 保持 `animatingDifferences: false`，Android 继续禁用 item animator。
- Market row schema 已加入 `favorite`、`favoriteActionId`、`favoriteLabel`。iOS 与 Android 都渲染独立 Star 命中区，Star 点击只执行 watchlist 增删，不能冒泡到 token row 导航；spot/perps 的原版 add/remove、日志与 watchlist refresh 链路由 main 调用 bg service proxy。
- Market identity schema 已加入 `imageUrls` 候选链。iOS/Android 都先加载 `logoUrl`，失败后依次尝试 `logoUrls`；每个复用 cell/view 保存自己的 represented signature 并取消旧请求，避免快速分类切换时串图。网络 badge 仍由 main 查询 network logo 后单独注入。
- iOS 与 Android 的 title/subtitle/subtitleDetail/value/detail 均限制为单行尾部省略；左侧 identity 区优先压缩，右侧价格列保持对齐。Stocks 不再以首字母圆形作为常态图标，仅在所有服务端图片候选均失败时显示 fallback。
- 聚焦 Jest：`HomeContainerController.test.ts`、`nativeHomeDataAdapters.test.ts`、`PopularTrading/utils.test.ts` 共 17/17 通过。Swift parse、Android Java 17 `:onekeyhq_native-components:compileDebugKotlin`、iOS iPhone 17 Pro / iOS 26.5 Debug full build 均通过。
- iOS 已使用 `simctl install` 覆盖安装签名构建；App Data 安装前后均为 `36736 KB / 761 files`，未执行 uninstall/reinstall/clear。应用已正常启动。
- **尚未判定交互验收通过：** 当前 `agent-device` 从 Market/Token row 发起坐标 pan 时会误触 row 详情，无法用这条自动化证据证明连续分类切换无抖动、Star 事件隔离及 hover/press。后续必须使用真实触摸或可靠语义节点录制 `Star -> Trending -> Stocks -> Perps -> Star`，并补 Light/Dark 的长文本、Stock logo/network badge 截图；元素存在或单帧截图不算通过。

## 2026-07-15 Perps Token 图标与原版兜底

### 根因和原版基准

- 原版 Perps holding 使用 `getHyperliquidTokenImageUrl(symbol)`，例如 USDC 对应 `https://uni.onekey-asset.com/static/hyperliquid/USDC.png`；Native Home adapter 此前没有注入 `imageUrl`，因此 Native 永远进入兜底分支。
- 原版 `Token` 组件的最终兜底不是首字母圆形，而是 `$gray5` 圆形背景上的 `$iconSubdued` `CryptoCoinOutline`。iOS/Android Native cell 此前把 title 首字母作为所有未知图片的统一兜底，所以显示了错误的 `U`。

### 当前实现和运行时边界

- main runtime 在构造 Perps holding/position snapshot 时注入同一套 Hyperliquid token URL；Native image loader 负责异步加载、缓存和 cell/view 复用取消。bg runtime、Perps service 和持久化数据均未修改。
- iOS/Android 对 `portfolio/perps/market/earn` token-like renderer 使用 CryptoCoin 语义兜底：Light 为 `#e0e0e0`，Dark 为 `#313131`，图标色继续取 main snapshot 的 subdued icon theme。远程图成功后覆盖兜底；URL 为空、全部候选失败或离线时兜底保持可见。
- **Runtime scope：main。** URL 只在 main 的 adapter 中计算并序列化一次；bg 不生成 UI URL，也不持有 cell 状态。
- **Native resource ownership：process shared + per view。** 图片 cache/loader 是进程级 Native 共享资源；represented signature、请求取消句柄和最终 fallback bitmap/image 属于具体 iOS cell 或 Android view。
- **JS heap copies：** 没有新增 bg JS 副本；main snapshot 只新增一个短 URL 字符串。Native fallback 不经过 JS bridge。
- **Timing/order：** main 与 bg 仍独立初始化。Native 会先同步呈现 fallback，再异步替换真实图片；旧请求回调必须通过 represented signature 校验，不能覆盖复用后的新行。

### 验证状态

- `nativeHomeDataAdapters.test.ts` 8/8 通过，并断言 USDC/BTC URL 与原版路径一致。
- Swift parse 通过；Android Java 17 `:onekeyhq_native-components:compileDebugKotlin` 通过；iOS iPhone 17 Pro / iOS 26.5 Debug full build 通过；`git diff --check` 通过。
- iOS 已用 `simctl install` 覆盖安装并启动；安装前后 App Data 均为 `37640 KB / 762 files`，未执行 uninstall/reinstall/clear。正常网络下 Perps holding 已实际显示 USDC 原版图片，证据为 `.tmp/ui/native-home-perps-icon-after.png`。
- 仍需验证两种降级态：断网显示 CryptoCoin fallback，以及快速切 Tab 后无串图。还需补 Dark mode 背景截图；单纯看到正常网络图片存在不能覆盖这些降级验收。

## 2026-07-15 Market 收藏空态、Star 比例与分类预取

### 原版行为与本轮根因

- Favorites/Watchlist 为空时，原版 `PopularTrading` 不展示空白：读取 Market basic config 的 `recommendTokens`，解析前 4 个推荐 Token，并提供“添加 N 个代币”的批量关注入口。Native supplemental 此前只读取 watchlist，空数组直接生成空 Market section，因此用户看到只有分类条、没有内容。
- 原版分类 Star 使用固定 18pt `StarOutline`，行内 Star 使用固定 20pt 图标并放在 32×40 命中区；Native 此前依赖 SF Symbol/Unicode glyph 默认大小，导致图形本体偏大，视觉间距也随字体度量漂移。
- 原版 JSX 首次点击分类时按需请求；Native 直接复用这个单分类 hook 后，未命中的 Stocks/Perps 会经历 `selected -> empty/loading -> rows`。固定高度 loading 只能避免下方 section 跳动，不能实现秒切。

### 当前实现

- Favorites 为空时复用原版 `fetchMarketBasicConfig().data.recommendTokens` 与 `fetchMarketTokenListBatch()`，推荐 Token 注入同一套 Native Market row；Market section header 同时注入本地化“添加 N 个代币”动作，批量写入 watchlist、记录原版 Recommend analytics、发出 watchlist refresh。没有修改生成翻译文件。
- iOS 行内 Star 固定为 20pt、分类 Star 固定为 18pt；Android 行内/分类 Star 同步固定为 20sp/18sp，保留原版 32×40 行命中区和 32 高分类胶囊，点击语义不变。
- `useHomeMarketCategoryTokens` 以 `categoryId + minLiquidity` 为 key 建立 main-runtime 30 秒缓存和 in-flight 去重。Market basic config 到达后立即并行预取当前可见的所有 Spot/Perps 分类；watchlist 和空收藏推荐也在首个 committed render 后开始 warm-up，不再等待首页原有 1.2 秒 deferred gate。点击已预取分类直接从 main cache 生成 atomic section patch，后台轮询/主动刷新再更新缓存；Earn 与其他 supplemental widget 仍保留 deferred gate。
- 收藏请求的初始 request identity 改为 `initial`，不能再把“尚未请求”误判为“当前分类已成功返回空数组”。这也是此前 Favorites/Earn 附近出现大片空白时 Market 空态没有 loading 的直接原因之一。

### 运行时与所有权

- **Runtime scope：main。** 分类 cache、in-flight 去重、当前 selection、推荐列表和 Native snapshot 都属于 main UI runtime；分类点击不向 Native 高频回传手势数据。
- **Runtime scope：bg。** basic config、Spot/Perps 分类、watchlist 读写仍由 bg service proxy 提供；bg 不持有 main 的分类 cache 或选中态。
- **Native resource ownership：per view。** Star 的 pressed/hover 与 accessibility target 属于具体 iOS cell/button 或 Android item/segment view；图片 cache 仍是进程共享 Native 资源。
- **JS heap copies：** main 与 bg heap 隔离；service 返回值在 main 反序列化后进入轻量 cache，再生成 Native snapshot。bg 不共享推荐 Token JS 对象。
- **Timing/order：** main/bg 独立初始化。Market warm-up 在分类配置可用后立即启动；相同 request key 共享一个 in-flight Promise，旧 selection 的完成结果只写自身 cache，不能覆盖当前分类。Network 请求仍由 bg service 执行；main 只在响应返回后反序列化每个分类的轻量首页行，并且未选分类不会生成 Native patch。

### 验证状态与待人工验收

- 相关 TypeScript 文件 ESLint 通过；聚焦 Jest 17/17 通过；Swift parse 通过；Android Java 17 `:onekeyhq_native-components:compileDebugKotlin` 通过；`git diff --check` 通过。
- `packages/kit` 全量 typecheck 仍被工作区已有的 DeFi、TradingView、Navigator、Firmware、MarketBanner、ReferFriends、Swap Header 错误阻断；本轮文件没有新增 TypeScript 报错。
- 尚需新构建后的真实交互证据：空 Favorites 是否显示 4 个推荐项与本地化批量关注动作；批量关注后是否无空窗切换为实心 Favorites；冷启动等待预取后连续 `Star -> Trending -> Stocks -> Perps -> Star` 是否每次首帧就有正确行；Light/Dark 下 18/20pt Star 比例与原版截图是否一致。单帧元素存在不能判定“秒切”通过。

## 2026-07-15 Market 行逐像素审计：Star、Token、Badge、字体和 View more

### 原版源码基准（不是截图估值）

- 原版行来自 `PopularTrading/metricColumns.tsx`、`MarketCategoryTokenList.tsx`、`TokenIdentityItem.tsx` 与共享 `Token.tsx`。移动端 `RichTable` 行高估算为 56，行外边距 8、行内水平 padding 12，因此可见内容从页面 x=20 开始。
- 行内收藏按钮是 `IconButton size="small"`：命中 frame 为 28×28，内部 `StarOutline/StarSolid` 为 **20×20**，使用 OneKey 自有 24×24 SVG path。它不是 SF Symbol，也不是 Unicode `☆/★`；两者即使 nominal size 同为 20，轮廓比例和 baseline 也不同。
- 行内横向几何为：Star frame x=20..48，随后 8 间距，Token x=56..88（**32×32**），再 12 间距，文字从 x=100 开始。当前 Native 的 40×40 Token、32×40 Star 区和系统 glyph 导致 icon、title 和右侧金额整体错位。
- `Token size="md"` 的主图是 **32×32**。链图本体是 **16×16**，外层有 2pt `bgApp` 圆形 padding，外层总尺寸 20×20，并相对主图 `right=-4 / bottom=-4`。当前 iOS 只有 16pt 裸图、Android 还把 badge 裁在主图圆形内，均不等价。
- 标题与右侧价格使用 `$bodyLgMedium`：Roobert Medium 16 / line-height 24；第二行 volume 和涨跌使用 `$bodyMd`：Roobert Regular 14 / line-height 20。标题必须单行 tail ellipsis，左列先收缩，右侧价格列保持完整。
- 普通 Spot 第二行只显示格式化 `volume24h`，不显示 `token.name`。只有 Stock `subtitle` 或 Perps localized subtitle 才出现在 volume 前。Native 把 `token.name` 无条件放进 subtitle，直接造成 BTC 金额被挤掉、CASHCAT 出现多余 `...`。
- 标题徽标顺序必须与 `TokenIdentityItem` 一致：symbol → leverage badge → stock source logo → `BadgeRecognizedSolid`。community badge 为 OneKey 自有 path、**16×16**、success 色；不能用文字或系统 badge 替代。
- 分类条内容 padding 为水平 20、垂直 8，item gap 4，item 高 32；分类文案是 Roobert Medium **14**，分类 Star 为原版 path **18×18**。当前 Native 分类文案 16 且仍用 SF/Unicode star。
- Market footer 的 `View more ›` 来自默认 medium secondary `Button`：可见 pill 高 **36**（6+24+6），文字 Roobert Medium 16，chevron 是 `ChevronRightSmallOutline` 20，外层顶部间距 12，总占高约 48。当前 Native pill 高 44、圆角 22，并把 chevron 拼进字符串，明显更厚且字距不一致。

### 本轮根因和修复目标

1. iOS `UIImage(systemName: "star")` 与 Android Unicode star 必须替换成同一份 OneKey Star path；分类和行内分别按 18/20 渲染，命中区仍保持可访问性与独立收藏事件。
2. Market row 需要 renderer-specific 几何，不能继续复用其他 Token/DeFi 行的 40pt icon 约束；只把 Market icon 改为 32，其他 renderer 保持原有尺寸。
3. 链徽标必须放到独立 20pt badge container，2pt 背景圈后渲染 16pt network image，并允许越过主图边界；cell/view 复用时仍要校验 represented URL 并取消旧请求。
4. Native schema 需要显式携带 `communityRecognized` 与 stock source logo；Native title row 按原版顺序渲染 recognized、stock、leverage，避免把这些语义压进 title 字符串。
5. JS Market adapter 只在 stock/perps 时注入 subtitle，volume 单独注入 `subtitleDetail`；这会同时修复 BTC 缺金额和 CASHCAT 多余三个点。
6. Market cell、分类条和 View more 改用 App 已打包的 Roobert Regular/Medium；iOS font 不可用时才回退 system，Android 从 `assets/fonts` 读取并缓存 Typeface。
7. View more 使用独立 label + chevron icon 布局，不再用 `"title  ›"` 字符串模拟；可见高度、圆角与原版 Button 对齐。

### 运行时边界和验证约束

- **Runtime scope：main。** Market subtitle/badge/source-logo/view-more 文案均由 main JS 生成轻量 snapshot；本轮不修改 bg Market 服务或持久化。
- **Native resource ownership：process shared + per view。** 字体与图片 cache 是进程共享 Native 资源；Star/recognized vector、约束、represented URL、按压态属于具体 cell/view。
- **JS heap copies：** bg 返回的 Market DTO 在 main 单独反序列化；新增字段只存在 main snapshot 和 Native decoded model，不共享 JS 对象。
- **Timing/order：** main 可先显示缓存分类，bg 独立刷新；图片/徽标异步回调必须核对复用 identity。分类预取和本轮视觉修复不能假设 bg 已 ready。
- Readiness 脚本当前被共享工作区已有的 `SwapHeaderContainer.tsx` / `SwapHeaderRightActionContainer.tsx` 未提交改动阻断；diff 已确认属于 Swap header、与 Native Home Market 无依赖交叉。本轮不得回滚或混入这两处改动。
- 验收必须同时截图 Favorites/Trending/Stocks/Perps：核对 Star path、32pt token、链 badge 背景圈、community/stock/leverage 徽标、长文本 tail ellipsis、BTC volume、CASHCAT 无多余 `...`，以及 36pt View more。只通过编译或只看到一张分类截图均不算完成。

## 2026-07-16 iOS Release 冷启动崩溃修复

### 崩溃证据与根因

- 最新崩溃报告为 `~/Library/Logs/DiagnosticReports/OneKeyWallet-2026-07-16-000045.ips`。控制台直接错误是 `RCTFatalException: No script URL provided`，调用栈进入 `RCTInstance handleBundleLoadingError`，不是 Market DTO、Native Home cell 或钱包数据库异常。
- 标准 main/bg Release 增量构建目录残留了 7 月 9 日 union build 的 `common.bundle`。Native 启动选择器检测到它后按 split bundle 启动 main，但同目录的 `main.jsbundle` 已是完整单 bundle，先产生模块 ID 冲突。
- 移除陈旧 `common.bundle` 后暴露第二个问题：`AppDelegate` 仍按 split bundle 约定给 background runner 传空 `entryURL`。background React Host 在后续 loader 接管前就因没有 script URL 调用 `RCTFatal`，因此应用一启动即退出。

### 修复和防复发

- `AppDelegate.backgroundBundleEntryURL()` 在 embedded fallback 下返回完整 `background.bundle` 文件 URL。Release host 启动时只有 `initialBundleKind == .common` 才走空 entry 的 split 模式；完整 main single-bundle 模式直接把 background bundle URL 交给 background runner。
- Xcode 标准非-union Release build phase 现在会先删除增量 Product 目录里的 `common.bundle`、`module-id-map.json`、`segments/` 和 `segments-background/`，避免旧 union artifact 让下一次构建再次误选 split 启动路径。main/background bundle 本身不会被删除。

### 运行时与资源边界

- **Runtime scope：main + bg。** 崩溃发生在 bg React Host 创建阶段；main 已开始启动，但进程被 bg 的 `RCTFatal` 一并终止。Market 首页视图和 DTO 只属于 main，不是本次根因。
- **Native resource ownership：shared native process resources。** MMKV、文件和原生 runner 位于同一进程，可由两个 runtime 触达；本轮只修正 runner 的 bundle URL 和构建产物选择，没有清理或迁移存储。
- **JS heap copies：per runtime。** main 与 bg 各自创建 Hermes/React JS heap，并分别加载完整 main/background bundle；对象和模块状态不共享，各 runtime 独立反序列化自身数据。
- **Timing/order：independent startup.** main host ready 不代表 bg 已 ready。bg 必须在创建 React Host 时就获得合法 bundle URL，不能依赖稍后的 background entry loader 补救空 URL。

### 验证结果

- `AppDelegate.swift` 通过 `swiftc -parse`；Xcode project 通过 `plutil -lint`；两处文件 `git diff --check` 通过。
- iPhone 17 Pro / iOS 26.5 simulator 的 Release main+bg 构建成功，并使用 `simctl install` 覆盖安装；未执行 uninstall、reinstall 或 clear，安装前后数据文件计数均为 2052，后续新增数量来自启动日志/cache。
- 00:16 冷启动日志明确显示 `backgroundBundleEntryURL ... fallback=file://.../background.bundle`、`start background runner in single-bundle mode`、`SharedStore and SharedRPC installed in background runtime`；随后 `BgTransport ... transportState=ready` 和持续 BgRPC 调用正常。
- 应用进程 PID 54495 持续存活，首页与钱包数据正常渲染；验证截图为 `.tmp/ui/native-home-after-bg-startup-fix.png`。00:16 之后未生成新的 `OneKeyWallet-*.ips` 崩溃报告。

## 2026-07-16 iOS Release Market UI 真机复测

### 复测环境与证据

- 使用 iPhone 17 Pro / iOS 26.5 simulator 上已覆盖安装的 Release main+bg 构建；只执行进程 terminate/launch，没有 uninstall、reinstall 或 clear，钱包数据仍正常。
- Favorites：`.tmp/ui/handoff-ui-market-favorites-verified.png`。
- Trending：`.tmp/ui/handoff-ui-market-trending-verified.png`。
- Stocks：`.tmp/ui/handoff-ui-market-stocks-verified.png`。
- 所有截图同时保留 402pt 宽的对照副本（文件名追加 `-402`），便于直接核对 handoff 中的 pt 几何。

### 已通过或部分通过

- 空 Favorites 已显示 4 个推荐项与 `Add 4 tokens` header action，不再是空白 section。
- Favorites、Trending、Stocks 单次点击均能在已有缓存上立即出现对应数据，没有复现 `rows -> empty -> rows` 空窗；但本轮没有四分类连续录屏，不能把“无抖动”判定为完全通过。
- 分类 Star、行内 Star、32pt token、20pt network badge 外圈和 recognized badge 已实际渲染；Market `View more` 当前可见 pill 高度接近 36pt，并使用独立 chevron。
- 当前服务端 basic config 没有提供 `perpsCategories.hot`，因此 Native 与原版 `PopularTrading` 相同，只渲染 Favorites/Trending/Stocks；本环境无法完成 Perps 分类截图，不能通过把 Perps 写死到 Native 来伪造验收。

### 未通过与新根因

- **P0：iOS Market 左列仍异常过度收缩。** Favorites 中 `LINK/SHIB/WLFI` 被显示为 `LI.../S.../W...`，Trending 的 `CASHCAT` 被压成 `CA...`，Stocks 的 subtitle 也出现 `A...` / `...`。`HomeContainerItemCell` 只设置 `rightStack.leading >= leftStack.trailing + 8`，没有让 left stack 占满价格列之前的可用宽度；Auto Layout 会保留一段无意义弹性空隙并把低 compression-resistance 的 title/subtitle 压到最小 intrinsic width。应改成确定的相邻约束，同时保留原版 symbol 128pt 与 localized subtitle 66pt 上限。
- **P1：Trending BTC 当前没有第二行 volume。** 同一截图中 PONS/CASHCAT volume 正常，说明 Native subtitleDetail 行本身可见；需继续区分当前 BTC DTO 的 `volume24h == 0` 与 patch/复用丢字段，不能用占位文案掩盖数据问题。
- **P1：Stocks 三行仍落到 CryptoCoin fallback。** snapshot 已携带 `logoUrl/logoUrls`，但真机未加载出 AAPL/SLV/CRCL 原版 token logo。需记录实际图片候选和失败原因，确认是服务端候选为空、SVG 过滤差异还是 Native loader/cache 命中问题；只有所有候选真实失败时才允许 fallback。
- **交互证据限制：** Nitro Market 子树仍不出现在 accessibility snapshot。页面上方 DeFi/Earn 异步数据会改变 Market 的纵向坐标，因此延迟坐标点击会误命中 `Show more`、Earn `View more` 或推荐入口；这些误命中不能作为 Market 路由通过/失败证据。后续需要语义节点或“截图后立即点击”的录制脚本。

### 运行时边界

- **Runtime scope：main。** 分类选中、Market DTO、section patch 与本轮布局结果属于 main UI runtime；bg 只提供 basic config、category/watchlist 数据，不持有选中态。
- **Native resource ownership：process shared + per view。** 图片/font cache 是进程共享 Native 资源；cell 的 Auto Layout、represented image signature、pressed/hover 和 accessibility target 属于具体 view。
- **JS heap copies：** Market 响应在 bg 与 main 各自 heap 中独立序列化/反序列化；Native snapshot 是 main 的轻量副本，没有共享 JS 对象。
- **Timing/order：** main、bg 独立启动。单分类缓存命中不代表图片已经完成异步加载；图片回调仍必须校验 represented signature，分类复测也不能假定 Perps config 一定存在。

## 2026-07-16 交接：后续统一改用 iOS Debug 包做 UI 调试

### 历史 Release 构建问题（已结束，不是当前 crash）

- 01:45:37 的最新启动失败报告为 `~/Library/Logs/DiagnosticReports/OneKeyWallet-2026-07-16-014537.ips`。它不是 Market DTO、Native Home 约束或钱包数据异常，而是进程在 `dyld` 阶段加载 `@rpath/GPChannelSDKCore.framework/GPChannelSDKCore` 失败。
- 本轮为了绕过本地签名曾使用 `CODE_SIGNING_ALLOWED=NO` 构建 Release。产物检查显示 `OneKeyWallet.app/Frameworks/GPChannelSDKCore.framework: code object is not signed at all`，因此 simulator 在进入 `AppDelegate` 前就以 `DYLD / Library missing` 终止。这个产物不能用于 UI 验收。
- 覆盖安装前数据容器有 2158 个文件；安装后重新查询仍为 2158 个文件。没有执行 uninstall、reinstall、erase 或 clear，钱包数据没有因这次失败构建被删除。
- **Runtime scope：main + bg 均未启动。** 崩溃发生在 dyld 装载阶段，main/bg React Host 和两个 Hermes JS heap 都尚未创建；不能把它归因到任一 JS runtime。
- **Native resource ownership：process shared。** 失败对象是同一 Native 进程加载的动态 framework；它不是 main/bg 各自持有的资源。存储、MMKV/DB 与已持久化钱包数据没有进入本次调用链。
- **Timing/order：pre-runtime。** 进程在 `AppDelegate` 和 background runner 初始化之前退出，因此现有 Release 冷启动 main/bg bundle 修复仍不能由这个 unsigned artifact 重新验收。
- **状态更正：当前已经没有 crash。** 上述 dyld 报告只描述一次错误的 unsigned Release 构建产物，不再是待修问题。后续不得继续围绕旧 crash 修改业务或 Native Home 代码。

### 新 session 的构建与安装硬约束

1. 后续 iOS UI 调试统一使用 **Debug** 构建；当前已经没有 crash，不需要再做启动崩溃修复。
2. 新 session 的固定第一步是从仓库根目录执行 `yarn app:ios`，由标准 Expo/Metro 流程重新构建、更新安装并启动当前分支的 Debug 包。
3. 不要用自定义 Release `xcodebuild` 替代 `yarn app:ios`，不要传 `CODE_SIGNING_ALLOWED=NO`。严禁 uninstall、reinstall、erase、clear data、删除 app container 或清理钱包数据库。
4. 只有确认当前运行的是最新 Debug 包、钱包数据仍在、应用稳定且 main/bg 日志都 ready 后，才开始 UI 验收。
5. 当前 simulator：iPhone 17 Pro / iOS 26.5，UDID `4837E819-A117-4E08-9936-445785D199E3`；bundle id `so.onekey.wallet`；agent-device session 曾使用 `native-home-p0`。

### 尚未完成的 UI 验收与当前源码状态

- 已在 `packages/native-components/ios/HomeContainerView.swift` 把 Market row 的左右列关系从 `rightStack.leading >= leftStack.trailing + 8` 改为确定的相邻约束 `rightStack.leading == leftStack.trailing + 8`，同时保留原版 symbol 128pt 与 localized subtitle 66pt 上限。Swift parse 与 `git diff --check` 已通过，但仍需要在 `yarn app:ios` 更新安装的最新 Debug 包中截图验收，不能提前标记通过。
- 新 Debug 包首先复测 Favorites：`LINK/SHIB/WLFI/UNI` 不应再显示为 `LI.../S.../W.../...`；再复测 Trending 的 `CASHCAT` 与 Stocks subtitle。若仍过度截断，应从 Auto Layout frame/compression priority 重新分析，不要继续对同一约束做微调猜测。
- Trending BTC 第二行 volume 仍需区分当前 DTO 的 `volume24h == 0` 与 snapshot/复用丢字段；原版同样只在 volume truthy 时显示，禁止用假占位文本掩盖数据问题。
- Stocks 的 AAPL/SLV/CRCL 仍显示 CryptoCoin fallback。需要记录 `logoUrl/logoUrls` 的真实候选、格式和 loader 错误，确认服务端候选为空、SVG/格式不支持或缓存/request identity 问题；所有候选真实失败时才允许 fallback。
- 当前服务端 basic config 没有 `perpsCategories.hot`，所以原版与 Native 都只显示 Favorites/Trending/Stocks。不要为了截图在 Native 写死 Perps；换到提供 hot config 的环境再验收。
- UI 证据继续使用 `.tmp/ui/handoff-ui-market-favorites-verified.png`、`.tmp/ui/handoff-ui-market-trending-verified.png`、`.tmp/ui/handoff-ui-market-stocks-verified.png` 与各自 `-402` 副本。新 Debug 构建必须生成新的 `after-debug` 截图，不能复用旧 Release 截图宣称通过。
- Nitro Market 子树仍未进入 accessibility snapshot；坐标会被 DeFi/Earn 异步高度变化影响。截图后延迟点击造成的误命中不算路由证据，优先补语义节点或使用截图后立即执行的短批处理。

### 工作区与提交边界

- 当前分支是 `codex/native-home-container`，交接时 HEAD 为 `120c035707`。工作区包含大量用户/其他任务改动，不能 reset、checkout、clean、stash 或批量提交。
- Native Home 相关未提交文件包括 handoff、`NativeHomePage.native.tsx`、`useNativeHomeSupplementalData.ts`、iOS/Android HomeContainer model/view、types/tests 等；另外还有与本任务无关的 Discovery、Swap、TradingView、Firmware 等改动，必须保留且不能混入提交。
- readiness 脚本此前被已有的 `SwapHeaderContainer.tsx` / `SwapHeaderRightActionContainer.tsx` 改动阻断；这不是 Native Home 失败，不得回滚这两处以制造绿色结果。

## 2026-07-16 iOS Debug Market UI 复测与后续提交约定

### Debug 构建、安装与 runtime readiness

- 本轮从仓库根目录执行了唯一允许的标准命令 `yarn app:ios`。命令完成 Debug build、更新安装和启动，结果为 `Build Succeeded`、0 error；没有改用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，也没有删除 simulator app container、钱包数据库或持久化数据。`Account #1`、余额和 Token 数据均正常显示，应用持续存活。
- Hermes/CDP 实测 page 1 为 `__ONEKEY_RUNTIME_KIND__ = "main"`，`$$onekeyJsReadyAt` 与 `$$onekeyUIVisibleAt` 均存在；main 收到的 background ready payload 为 `runtime=background/status=ready/protocolVersion=1`。page 2 独立报告 `__ONEKEY_RUNTIME_KIND__ = "background"`。main ready 和 bg ready 分别验证，没有把 main ready 当作 bg ready。
- 本轮开始时实际 HEAD 为 `ed30e0ac66a4483004144a722be4990c4f175825`，不是上一节记录的 `120c035707`；分支仍为 `codex/native-home-container`。

### Market 截图与交互结论

- `rightStack.leading == leftStack.trailing + 8` 已在最新 Debug 包完成真实截图验收。Favorites 的 `LINK`、`SHIB`、`WLFI`、`UNI` 均完整显示，不再出现 `LI...`、`S...`、`W...` 或只剩省略号；空收藏态同时显示 4 个推荐 Token 与 `Add 4 tokens`。
- 新 Debug 截图：
  - `.tmp/ui/handoff-ui-market-favorites-after-debug.png` 与 `-402.png`
  - `.tmp/ui/handoff-ui-market-trending-after-debug.png` 与 `-402.png`
  - `.tmp/ui/handoff-ui-market-stocks-after-debug.png` 与 `-402.png`
  - 三张原图均为 1206×2622，对照图均为 402×874。最终交付文件使用 settle 后的系统截图，未使用采集黑块帧作为证据。
- 连续 `Favorites -> Trending -> Stocks -> Perps -> Favorites` 的纯点击录屏为 `.tmp/ui/handoff-ui-market-category-switches-verified-after-debug.mov`。录屏中各分类首帧直接带行数据，没有观察到 `rows -> empty -> rows`；Market 高度、下方 section 位置与外层 content offset 没有跳动。
- 当前服务端 basic config 已经提供 `perpsCategories.hot`，与上一轮环境不同。Native 没有写死 Perps；本轮真实显示并切换到 KAITO、VVV、SKHY，因此 Perps 分类已进入连续切换证据。
- settle 后截图可见约 36pt 的独立 `View more` pill 与独立 chevron。Star 点击事件隔离、pressed/hover、Dark mode 和全部 pt 尺寸仍未在本轮重新完成真实触摸/逐点验收，不能声明整个 Market UI 完成。

### Trending BTC volume 与 CASHCAT

- main 通过 bg proxy 取得的实时 Trending DTO 中，BTC 的 `volume24h` 是字符串 `"-"`。现有 normalize/parse 结果为 falsey，原版和 Native 都应隐藏第二行 volume；这不是 snapshot、section patch 或 cell 复用丢字段，禁止添加假占位。
- 当前排序前三为 BTC、PONS、SOLdiers；CASHCAT 位于实时响应第 4，而 Native Home 只显示前三行。因此本轮没有真实 UI 行可用于验收 CASHCAT 截断，不能仅凭约束修复推断通过。

### Stocks 图片候选、TLS 失败与 fallback

- Native snapshot 的前三项为 AAPLon、SLVon、CRCLon。每项只有一个 `https://static.oklink.com/.../type=default_90_0?...` 图片候选；`logoUrls` 只是重复同一个 primary URL，去重后不存在第二个真实 fallback 候选。
- main runtime 对三条精确 URL 的 `fetch` 均返回 `Network request failed`；Apple `URLSession` 对三条 URL 均返回 `NSURLErrorDomain -1200`，即 TLS 在响应头和图片字节到达前失败。因此当前无法确认服务端实际图片格式，不能把格式猜测写成结论。
- iOS `representedImageSignature` 使用去重后的完整候选 URL 串；三项 URL 各不相同。cell 更新时会取消旧请求，异步回调再次校验 signature。连续分类切换中没有出现缓存串图或旧请求覆盖。
- 当前三项显示 CryptoCoin fallback 符合“所有真实候选失败后才降级”的约束。真实服务端 logo 成功态、Content-Type/图片格式仍需在 `static.oklink.com` TLS 可用的环境中复测。

### 检查、未完成项与推送约定

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过。
- 指定 Native Home 文件的 `git diff --check` 通过。
- 聚焦 Jest：`HomeContainerController.test.ts`、`nativeHomeDataAdapters.test.ts`、`PopularTrading/utils.test.ts` 共 3 suites / 17 tests 全部通过。
- 聚焦 ESLint：`HomeContainer.types.ts`、`NativeHomePage.native.tsx`、`useNativeHomeSupplementalData.ts`、`useHomeMarketCategoryTokens.ts`、`PopularTrading/utils.ts` 通过。
- 提交前已执行 `yarn agent:check --profile commit`。`lint-staged`、`lint-worktree-js` 与 `agent-context` 通过；`lint-worktree-ts` / `tsc-staged` 被共享工作区已有的 ThirdPartyHardware、Discovery、tokenList、Swap、Rspack、DeFi、TradingView、WebView、Navigator、Firmware、ReferFriends 等错误阻断。日志目录为 `node_modules/.cache/agent-checks/2026-07-16T02-03-58-225Z`；本轮只提交 handoff 文档，不得回滚或顺手修复这些无关文件来制造绿色结果。
- Trade/Swap readiness 仍被共享工作区已有的 `quoteProgress.ts` anchor 与两个 Swap Header dirty files 阻断；不得为本任务修改 reviewed ref 或回滚 Swap 代码。
- iOS split-runtime 边界保持不变：main 持有 Native Home UI、Market selection/cache/snapshot/section patch；bg 持有 config、category、watchlist 与 service 数据。两侧 Hermes heap、反序列化和初始化相互独立。图片/字体 cache 是进程级共享 Native 资源；constraint、represented signature、请求取消和 pressed/hover 属于 per-view 状态。
- 仍待真实证据：Stocks logo 成功态与图片格式、CASHCAT 当前行、Star 点击不冒泡、pressed/hover、Dark mode，以及全部样式尺寸逐点复核。未完成这些项前不得宣称“UI 已完成”。
- **从本节开始，每轮 Native Home 工作结束后都要更新 handoff，并按任务范围单独 commit/push 当前 `codex/native-home-container` 分支。** 只能 stage 本轮 Native Home/handoff 文件；Discovery、Swap、TradingView、Firmware 等无关 dirty files 必须继续保留且不得混入提交。

## 2026-07-16 Debug 原版/Native A/B 自动走查与 Market 集中修复

### A/B 走查结论与后续主要流程

- 原版 Home 代码仍保留。本轮只在 Debug Metro session 中临时把 `nativeHomeFeatureFlag.native.ts` 的默认值从 Native 切到 legacy，完成截图后立即恢复为 Native；该文件最终无 diff，也没有修改持久化设置、钱包数据或默认首页。
- 同一台 iPhone 17 Pro / iOS 26.5 simulator、同一账户和同一服务端数据分别截图 legacy 与 Native 的 Favorites、Trending、Stocks、Perps。对 Market ROI 生成 side-by-side、50% overlay 和 pixel diff，产物位于 `.tmp/ui/native-home-ab-audit/` 与 `.tmp/ui/native-home-ab-audit-after-fix/`。
- 这套流程本轮非常有效，直接发现了：Native 空 Favorites 错用四条普通 Market row、header action 多余 chevron、icon-only 分类宽度偏大、View more chevron 不一致、`marketTabs` 被误分组为第 5 张 `Market` 推荐卡、推荐卡子视图吞掉父控件点击，以及 Trending 小额价格被错误折叠成 `< $0.01`。
- **后续 iOS Native Home 视觉走查把同机 Debug legacy/Native A/B 作为主要方法：** 先固定同一 simulator/account/config，临时切 legacy 截一圈并恢复 Native，再逐分类截一圈；按 Market header 对齐 ROI，批量生成 side-by-side/overlay/diff；先排除实时价格、排序、轮播等动态噪声，再集中修稳定几何、字体、图标和格式化差异。
- Pixel diff 不能替代真实交互。分类连续切换、pressed/hover、Star 不冒泡、横滑和下拉仍必须使用短批处理录屏或多帧证据；Nitro 截图出现黑块时等待后再采第二帧，黑块帧和坐标误命中都不得作为通过/失败证据。

### 本轮集中修复

- Favorites 空态改为与原版一致的 2×2 推荐卡：LINK、SHIB、WLFI、UNI；header 使用独立 plus + `Add N tokens`，默认 4 个全部选中。点击 LINK 已真实验证 `Add 4 tokens -> Add 3 tokens -> Add 4 tokens`，check 同步消失/恢复，未实际提交 watchlist 变更。
- 推荐卡加入稳定 accessibility id、远程图片候选/signature/request cancellation、32pt token、20/16pt network badge、20pt check；分类 icon-only 宽度收敛到 38pt，View more 使用仓库 `ChevronRightSmallOutline` 对应的独立 20pt chevron。
- 推荐 grid 只分组连续的 `renderer == market` item，不再把 `marketTabs` 当成推荐卡；推荐卡所有内容子视图关闭 hit testing，由父 `UIControl` 独占点击。
- 首版辅助图片 loader 使用 `inout` property，而 SDWebImage memory-cache callback 可能同步回调，触发 Swift exclusivity fatal access conflict。已改为 badge/accessory 两个不使用 `inout` 的独立 loader，保留 represented URL 与 cancellation 校验；重新 `yarn app:ios` 后无 crash，应用持续存活。
- A/B 新发现的价格差异根因是 Native Market 复用了 DeFi 金额格式化 `formatValue`，它会把 `< 0.01` 全部折叠。现已只对 Market 改用原版 `formatPrice`；最新 Debug 截图中 SOLdiers 为 `$0.00167`、PONS 为 `$0.008942`，不再显示 `< $0.01`。

### 最新 Debug 实证

- 最终再次从仓库根目录执行 `yarn app:ios`，结果 `Build Succeeded`、0 error，并由标准流程更新安装、启动 Debug app。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。启动后 `Account #1`、余额与 Token 数据正常，应用持续存活。
- 最新 Hermes/CDP：page 1 为 `main`，`$$onekeyJsReadyAt` / `$$onekeyUIVisibleAt` 存在，并收到 `background/status=ready` payload；page 2 独立为 `background`。main/bg 都 ready，未用 main ready 代替 bg ready。
- 最新截图：
  - `.tmp/ui/handoff-ui-market-favorites-after-debug.png` 与 `-402.png`
  - `.tmp/ui/handoff-ui-market-trending-after-debug.png` 与 `-402.png`
  - `.tmp/ui/handoff-ui-market-stocks-after-debug.png` 与 `-402.png`
  - 三张原图均为 1206×2622，对照图均为 402×874。
- 最新 Stocks 成功态中 AAPLon、SLVon、CRCLon 分别显示真实 Apple、iShares、Circle 服务端 logo；badge/signature 正确，没有 fallback 或复用串图。此前 `static.oklink.com` TLS `-1200` 是瞬时网络失败，不能再把 fallback 当成永久格式不支持结论。
- 当前 Trending BTC `volume24h` 仍为服务端字符串 `"-"`，normalize 后 falsey；原版与 Native 都隐藏第二行，禁止增加假占位。本轮实时 top 3 没有 CASHCAT，因此 CASHCAT 行仍无最新 UI 证据。
- 修复后连续分类短录屏为 `.tmp/ui/handoff-ui-market-category-switches-ab-after-fix.mov`，抽帧为 `.tmp/ui/native-home-ab-audit-after-fix/category-switches-contact-sheet.png`。Trending -> Stocks -> Perps -> Favorites 都命中正确分类，首帧直接有行数据，Earn/Upgrade 与外层 offset 没有跳动。
- 当前服务端已提供 Perps hot config，Perps 为真实配置结果，没有在 Native 写死。最新 Perps settle 截图为 `.tmp/ui/handoff-ui-market-perps-ab-after-fix-settled-2.png`。
- 提交前 `yarn agent:check --profile commit` 日志位于 `node_modules/.cache/agent-checks/2026-07-16T04-08-47-746Z`。gate 首次发现本轮 `formatPrice` 入参类型错误，已修为显式 string；聚焦 ESLint 通过，重跑 `yarn tsc:staged` 后 Native Home 文件不再报错。剩余 13 个 TypeScript error 与 type-aware lint failure 均来自共享工作区已有的 Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、ReferFriends、Swap 和旧 `NativeHomePageView.native.tsx` 改动，不得回滚这些文件制造绿色结果。

### Runtime 边界与剩余项

- **main runtime：** Native Home UI、Market selection/cache/snapshot/section patch、推荐卡选择和格式化。**bg runtime：** Market config/category/watchlist/service 数据。两侧 Hermes heap 与反序列化副本独立，初始化顺序也独立。
- 图片与字体 cache 是进程级共享 Native 资源；cell constraint、represented image signature、request cancellation、pressed/hover 和推荐卡渲染状态属于 per-view 状态。
- 已有真实证据覆盖 Favorites 2×2 空态、选择/恢复、Trending 小额精确价格、Stocks 三张真实 logo、Perps 配置态和连续分类无空窗/无高度跳动。仍未覆盖 Dark mode、pressed/hover、行内 Star 点击不冒泡、所有降级态及 CASHCAT 当前行，因此不能声明整个 Market UI 已完成。

## 2026-07-16 真实空收藏 A/B、Add 4 刷新与 Plus 尺寸修复

### 用户发现的问题与根因

- 用户在 Native 空 Favorites 点击 `Add 4 tokens` 后看到四层 `Added to market favorites`，但页面仍停留在 2×2 推荐卡。bg 批量写入实际成功，问题在 main：写入通过 proxy 返回后只依赖通用异步 refresh，没有让当前 main heap 的 watchlist/favorites snapshot 首帧切换；重复进入 action 时还会叠加提示。
- Native header 使用 14pt SF Symbol `plus`。原版实际使用 small Button 的 `PlusSmallOutline`：18pt 画布、24×24 path 中 2pt 笔画，视觉主体约 9pt；因此 Native 的 `+` 明显更大，不能只按 SF Symbol pointSize 猜测。

### 等业务状态 A/B 成为强制前置条件

- 仅保证同 simulator/account/config 仍不够；A/B 前必须让两边处于相同业务状态。本轮在 legacy Debug 中先确认真实空收藏推荐态，再点击原版 `Add 4 tokens`：原版只出现一条成功提示并立即切成普通收藏行。随后依次点击 UNI、SHIB、WLFI、LINK 的实心 Star，每次截图确认当前行消失，最后重新出现 4 个推荐 Token 与 `Add 4 tokens`。
- 后续 Favorites 空态的主要走查流程固定为：legacy 真实 Add -> 逐 Star remove -> 确认空态 -> 截图；恢复 Native -> 确认同一 watchlist 为空 -> 截图；对齐 Market ROI 后生成 A/B。禁止通过清数据、改 DB、Native 写死空态或只比较元素存在来伪造相同状态。
- legacy 空态：`.tmp/ui/ab-empty-favorites-legacy.png` 与 `-402.png`。Native 修复后空态：`.tmp/ui/ab-empty-favorites-native-after-fix.png` 与 `-402.png`。Market ROI 并排图：`.tmp/ui/ab-empty-favorites-legacy-vs-native-after-fix-402.png`。
- Nitro Market 的延迟坐标仍不可靠。本轮一次延迟点击因 DeFi 高度变化误入 Pendle，该录屏已明确作废。最终证据使用一个 agent-device 短 batch，在同一 daemon request 内执行截图、立即点击、首帧截图和后续截图；误命中不得计入通过或失败。

### 实现与真实交互结果

- `useNativeHomeSupplementalData.ts` 为 Add recommended 增加 in-flight guard。bg 批量写入返回后，main 再通过 proxy 读取权威 watchlist，并在同一次 main 更新中写入 watchlist result 与匹配 request key 的非推荐 favorites snapshot；因此无需等待下一轮 polling，也不会出现 `recommendations -> empty -> rows`。
- `HomeContainerView.swift` 用原版 `PlusSmallOutline` 的精确 path 生成 18pt template image，替换 SF Symbol；A/B 截图中 `+` 的画布和视觉笔画已与原版对齐。
- 最终短 batch 点击后第一张可读帧已直接显示 UNI、WLFI、SHIB 三条收藏行，`Add 4 tokens` 和四张推荐卡同时消失，只出现一条成功提示；7 秒后仍保持收藏列表。录屏 `.tmp/ui/native-home-market-add4-refresh-after-fix.mov`，2fps 抽帧 `.tmp/ui/native-home-market-add4-refresh-contact-sheet.png`，最终截图 `.tmp/ui/native-home-market-add4-after-fix.png` 与 `-402.png`。录屏抽帧中没有 `rows -> empty -> rows`，单张黑块是 agent-device 截图采集异常，不是录屏中的 UI 空窗。

### Debug 构建、数据安全与 runtime 边界

- 从仓库根目录执行 `yarn app:ios`，结果 `Build Succeeded`、0 error；标准流程完成 Debug build、签名、更新安装和启动。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。`Account #1` 与资产列表正常，应用持续存活。
- Hermes page 1 实测 `$$onekeyJsReadyAt=1784190633508`、`$$onekeyUIVisibleAt=1784190635251`，并收到独立 bg ready payload：`runtime=background/status=ready/protocolVersion=1/bootId=1784190635340-pfxqripz`。page 2 独立识别为 background runtime，background Jotai bridge 存在；main ready 没有被当作 bg ready。
- **main scope：** Add action guard、推荐选择、watchlist/favorites 的反序列化副本、Native snapshot 与首帧切换。**bg scope：** watchlist SimpleDB/service 写入和权威读取。main/bg Hermes heap 独立、对象经 proxy 序列化，不共享 JS 对象，初始化顺序也独立。
- 图片/font cache 与底层持久化资源是进程级共享 Native 资源；constraint、represented image signature、request cancellation、pressed/hover、action in-flight 与 cell 状态仍是 per-view/main 状态。
- 本节只证明真实空态 A/B、Plus 尺寸和 Add 4 后即时刷新/单提示。Dark mode、pressed/hover、全部降级态、CASHCAT 当前行等前述剩余项仍未因此自动通过，不能声明整个 Market UI 完成。

### 检查与提交门禁

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过；指定 Native Home 文件的 `git diff --check` 通过；临时 A/B 开关 `nativeHomeFeatureFlag.native.ts` 已恢复且最终零 diff。
- `yarn exec eslint` 聚焦检查 `useNativeHomeSupplementalData.ts` 与 `NativeHomePage.native.tsx` 通过。
- 聚焦 Jest：`HomeContainerController.test.ts`、`nativeHomeDataAdapters.test.ts`、`PopularTrading/utils.test.ts` 共 3 suites / 17 tests 全部通过。
- `yarn agent:check --profile commit` 日志位于 `node_modules/.cache/agent-checks/2026-07-16T08-52-42-632Z`。`lint-staged`、`lint-worktree-js`、`agent-context` 通过；`lint-worktree-ts` / `tsc-staged` 仅被共享工作区已有的 Rspack、DeFi、TradingView、WebView、Navigator、Firmware、ReferFriends、Swap、旧 `NativeHomePageView.native.tsx` 等错误阻断，日志中没有本轮 hook/Swift/handoff 错误。不得回滚或顺手修改这些无关文件制造绿色结果。

## 2026-07-16 Native Market Star 无闪烁乐观更新

### 用户问题、真实根因与预期

- 用户实测在 Native Home Market 点击行内实心/空心 Star 时会闪烁。Star 本身虽然已经是独立 28pt button，但旧流程要先等待 bg watchlist 写入，再 `watchList.run()`；新 watchlist 到 main 后，`favoriteRequestKey` 立即变化，而 `favoriteMarket.result` 仍持有旧 key。该间隙被解释为 `market=[] / marketLoading=true`，于是整个 Market 从 rows 切成 loading/empty，等 bg/service 数据返回后再切回 rows。
- iOS `UITableViewDiffableDataSource` 已使用 `animatingDifferences: false` 与 `reconfigureItems`，因此根因不是 diffable animation、cell 复用或 Star path。通过继续微调 cell layout 无法解决这个数据状态空窗。
- 通过条件是：点击后 main 首帧直接改变 Star；Market 标题、分类、三行/替换行、View more、Earn 和外层 offset 不消失、不上下跳；bg 写入失败时回滚；不能用“最终 watchlist 写成功”代替逐帧 UI 证据。

### 实现

- main 在调用 bg proxy 前先基于当前 watchlist 生成乐观副本，立刻写入 `watchList.setResult`。Favorites 请求 key 变化时采用 stale-while-revalidate：已有 `favoriteMarket` 行继续渲染，不再回退到 empty/loading；新详情返回后再以无动画 diff 替换对应行。
- 同一 token 的重复连点使用 per-token in-flight set 去重；不同 token 可继续并发。每次操作持有 revision，最后一次权威 reread 只有在没有更新操作开始时才允许覆盖 main 乐观副本，避免较早 reread 反向覆盖较新的 Star。
- bg 写入失败时只回滚当前 token，不回滚其他并发 token 的乐观结果。写入成功后仍发出原有 `RefreshMarketWatchList`，并在所有 in-flight 操作结束后通过 bg service reread 权威 watchlist。
- iOS cell 记录 `representedFavoriteItemId/state`。同一 item 的 Star 状态变化使用 160ms `transitionCrossDissolve + beginFromCurrentState`；初次渲染、新 item 和复用后的 cell 不做错误过渡。represented 状态与 constraint、request cancellation、pressed/highlight 一样属于 per-view 状态。

### 自动走查方法与误命中规则

- 继续沿用同机 Debug legacy/Native 等业务状态 A/B 作为整体视觉主流程；Star 这种瞬时状态必须额外执行“截图后立即点击 + 全时长录屏 + contact sheet + bg 权威 reread”。仅比较 before/after 单帧不足以证明中间没有 empty。
- 当前 Nitro Market 子树仍不进入 accessibility snapshot；虽然 cell 已设置 `native-home-market-favorite-*` identifier，XCTest direct selector 在本环境仍无法解析。agent-device/Computer Use 的长 drag 也会合并 touch move并误触 Token/Search。滚到 Market 时改用本机 `idb ui swipe --delta 5` 产生连续触点；到位后回到 agent-device 截图、录屏和短坐标点击。
- 第一段使用 Star hit area 边缘坐标时命中整行并跳到 Market 全页，已明确作废。最终证据只使用截图换算后的 28pt Star 中心点；点击后还必须确认底部仍为 Wallet、分类不变、bg watchlist 数量/首项真实变化。任何跳页、误入 Show more/View more 或黑块帧继续判废。
- 本轮证明该组合对“异步数据导致的瞬时闪烁”非常有效，后续把 `legacy/Native 等状态 A/B + 交互短录屏/contact sheet + 权威 service 结果` 固定为主要自动走查方式。pixel diff 负责稳定视觉差异，逐帧录屏负责闪烁/高度/offset，service reread 负责确认交互没有误命中；三者不能互相替代。

### 最新 Debug 实证

- 从仓库根目录执行标准 `yarn app:ios`，结果 `Build Succeeded`、0 error，并由该命令完成 Debug 自动签名、更新安装和启动。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，也没有删除 app container、钱包数据库或持久化数据。`Account #1`、余额和 Token 列表正常，应用在全部 Star 操作后持续存活。
- Hermes page 1 为 main：`$$onekeyJsReadyAt=1784193850660`、`$$onekeyUIVisibleAt=1784193852145`，transport 为 `ready`，收到独立 bg ready payload `runtime=background/status=ready/protocolVersion=1/bootId=1784193852272-q2xdclyd`。page 2 独立为 background，background Jotai bridge 存在；没有用 main ready 代替 bg ready。
- Favorites 取消 PONS：bg 权威 watchlist 从 5 条变成 4 条；最终行由 `PONS / TrumpCoin / BTC` 变为 `TrumpCoin / BTC / SHIB`。录屏 `.tmp/ui/handoff-ui-market-star-remove-smooth.mov`，before/after 为 `.tmp/ui/handoff-ui-market-star-remove-before.png`、`handoff-ui-market-star-remove-after.png`，8fps 全时长抽帧为 `.tmp/ui/handoff-ui-market-star-remove-smooth-contact-sheet.png`。
- Trending 给 SOLdiers 加星：bg 权威 watchlist 从 4 条变成 5 条，新首项为 `sol--101:B4ptaVsUe6YbtBwAS38WFeweSrVNfQLCcj9JRrtjU8vn`；三条 Trending 行保持原位，SOLdiers 只从空心 Star 变为实心 Star。录屏 `.tmp/ui/handoff-ui-market-star-add-smooth.mov`，before/after 为 `.tmp/ui/handoff-ui-market-star-add-before.png`、`handoff-ui-market-star-add-after.png`，8fps 全时长抽帧为 `.tmp/ui/handoff-ui-market-star-add-smooth-contact-sheet.png`。
- 两段有效 contact sheet 中 Market 标题、分类、行、View more 和 Earn 全程存在，没有 `rows -> empty -> rows`，没有 section 高度或外层 offset 跳动；两次 bg 权威结果与 UI 动作一致。该证据只通过本轮 Star 加/减无闪烁，不自动覆盖 Dark mode、pressed/hover、失败回滚注入态、CASHCAT 当前行或全部降级态。

### Runtime 与资源边界

- **main runtime：** 乐观 watchlist 副本、favorite request key、stale-while-revalidate 行、selection/cache/snapshot/section patch 与 in-flight/revision guard。**bg runtime：** Market config/category/watchlist service 与权威持久化写入/读取。
- main/bg 使用独立 Hermes JS heap，同一 watchlist 通过 proxy 序列化/反序列化，各自持有副本，不共享 JS 对象；两边独立初始化，main 乐观首帧不能假设 bg 已 ready，bg 最终返回也不能重置外层 UI 状态。
- 图片与字体 cache 仍是进程级共享 Native 资源；cell constraint、represented image signature、request cancellation、Star represented state、pressed/hover 属于具体 view。底层存储是共享 Native 资源，但本轮只通过 bg service 访问，没有从 main 直接修改数据库。

### 检查、门禁与提交边界

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过；指定 Native Home 文件 `git diff --check` 通过。
- `useNativeHomeSupplementalData.ts` 的聚焦 ESLint、Prettier 和 type-aware oxlint 均通过；聚焦 Jest `HomeContainerController.test.ts`、`nativeHomeDataAdapters.test.ts`、`PopularTrading/utils.test.ts` 共 3 suites / 17 tests 全部通过。
- `yarn agent:check --profile commit` 日志位于 `node_modules/.cache/agent-checks/2026-07-16T09-49-36-449Z`。`lint-worktree-js`、`lint-staged`、`agent-context` 通过；`lint-worktree-ts` / `tsc-staged` 被共享工作区已有的 Desktop、Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、ReferFriends、Swap、旧 `NativeHomePageView.native.tsx` 等错误阻断，日志中没有本轮 hook 报错。不得修改这些无关文件制造绿色结果。
- `1k-trade-swap-market` readiness 仍被共享工作区已有的 `quoteProgress.ts` reviewed-ref drift 及 `SwapHeaderContainer.tsx` / `SwapHeaderRightActionContainer.tsx` dirty files 阻断；本轮没有修改或回滚这些 Swap 文件。
- 本轮提交只能 stage `ANDROID_NATIVE_HOME_HANDOFF.md`、`packages/kit/src/views/Home/useNativeHomeSupplementalData.ts`、`packages/native-components/ios/HomeContainerView.swift`。其余大量用户/其他任务 dirty files 必须原样保留，不得混入 commit/push。

## 2026-07-16 Favorites 删除语义与严格全帧验收（本轮完成）

### 用户纠正与产品语义

- 上一节只解决了整块 `rows -> loading/empty -> rows`，但 stale-while-revalidate 会让 Favorites 中被取消的 Token 暂时保留为空心 Star，用户会感知为“不会移除”。这不符合原版：**Favorites 中取消收藏必须移除该行；Trending、Stocks、Perps 中取消收藏只改变 Star，分类行仍保留。**
- Favorites 的目标不是靠保留旧行规避闪烁，而是 main 首帧乐观删除并使用已缓存的下一条收藏补位。bg service 仍负责权威写入和 reread；失败时才按原索引平滑恢复。
- 数量语义：`5 -> 4` 时前三行用第 4 条缓存补位，Market 高度不变；`3 -> 2` 时允许减少一行，但 Earn 只能单向连续移动一次；`1 -> 0` 必须从最后一行直接过渡到 2×2 推荐卡，中间不能出现空白或 loading。

### 严格验收标准

- 之前的 8fps contact sheet 只能算初步证据，不能证明不存在短于 125ms 的空窗；本节明确降级上一节“无闪烁”结论，待新的全帧证据后再判定。
- 每个场景从点击前至少 1 秒录到 bg 权威 reread 后至少 2 秒，尽可能使用 60fps 原始录制；验收脚本必须检查录制文件中的**每一个实际帧**，不能只抽样 contact sheet。
- 每帧固定追踪 Market 标题、分类栏、可见数据/推荐卡、View more、Earn 标题和外层 content offset。任何一帧出现 loading/empty renderer、整块 rows 消失、旧行先恢复再消失、非目标行图片串图或第二次反向位移都失败。
- `5 -> 4`：分类栏、View more、Earn 的 y 坐标和外层 offset 全程容差不超过 1px；被删行与补位行只允许一个连续过渡。`3 -> 2`：Earn 允许随单行删除连续移动 56pt，但不得瞬时往返。`1 -> 0`：最后一行和推荐卡直接交接，不得先出现空白/loading。
- UI 证据必须同时配对 bg 权威 watchlist 前后内容，确认点击没有误命中整行或其他 View more；误跳 Market 全页、坐标漂移、截图黑块或分类变化的录屏一律作废。
- 最终证据包含原始录屏、全帧检测 JSON/摘要、关键帧 contact sheet、before/after 截图和 bg watchlist 前后值。代码编译、元素存在、最终 settled frame、8fps 抽帧任一项都不能单独判定通过。

### owner-correct 实现设计

- main 缓存 Favorites 前 4 条 display DTO，但 Native 只渲染前 3 条；删除时按乐观 watchlist 顺序从缓存映射新的前三行，并同步写入匹配的新 `favoriteRequestKey`，不再让被删 Token 以空心 Star 滞留。
- 有收藏时也预取空收藏推荐 Token；最后一条被删时直接提交 recommendation snapshot。Native diffable data source 只在 Market 结构变化且分类选择没有变化时启用局部行动画，价格轮询和分类切换不触发该动画。
- **main runtime：** display DTO cache、推荐预取、乐观删除/回滚、request identity、Native section patch。**bg runtime：** watchlist service 与持久化唯一写入者。两个 Hermes heap 独立，proxy 数据独立序列化/反序列化，初始化顺序独立。
- 图片/字体 cache 继续是进程级共享 Native 资源；row/cell constraint、represented image/favorite identity、request cancellation 和 pressed/transition state 属于 per-view 状态。

### 自动走查首先发现的真实抖动与二次根因

- 第一版 owner-correct DTO 修复已能让 `5 -> 4` 从 `WLFI / UNI / SOLdiers` 直接得到 `UNI / SOLdiers / SHIB`，bg 也真实从 5 条变成 4 条，但第一段有效录屏的 settled frame 中 `Show less` 和 Market 标题重新进入视口，证明 outer/body content offset 跳了约一行。列表最终正确不等于“不抖”，该段明确判失败并触发二次根因分析。
- 根因在 iOS `UITableViewDiffableDataSource` 的结构动画：同一 snapshot 删除首行并插入缓存的第 4 行时，UIKit 会为保持自身锚点自动改写 nested table 的 `contentOffset`；它再与 Native Home 的 outer/nested 协同滚动叠加，造成整页跳动。继续改 JS debounce、Star path 或 row constraint 都不会解决这个 offset owner 问题。
- 最终实现只在 Market 结构 mutation 且分类没有变化时启用 diffable 局部动画，并在动画期间钉住 mutation 前的 body content offset。UIKit 内部改写会在 delegate 回调和 apply completion 中恢复；如果用户真实开始 tracking/dragging/decelerating，则立即放弃钉住，不能与手势抢 offset。

### 最终 main 状态机与回滚语义

- main 预取空收藏推荐 Token，同时缓存 Favorites 前 4 条 display DTO，Native 正常态只渲染前 3 条。Star action 在调用 bg proxy 前，同一 main update 同时提交乐观 watchlist 和匹配新 request key 的 favorite snapshot。
- `5 -> 4` 由第 4 条 DTO 首帧补位；`3 -> 2` 直接减少一行；`1 -> 0` 直接切到已预取的 2×2 推荐卡。不会先提交 empty/loading，也不会让被删 Token 暂时保留为空心 Star。
- bg 写入失败时按删除前的真实 index 恢复 item，而不是错误 prepend；权威 reread 继续受 per-action in-flight set 和 revision guard 保护，较早请求不能覆盖较新的乐观状态。
- Trending、Stocks、Perps 的取消收藏仍只改变当前分类行的 Star，不删除服务端分类行；只有 Favorites 执行结构移除。Add 4 recommendations 继续使用上一节已验证的单次 main snapshot 更新。

### 严格录屏与每个实际帧的自动结果

- 有效原始录屏：`.tmp/ui/favorites-remove-5-to-4-debug.mov`（135 帧 / 6.43s）、`.tmp/ui/favorites-remove-3-to-2-debug.mov`（98 帧 / 6.42s）、`.tmp/ui/favorites-remove-1-to-0-debug.mov`（170 帧 / 7.50s）。simulator recorder 使用可变帧率；虽然请求目标为 60fps，但最终只按实际编码帧计数，禁止把它误报成 60fps 证据。
- 每段对应 `-before.png`、`-after.png` 和 `-contact-sheet.png`。contact sheet 只用于肉眼复核；pass/fail 来自 `.tmp/ui/favorites-remove-debug-frame-analysis.json`，脚本 `.tmp/ui/analyze-native-home-favorites-frames.py` 对解码出的 135 / 98 / 170 个实际帧逐一检查，没有按 8fps 抽样代替全帧。
- `5 -> 4`：Market anchor 全帧固定 y=415，View more 固定 y=684，Earn 固定 y=737；内容最小暗像素比例 0.073289，bg 5 条变 4 条，最终前三行 `UNI / SOLdiers / SHIB`。无 empty/loading、无 anchor 位移、无旧状态恢复。
- `3 -> 2`：Market anchor 全帧固定 y=415，Earn 只从 y=689 单向移动到 y=633，没有反向步进；内容最小暗像素比例 0.067382，bg 3 条变 2 条，最终 `SHIB / LINK`。
- `1 -> 0`：Market anchor 全帧固定 y=415，Earn 只从 y=577 单向移动到 y=657；内容最小暗像素比例 0.028084，bg 最终为空。最后 LINK 行与 `LINK / SHIB / WLFI / UNI` 推荐卡在同一段结构动画中交接，中间没有 blank/loading；第 72–99 帧展开图为 `.tmp/ui/favorites-remove-1-to-0-transition-frames-72-99.png`。
- 自动分类曾把 `Add 4 tokens` header 先出现、推荐卡仍在进入的中间帧误判成 settled after，随后又标成 before。逐帧展开证明不是旧行恢复；判定模型改为“内容接近 after 且 Earn 已到目标几何位置”后，first settled after 为第 103 帧，后续没有 state reversal。不能通过简单放宽 pixel threshold 消除失败。
- 多段录屏明确作废：点到分类 Star、XCTest coordinate no-op、以及 DeFi 异步位移后误入 Aave 的录屏都没有进入最终结果。Nitro subtree 仍只向 accessibility snapshot 暴露 Application/Window 两个节点；本轮最终使用稳定后的 screenshot + 原生 idb tap + bg 权威 reread。误命中规则继续强制执行。

### 该自动对比流程是否有效

- 本轮结论是非常有效，并继续作为 Native Home 的主要走查方式：同 simulator/account/config 下先做 legacy/Native 等业务状态 A/B；稳定视觉用对齐 ROI/pixel diff；交互结构变化用原始录屏的每个实际帧追踪固定锚点、内容密度和单向位移；最后用 bg service 权威结果确认没有误命中。
- 这套流程本轮先抓到“数据已正确但 content offset 仍跳”的真实失败，又排除了多个坐标误命中和一个自动分类 false positive。编译通过、最终截图、元素存在、单一 contact sheet 和 bg 写入成功仍不能互相替代。
- DeFi/Earn 会异步改变 Market 的屏幕 y；后续 coordinate fallback 必须先等 section settle，并使用截图后立即点击。必要时优先继续改善 Native accessibility 暴露，而不是复用几秒前的绝对坐标。

### Debug、数据安全与 runtime 边界

- 本轮两次从仓库根目录执行标准 `yarn app:ios`，两次均为 `Build Succeeded`、0 error，并由命令完成 `Debug-iphonesimulator/OneKeyWallet.app` 的签名、更新安装和启动。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。`Account #1`、余额和资产列表正常，应用全程持续存活。
- 最终 main runtime：`$$onekeyJsReadyAt=1784199661886`、`$$onekeyUIVisibleAt=1784199663362`、transport ready。bg 独立 ready payload：`runtime=background/status=ready/protocolVersion=1/bootId=1784199663483-eismks7v`，独立 background page 的 Jotai bridge 存在；没有用 main ready 代替 bg ready。
- 验收前权威 watchlist 为 `SOLdiers(sortIndex 995) / SHIB(998) / LINK(999)`。为覆盖 `5 -> 4` 仅通过正常 bg service 临时加入 WLFI/UNI；完成 `1 -> 0` 后又通过正常 service 恢复原三条及顺序，最终截图 `.tmp/ui/favorites-removal-restored-initial-three.png`。没有直接修改 DB。
- **main scope：** DTO/推荐预取、乐观删除与 rollback、request identity、snapshot/section patch、diffable mutation 和 per-view offset pin。**bg scope：** config/category/watchlist service 与权威持久化读写。两个 Hermes heap 独立，经 proxy 序列化/反序列化，各自持有副本，初始化顺序独立。
- 图片/字体 cache 和底层持久化句柄属于进程级共享 Native 资源；constraint、represented image/favorite signature、request cancellation、Star/pressed/transition、mutation offset pin 属于具体 view/main 状态。

### 本节完成边界

- 本节只通过 Favorites 的 `5 -> 4`、`3 -> 2`、`1 -> 0` 删除语义、无 blank/loading、单向结构动画、offset 稳定和 bg 权威结果。Stocks logo fallback、Trending BTC volume、失败回滚注入态、Dark mode、pressed/hover 与连续分类切换等仍按前文继续验收，不能据此声明整个 Market UI 已完成。

### 检查与提交门禁

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过；本轮指定 Native Home 文件的 `git diff --check` 通过。
- 聚焦 ESLint、type-aware Oxlint 均为 0 error；本轮三个 TS 文件的 Prettier check 通过。Swift 不在 Prettier parser 范围，handoff 也不做整文件机械重排。
- 聚焦 Jest：`useNativeHomeSupplementalData.test.ts`、`HomeContainerController.test.ts`、`nativeHomeDataAdapters.test.ts`、`PopularTrading/utils.test.ts` 共 4 suites / 22 tests 全部通过，其中新加 5 个测试覆盖第 4 行补位、`3 -> 2`、`1 -> 0` 推荐直切、原 index rollback 与分类加星置顶。
- `yarn agent:check --profile commit` 日志位于 `node_modules/.cache/agent-checks/2026-07-16T11-31-15-755Z`。`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` / `tsc-staged` 仅被共享工作区已有的 Desktop、Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、ReferFriends、Swap 和旧 `NativeHomePageView.native.tsx` 等问题阻断，日志中没有本轮 helper/hook/test/Swift 错误。没有回滚或顺手修改这些无关文件。
- 本轮提交只允许 stage 本节涉及的 handoff、Favorites helper/test、supplemental hook 与 iOS HomeContainer；大量其他用户/任务 dirty files 必须继续保留且不得混入。

## 2026-07-16 iOS Native Home 纵向滚动 owner 与 Support hub 跳顶修复

### 真实复现与根因

- 最新 Debug 包在 Spot 页滚到 Support hub 后，可以通过小幅反向或连续短拖触发偶发跳变：inner body 不是按手指距离连续移动，而是直接回到 body 顶部。真实跳变前后截图为 `.tmp/ui/native-home-scroll-jump-single-touch-sharp-after.png` 与 `.tmp/ui/native-home-scroll-jump-midbody.png`；相同手势也可能正常，因此必须重复录制，单次未命中不能否定问题。
- 根因不是 DeFi/Earn 异步高度，也不是 Market diffable mutation。`HomeContainerNestedScrollView` 与 `HomeContainerNestedTableView` 同时识别同一纵向 pan，但此前没有手势期 scroll owner。outer 临界 offset 与 inner velocity 的回调时序短暂交叉时，`coordinateOuterScroll()` 或 `coordinateNestedScroll()` 会直接执行 `setBodyContentOffset(0)`，把已经滚到 Support hub 的深层 body 归零。
- 这也解释了问题的偶发性：最终 frame、普通单向 swipe 和编译结果都可能正常；只有 outer/inner 两个 delegate 在边界帧以特定顺序到达时才跳。后续此类 nested scroll 问题必须先录到真实异常，再审计 owner 和每帧 offset，不能用最终截图替代。

### owner-correct 修复

- `HomeContainerView` 新增明确的 `header/body` 纵向 owner。每次真实拖动开始时，根据当前 outer header offset、inner body offset 和 pan velocity 选择 owner；同一手势期间不再由临界回调重新猜测深层内容归属。
- body 仍有 offset 时，outer 被钉在折叠完成位置，只让 inner table 消费位移；inner 真正回到 0 且手指继续下拉后才交给 header。反向上推时，header 真正折叠完成后才交给 body。
- 删除了“outer 未完全折叠且 body > 0 就把 body 直接清零”的深层冲突处理。header owner 下仍允许把同一边界帧产生的微量 inner 位移归零，但它只会发生在手势开始时 body 本来就是 0 的状态。
- tab 完成切换时按目标 page 的真实 offset 同步 owner。refresh control 只在 header owner 下启用；深层 body 手势不能借 outer 的同步 pan 触发刷新。

### 最新 Debug 真机证据

- 最终源码两次都通过仓库根目录的标准 `yarn app:ios` 更新安装；两次均为 `Build Succeeded`、0 error。最终运行的是 `Debug-iphonesimulator/OneKeyWallet.app`，没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。`Account #1`、余额和 Token 列表正常，应用前台持续为 `so.onekey.wallet`。
- 最终 CDP：page 1 为 main，`$$onekeyJsReadyAt=1784208140749`、`$$onekeyUIVisibleAt=1784208142375`，并收到 bg ready payload `runtime=background/status=ready/protocolVersion=1/bootId=1784208142449-4kji658a`；page 2 独立为 `background`。没有用 main ready 代替 bg ready。
- 最终原始录屏 `.tmp/ui/native-home-scroll-fix-final-repeated-gestures.mov` 为 275 个实际帧 / 6.99s，在 Support hub 连续执行 3 组 110pt 下拉/上推。before/after 为 `.tmp/ui/native-home-scroll-fix-final-repeated-before.png` 与 `-after.png`，contact sheet 为 `.tmp/ui/native-home-scroll-fix-final-repeated-contact-sheet.png`。
- 全帧结果 `.tmp/ui/native-home-scroll-fix-frame-analysis.json`：`Support hub` 锚点 `1215 -> 1496 -> 1215px`，最大单帧位移 25px，超过 30px 的突变为 0，最终精确回到初始位置；没有 body 归零、外层跳顶或第二次反向位移。
- 同一 owner 修复还保留了完整 body→header handoff：`.tmp/ui/native-home-scroll-fix-body-header-handoff.mov` 从 Support hub 连续回到包含 `Account #1`、余额与 Tokens 的 Home 顶部，没有冻结在 header/body 边界。
- 录屏边界偶尔出现的蓝色 `Refreshing...` 是 iOS Debug Metro 的 `RCTDevLoadingView`，不是 `UIRefreshControl`，且全帧锚点没有随它变化；不能把 Debug loading overlay 误判成滚动刷新或 offset 跳变。

### Runtime 与资源边界

- **Runtime scope：main。** outer/header offset、inner table offset、手势 owner、tab 同步和 refresh eligibility 都是 Native Home main UI 状态。bg 不拥有 UIKit scroll view，也不参与本次跳变判断。
- main/bg 仍是独立 Hermes heap，独立初始化并通过 proxy 序列化/反序列化业务数据；bg ready 与本次 main per-view 手势状态没有共享 JS 对象或先后依赖。
- 图片/字体 cache、底层存储句柄属于进程级共享 Native 资源；scroll owner、pan velocity、content offset、diffable mutation pin、represented image signature、pressed/hover 属于具体 view/per-view 状态。本轮没有修改 bg service、Market DTO 或持久化数据。

### 本节修改与验收边界

- 本节只修改 `packages/native-components/ios/HomeContainerView.swift` 和本 handoff。诊断时临时扩展过本机 agent-device XCTest runner 以生成不抬手折返轨迹，验收后已恢复原 runner 源码并重新 prepare；该诊断改动不在仓库，也没有修改或重装钱包 App。
- 本节通过的是 iOS Native Home Support hub 深层短拖、连续反向、body/header handoff 和无跳顶。Market 的 Stocks 服务端 logo 成功态、CASHCAT 当前行、Dark mode、pressed/hover、失败回滚注入态等仍按前文保持未完成，不能据此声明整个 Native Home UI 完成。
- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 与指定 Native Home 文件的 `git diff --check` 通过；两次完整 Debug Xcode build 也已经编译该 Swift 文件成功。本节没有修改 TS/JS，因此没有新增聚焦 Jest/ESLint 范围。
- `yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-16T13-31-53-119Z`。`lint-worktree-js`、`lint-staged`、`agent-context` 通过；`lint-worktree-ts` / `tsc-staged` 被共享工作区已有的 Desktop、Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、ReferFriends、Swap、旧 `NativeHomePageView.native.tsx` 等问题阻断，日志没有本轮 Swift/handoff 错误。没有回滚或修改这些无关文件制造绿色结果。

## 2026-07-16 Market Community Recognized 图标映射修复

### A/B 发现与根因

- 用户截图指出 Market 行标题后的绿色 Community Recognized 图标与原版不同。自动 A/B 旧证据 `.tmp/ui/ab-audit-legacy-market-trending-402.png` 与 `.tmp/ui/ab-audit-native-market-trending-402.png` 也显示相同差异：原版是不规则徽章轮廓和点赞留白，Native 是规则齿轮形外圈。
- 原版唯一图形源是 `packages/components/svg/solid/badge-recognized.svg`，React 组件 `packages/components/src/primitives/Icon/react/solid/BadgeRecognized.tsx` 由该 SVG 生成，Market 使用 `BadgeRecognizedSolid`。服务端 `communityRecognized` 字段和 DTO 映射没有错。
- iOS `HomeContainerMarketArtwork.recognized` 此前用 16 组等距内外半径生成规则齿轮，再用两个圆角矩形近似挖出内部图形；Android 当前 WIP 中的 `HomeRecognizedView` 也使用同一规则齿轮近似，且缺少完整点赞 path。因此问题属于两端 Native artwork 几何映射，不是字体、缓存、cell 复用或服务端数据问题。

### 简化实现决策

- 本轮不增加运行时 SVG parser、Android SVG decoder 或通用生成脚本。对于当前单个图标，直接把规范 SVG 的两个精确 path 一次性移植到 UIKit `UIBezierPath` 和 Android `Path`，两端都沿用 SVG 的 `24 × 24` viewBox，再缩放到现有 14/16pt 容器。
- 精确结构包含：不规则外轮廓、`evenOdd` 规则形成的点赞主体留白、以及独立填充的 1pt 竖条。主题色仍由现有 `$iconSuccess` / Native positive color 注入，没有写死绿色，也没有改 DTO 或布局尺寸。
- 如果以后出现第二、第三个需要 React/iOS/Android 三端共用的 Native 图标，再建立“单 SVG 源 → iOS/Android 原生 path 生成”的脚本；当前单图标不先引入额外工具链。

### 最新 iOS Debug 真实证据

- 从仓库根目录执行标准 `yarn app:ios`，结果为 `Build Succeeded`、0 errors，由命令完成 `Debug-iphonesimulator/OneKeyWallet.app` 的签名、更新安装和启动。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。`Account #1`、余额、Token 和 DeFi 数据正常，应用持续前台为 `so.onekey.wallet`。
- 修复后原始截图 `.tmp/ui/market-recognized-native-after-debug.png` 为 1206 × 2622；宽度 402 对照图为 `.tmp/ui/market-recognized-native-after-debug-402.png`。当前 Favorites 中 `UNI / WLFI / SHIB` 三行都显示新的精确徽章，SHIB 行可见不规则外轮廓、点赞留白和独立竖条，修复前规则齿轮已消失。
- 最终 main runtime：`$$onekeyJsReadyAt=1784210700807`、`$$onekeyUIVisibleAt=1784210702406`、background transport ready；bg ready payload 为 `runtime=background/status=ready/protocolVersion=1/bootId=1784210702503-6dl7y333`，独立 background page 报告 `runtime=background` 且 Jotai bridge 存在。没有用 main ready 代替 bg ready。

### Android、runtime 与资源边界

- Android 当前 WIP 的 `HomeRecognizedView` 已同步同一组精确 `Path` 数据，但 `HomeContainerView.kt`、`HomeContainerModels.kt` 和 controller test 在进入本轮前已有大块未提交 Native Home 改动。本轮不能把整份重叠文件误混入 iOS commit；Android path 需要随该 Android WIP 的原 owner 一起完成编译和真实 Android 截图验收，不能用 iOS 截图宣称 Android 已通过。
- **Runtime scope：main UI。** `communityRecognized` DTO 来自 main 的 Market snapshot，Native view 只消费布尔值并渲染本地图形。bg 仍负责 Market config/category/watchlist/service 数据，不拥有该图标 view，也不参与 path 绘制。
- main/bg 是独立 Hermes heap，独立初始化，经 proxy 序列化/反序列化数据；本轮没有新增跨 runtime 共享对象。生成后的模板 `UIImage`、字体和图片 cache 是进程级共享 Native 资源；tint、view frame、represented identity、pressed/hover 和 cell reuse 是 per-view 状态。

### 检查与完成边界

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过，完整 `yarn app:ios` 也真实编译该 Swift 文件成功；指定 iOS/Android Native Home 文件 `git diff --check` 通过。
- `yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-16T14-23-37-670Z`。`lint-worktree-js`、`lint-staged`、`agent-context` 通过；`lint-worktree-ts` / `tsc-staged` 被共享工作区已有的 Desktop、Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、Receive、ReferFriends、Swap、旧 `NativeHomePageView.native.tsx` 等错误阻断，日志没有本轮 Swift/handoff 错误。没有修改或回滚这些无关文件制造绿色结果。
- 本节只通过 iOS Community Recognized 图标映射和最新 Debug 实图。Android 仍缺独立 build/真机截图验收；Stocks 服务端 logo 成功态、CASHCAT 当前行、Dark mode、pressed/hover、失败回滚注入态等继续保持未完成，不能据此声明整个 Market UI 完成。

## 2026-07-16 iOS Wallet 五 Tab Legacy/Native 全页 UI Differ 走查

### 自动对比方法与工具结论

- 本轮继续使用 `1k-ui-verify`：固定 iPhone 17 Pro / iOS 26.5、同一 `Account #1`、同一 Ethereum 网络和当前 Debug Metro 数据，只临时把 `nativeHomeFeatureFlag.native.ts` 切到 `false` 采集 legacy；采集完已恢复 `enabledByDeveloperMode && isHomeContainerAvailable()`，该文件最终零 diff，默认仍是 Native Home。
- Ethereum 下 legacy 与 Native 都有 Spot / Perps / DeFi / NFT / History，分别采集 `00-top / 01-body / 02-mid / 03-lower / 04-bottom` 共 25 组原图；每张原图为 1206×2622，并统一缩到 402×874 后比较。History 额外采集筛选面板打开态。
- 直接使用 `agent-device diff screenshot --threshold 0.08` 生成像素差、差异区域、文字 frame delta 和疑似缺失 icon/chevron；同时在 `.tmp/ui/home-tabs-diff/analyze.py` 生成 absolute heatmap、edge differ、三列 comparison 和五阶段 contact sheet。原图在 `.tmp/ui/home-tabs-diff/legacy/`、`.tmp/ui/home-tabs-diff/native/`，产物在 `.tmp/ui/home-tabs-diff/diff/`。
- 五张同锚点顶部截图的 agent-device mismatch 为：Spot 9.34%、Perps 6.72%、DeFi 8.81%、NFT 6.24%、History 10.12%。自定义 edge differ 也把 History 排为差异最大项。该数字只用于定位排序，不是 UI 完成率；Perps 的大块纯白空占位反而会降低像素差百分比，动态价格、余额、轮播图和异步 NFT 图片也必须从语义结论中排除。
- 汇总证据：
  - `.tmp/ui/home-tabs-diff/diff/spot-contact-sheet.png`
  - `.tmp/ui/home-tabs-diff/diff/perps-contact-sheet.png`
  - `.tmp/ui/home-tabs-diff/diff/defi-contact-sheet.png`
  - `.tmp/ui/home-tabs-diff/diff/nft-contact-sheet.png`
  - `.tmp/ui/home-tabs-diff/diff/history-contact-sheet.png`
  - `.tmp/ui/home-tabs-diff/diff/metrics.json` 与 `tab-summary.json`
  - 各 Tab 顶部内置差异图为 `.tmp/ui/home-tabs-diff/diff/<tab>-00-agent-device.png`。
- 这套流程对稳定几何、字体、缺失组件和内容语义非常有效，后续继续作为 Native Home 主要走查方法。滚动 owner、pressed、Tab 连续切换和点击跳转仍需真实触摸录屏/多帧；相同 `scroll` 命令落到不同 nested scroll owner 时，后续阶段截图只能作为问题线索，不能单独宣称滚动通过或失败。

### P1：Tab 能力、共享 Header 与 Tab 样式不一致

- **All Networks 能力 gating 不一致。** legacy 在当前 All Networks 只显示 Spot / NFT / History，`home-tab-perps` 与 `home-tab-defi` 不存在；证据为 `.tmp/ui/home-tabs-diff-legacy-return.png`。Native 恢复 All Networks 后仍显示五个 Tab；证据为 `.tmp/ui/home-tabs-diff/native/all-networks-restored-2.png`。源码原因是 legacy `HomePageView.tsx` 使用 `isPerpsEnabled / isDeFiEnabled / isNFTEnabled` 过滤配置，而 Native `initialTabs` 无条件遍历全部 `HOME_CONTAINER_TAB_IDS`。必须复用相同 capability gating，不能因为 Native 有空页面就强行展示。
- **折叠 Header 缺组件。** legacy 折叠后仍在 Search 与 Tab 之间保留 compact `Account #1`、copy 和当前 network；Native 折叠时整个 account/network row 被移走，Tab 直接贴在 Search 下方。因此 Perps、DeFi、NFT、History 的 Native 顶部都比 legacy 提前约一个 compact row，高度差不是单个 section padding。
- **Tab 字体和高度明确不一致。** legacy text variant 固定 `$headingLg` 18px，选中 weight 600、未选中 500，可点击 item 实测约 36pt；Native `HomeContainerTabsView` 固定 15pt system semibold，所有状态只有颜色变化，容器固定 52pt。完整 Spot 同锚点图中 Native Tab 和 Tokens 内容整体比 legacy 提前约 35–50pt。后续应先统一 font/weight/item height/header total height，再做下方像素差，不能用整体 crop 平移掩盖真实高度问题。

### P1：Perps、DeFi 与 History 的组件/功能缺失

- **Perps 不是样式小差异，而是主组件缺失。** legacy 有 `Perps · $10.26`、Deposit、Name/Balance、Value/PNL、USDC 10.256 和 Hot Markets；Native 顶部全部缺失，只在约 1100pt 空白后出现 Hot Markets。源码中 empty `perps-state` 在 initialized 且 itemCount 为 0 时使用 `displayHeight: 1100`，同时仍追加 supplemental Hot Markets，正好形成实图中的大块空占位。需要先查清 Native `perps.view`/holdings 为何没有得到 legacy 同一份 USDC 数据，再修 empty-state 与 supplemental section 组合；禁止继续猜 padding。
- Native Perps Hot Markets 的 ONDO / SNDK / SPCX / SILVER 被压成 `ON... / SN... / SP... / SIL...`，legacy 完整显示；Native 也没有 legacy 底部可见的 View more。Deposit 和 View more 因组件缺失无法做点击验收。
- **DeFi 快捷操作缺失。** legacy Aave V3 有 Withdraw / Repay，Sky 与 Fluid 有 Withdraw，Uniswap V4 有 Remove & Claim rewards；Native 每行只剩 chevron，相关操作入口没有 DTO/renderer。legacy 行之间还有 separator，Native 全白连续排列。协议名称、position 数和净值本身一致，Show more 也存在，因此问题集中在行内 action 与 row style，而不是 DeFi service 数据整体丢失。
- **History 展示语义没有复用原版。** 同一条交易 legacy 显示 `Revoke USDC allowance / Uniswap`，Native 显示 `Approve / Revoke USDC allowance + Success`；legacy Swap 显示应用名和双向资产，Native 多处退化为 `Unknown / Swap` 与单边 transfer。Native 还给全部 confirmed row 增加 Success badge，单屏密度、icon 组合和 value/detail 都与原版不同。
- History 日期 legacy 使用本地 `07/16/2026`，Native 写死 `yyyy/MM/dd` 为 `2026/07/16`；Native 在无应用描述时用时间作 subtitle，legacy 使用地址/协议显示规则。这里应复用 `TxHistoryListView` 的 display adapter/formatter，而不是继续扩展另一套近似 `getHistoryTitle/getHistoryTransferDisplay`。
- History filter 可以真实打开，但 Native Dialog 缺少原版两段说明文字，也缺 `filterScamHistorySupported` 的 network gating/disabled 状态；因此面板高度明显更短，且在不支持网络上会错误允许风险过滤开关。legacy 证据为 `.tmp/ui/home-tabs-diff/legacy/history-filter-open.png`，Native 为 `.tmp/ui/home-tabs-diff/native/history-filter-open.png`。

### P2：Spot 与 NFT 的稳定视觉/降级差异

- Spot 完整 Header 的账户、network、余额、Send/Receive/Buy & Sell/More 和 banner 都存在；同时间余额为 legacy `$21.56`、Native `$21.55`，属于实时刷新噪声，不列为缺失。
- 单链 Ethereum 下 legacy Token icon 不叠 network badge，Native 每行仍叠 Ethereum badge；legacy ETH 标题后还有行内 asset accessory，Native 缺失。Native 价格格式被压到两位，例如 legacy cUSD `$0.9998`，Native `$1.00`，需要与原版 token price formatter 对齐。
- NFT legacy 不显示额外 section 标题，Native 在已选中的 NFT Tab 下又增加一行 `NFT`，造成冗余高度。图片失败时 legacy placeholder 有 broken-image indicator，Native 只有空灰块；metadata name 为空时 legacy 显示 `-`，Native 回退到 itemId（如 `125656/116659`）。Native 单链 NFT 卡也额外叠 Ethereum badge。真实已加载的 `Ten Years Of Ethereum` 图片两边均能显示，说明不是整个 Native 图片 loader 失效。

### 交互、恢复现场与完成边界

- 五个 Tab 都通过截图后立即点击真实切换，选中态与对应内容变化可见；History filter 可打开。DeFi 行内快捷操作、Perps Deposit/View more 在 Native 根本不存在，无法记为交互通过。NFT 详情、History 详情、load-more、Tab 横滑、连续切换 offset、Dark mode 和动态字体仍需下一轮录屏/交互证据。
- 采集后已通过正常 UI 的 All networks selector 与底部确认按钮恢复 All Networks，没有清理或直接改持久化数据。Native Home flag 已恢复，当前截图 `.tmp/ui/home-tabs-diff/native/all-networks-restored-2.png` 显示 `BTC / ETH / +16`、余额 `$54.38` 和资产列表，钱包数据正常。
- 当前前台 bundle 仍为 `so.onekey.wallet`。最新 Hermes page 1 为 main：`$$onekeyJsReadyAt=1784216449365`、`$$onekeyUIVisibleAt=1784216451289`，并收到独立 bg ready payload `runtime=background/status=ready/protocolVersion=1/bootId=1784216450931-61myhbqk`；page 2 独立报告 `runtime=background`。没有用 main ready 替代 bg ready。
- 本轮没有执行 uninstall、reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。本轮是当前 Debug 包上的 Metro A/B 审计，没有 Native/TS 实现修改，因此没有重复运行 `yarn app:ios`；当前安装包仍来自前文最后一次标准 `yarn app:ios` Debug build，不涉及 Release、自定义 `xcodebuild` 或关闭签名。
- **Runtime scope：main UI + bg 数据读取。** Tab/Header/layout、截图、filter Dialog、section renderer 和 per-view scroll/represented state 属于 main；Perps/DeFi/History/portfolio service 数据来自 bg，经 proxy 序列化到独立 main Hermes heap。main/bg 初始化独立，不能假设 bg 先 ready。图片/字体 cache 与底层持久化句柄是进程级共享 Native 资源；cell constraint、represented image signature、request cancellation、Tab selected/pressed 和 scroll owner 是 per-view 状态。
- 本轮只新增 handoff 审计记录；`.tmp/ui/home-tabs-diff/analyze.py` 与全部图片是 ignored 临时证据，不进入提交。Android 没有新增修改或验收。本轮不修复这些跨模块差异，下一轮优先顺序为：capability gating + Tab/Header metrics → Perps 数据/空态 → History 复用原版 display/filter → DeFi inline actions → Spot/NFT 细节；每组修复后重新执行同锚点 differ 与真实触摸录屏。未完成这些项前不得声明 Wallet 五 Tab 或整个 Native Home UI 完成。
- 指定 Native Home 文件的 `git diff --check` 通过。本轮无实现代码变更，因此没有新增 Swift/Jest/ESLint 聚焦范围。`yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-16T16-04-31-814Z`：`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` / `tsc-staged` 被共享工作区已有的 Desktop、Receive、Swap、Discovery、Rspack、DeFi、TradingView、WebView、Navigator、AppUpdate、Firmware、ReferFriends 和旧 `NativeHomePageView.native.tsx` 等错误阻断，日志中没有本轮 handoff 错误。没有回滚或修改这些无关文件制造绿色结果。

## 2026-07-17 iOS Wallet 五 Tab 集中修复与最终 Debug A/B 复测

### 主要走查方式与有效性

- 后续 Native Home 视觉验收默认使用本轮验证有效的同状态 A/B：固定同一 simulator、Debug 包、账户、网络、服务端 config 和滚动锚点，临时把 `nativeHomeFeatureFlag.native.ts` 切到 `false` 采集 Legacy，再恢复原表达式采集 Native；该 flag 本轮结束时为零 diff，默认仍使用 Native Home。
- 稳定页面同时保留 1206×2622 原图和宽度 402 对照图，用 frame bounding box 先校正几何，再用 absolute RGB heatmap、edge differ 和三列 comparison 排查字体、尺寸、间距、缺失组件与内容语义。动态价格、余额、轮播和异步图片先从稳定 ROI 排除，不能为了降低差异率裁掉真实组件。
- 交互和结构变化继续使用真实触摸录屏/多帧，检查首帧、单向位移、content offset 和最终业务状态。DeFi/Earn 异步改变 y 后的旧坐标、误进详情页、服务短时掉线以及 Debug toast 覆盖的帧一律作废，不能作为通过或失败证据。
- 该方法本轮非常有效：同一 BNB 账户 Spot 顶部的 `mean_abs_rgb` 从 15.641 降到 4.812，`edge disagreement` 从 11.381% 降到 2.925%，`pixels_changed_ge_16` 最终为 4.434%。最终三列证据为 `.tmp/ui/home-tabs-diff/diff/spot-final-installed-debug/comparison.png`。剩余差异主要是实时价格、网络图片 frame 和 Debug toast，而不是继续用整体 crop 平移掩盖的 Header 高度。
- 自动 differ 先后定位出 Native 资产顺序不一致、余额基线、Header 横向 inset、Action/Banner 尺寸和间距、Tab 基线、asset row 高度等问题；这些并不是只看编译或最终 settled frame 能可靠发现的问题。因此本流程正式作为后续 Native Home 的主要走查方式，但 pressed/hover、滚动 owner、连续切换、失败回滚和降级态仍必须保留录屏/多帧及业务状态证据。

### 本轮集中修复

- Spot 资产改为复用 `sortTokensByFiatValue` 后再截取 Native 行数。同一 BNB 账户 Legacy 的 `USDT / USDC / BNB` 与 Native 最终顺序一致，不再按原数组得到 `BNB / USDT / USDC`。
- Header 横向 inset 对齐到 20pt；Action strip 对齐为 62pt，Action 到 Banner 间距、Banner 88pt 高度、280pt 宽度、16pt 内边距、56pt 图片和 12pt 内容间距均按 Legacy 实测收敛。Tab/toolbar 上移 8pt，Tab header 为 60pt；普通资产行、Market、Earn、Add token 为 56pt，asset section header 为 60pt。
- 余额整数和小数使用相同 48pt line-height，并在 Native slot 内下移 11pt。最终 bbox 与 Legacy 均为 y=182…222；Tabs、首行 Token 和后续 asset step 也已逐帧对齐。
- 五 Tab capability 改为复用 Legacy 的网络能力判断；Perps 在 scope 首次进入前预取并显示真实 USDC holding、Deposit、Hot Markets 和 View more，不再用 1100pt 空白占位。DeFi DTO 增加原版支持的 Withdraw、Repay、Remove/Claim 等行内 action/badge 语义。
- NFT 移除重复 section 标题，单链不再额外叠 network badge，空名称使用 `-` 而不是 itemId。Spot 单链同样不再叠 network badge，价格改用原版精度 formatter，ETH 等资产的 accessory icon 通过 DTO 映射。
- History 改为原版日期、approve/revoke、应用/协议、转账 action 和 network badge 语义；confirmed 行不再统一伪造 Success badge。Scam filter 按网络能力 gating，并补齐 Dialog 说明。当前实现仍应继续对更多交易类型做同状态样本审计，不能由少量 History 行外推全部 formatter 已覆盖。
- Native iOS renderer 同步修正 section/header/frame、Tab、Banner、Perps/DeFi/History/NFT 辅助组件和 row accessory；TS/Swift model 增加所需 `titleAccessoryIcon` 与 `badges` 序列化字段。controller test 覆盖 Market category 在原子 patch 中保持选中态，避免 section 刷新把分类首帧切回 Favorites。

### 最终 `yarn app:ios` Debug 证据

- 所有最终源码修改后从仓库根目录执行标准 `yarn app:ios`，结果 `Build Succeeded`、0 errors、11 warnings；由该命令完成 `Debug-iphonesimulator/OneKeyWallet.app` 的签名、更新安装并启动 `so.onekey.wallet`。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或任何持久化数据。`Account #1`、BNB 网络、余额、USDT/USDC/BNB 资产和非零持仓正常，应用持续前台存活。
- 最终 main runtime probe 报告 `runtime=main`、`$$onekeyJsReadyAt=1784228762367`、`$$onekeyUIVisibleAt=1784228763866`。日志分别记录 `SharedStore and SharedRPC installed in main runtime`、`installed in background runtime`、`bg hostDidStart total setup in 4114.9ms`、`backgroundApiProxy ready in 1367ms (+2191ms)` 和 bg transport ready；独立 background target 存在。main/bg 均 ready，且没有用 main ready 代替 bg ready。
- 最终顶部截图为 `.tmp/ui/home-tabs-fix/native-bnb-final-installed-debug.png`；五 Tab 连续切换原始录屏为 `.tmp/ui/home-tabs-fix/native-bnb-five-tabs-final-installed.mp4`。最终安装包中 Perps 为 `.tmp/ui/home-tabs-fix/native-bnb-perps-final-installed.png`，DeFi 为 `native-bnb-defi-final-installed.png`，NFT 为 `native-bnb-nft-final-installed.png`，History 为 `native-bnb-history-final-installed.png`。这些证据通过的是五个 Tab 的真实选中态、内容首帧和本轮修复后的稳定页面，不替代 Dark mode、动态字体、所有详情跳转或失败态验收。

### Market 最新 Debug 复测

- 必需截图已经以最终 Debug 验收命名保留：`.tmp/ui/handoff-ui-market-favorites-after-debug.png`、`-favorites-after-debug-402.png`、`-trending-after-debug.png`、`-trending-after-debug-402.png`、`-stocks-after-debug.png`、`-stocks-after-debug-402.png`。旧 verified 图只用于对照，没有用于声明新修改通过。
- Favorites 实图中 UNI/WLFI/SHIB 未再出现异常单字符或 `...` 压缩；LINK 位于该截图 crop 上方，仍需在后续完整四行同帧证据中继续保留核对。前文 Add 4 recommendations 和 Favorites 删除的逐帧/权威 bg 证据继续有效。
- Trending 中 CASHCAT 可完整显示。BTC 第二行没有虚构 volume；运行时 DTO 探针得到原始 `volume24h: "-"`，归一化后为 falsey，Legacy 同样隐藏，因此当前属于服务端数据状态，不允许加假占位。
- Stocks 中 Apple、iShares Silver Trust、Circle 均加载真实服务端 logo，没有落到 CryptoCoin fallback，也没有复用串图。当前证据证明本次候选成功态；全部候选失败、取消请求与缓存失效的降级态仍需独立注入或真实失败样本。
- Market 分类连续切换有效录屏仍为 `.tmp/ui/home-tabs-fix/native-market-categories-final-correct.mp4`：Favorites、Trending、Stocks 点击后首帧已有缓存行，没有观察到 `rows -> empty -> rows`。本轮末尾尝试用已经漂移的旧坐标补拍时发生滚动 owner/页面误命中，该段已作废，不覆盖有效证据。
- `perpsCategories.hot` 是动态服务端 config；本次运行环境后来出现 Hot/Perps 时按真实 config 展示，缺少时 Legacy/Native 均不展示。Native 没有为了截图写死 Perps，不能把某一次 config 状态当成固定产品能力。

### Runtime、资源所有权与完成边界

- **main runtime：** Native Home UI、Tab/Market selection、display cache、snapshot/section patch、per-view scroll owner 与 renderer 状态。**bg runtime：** Market config、category、watchlist 与 Perps/DeFi/History/portfolio 等 service 数据和权威持久化。
- iOS main/bg 使用独立 Hermes JS heap，各自独立初始化；跨 runtime 数据通过 proxy 序列化和反序列化，双方持有独立副本，不能共享 JS 对象或假设 bg 先 ready。图片/字体 cache 和底层持久化句柄是进程级共享 Native 资源；cell constraint、represented image signature、request cancellation、selected/pressed/hover、diffable mutation pin 和 scroll owner 是 per-view/main 状态。
- 本节通过的是最终 Debug 包中的稳定五 Tab 页面、集中几何修复、同账户资产顺序、已列出的 Market 成功态与连续分类切换。Dark mode、动态字体、所有 pressed/hover、完整横滑、所有失败回滚/离线/Watch/Risk Alert 降级态和更多 History 交易类型仍没有全量真实证据，因此不能声明 Native Home 或整个 Market UI 已完成。

### 检查门禁

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过；聚焦 Prettier 通过。聚焦 type-aware Oxlint 为 0 warning / 0 error；`nativeHomeDataAdapters.test.ts` 与 `HomeContainerController.test.ts` 共 2 suites / 17 tests 通过。
- 一次错误使用 `yarn eslint <files>` 时仓库脚本忽略文件参数并扫描全仓，输出 281 个既有 error / 9 warnings，分布于 CLI、Desktop、TradingView、Swap 等无关范围；随后使用正确的聚焦 `npx oxlint --tsconfig ./tsconfig.json --type-aware --deny-warnings` 验证本轮 6 个 TS 文件为绿色。没有回滚或修改无关代码制造结果。
- 最终 staged 内容的 `yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-16T19-26-37-089Z`。`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` 仍由共享工作区既有的 Desktop/Discovery 测试等问题阻断，`tsc-staged` 剩余 12 errors / 10 files，均位于 DeFi、TradingView、WebView、Navigator、AppUpdate、ChainSelector、Firmware、旧 `NativeHomePageView.native.tsx`、ReferFriends 和 Swap。本轮第一次 profile 暴露的 4 个 `nativeHomeDataAdapters.test.ts` fixture 类型错误已经修复，最终日志不再包含本轮 `NativeHomePage.native.tsx`、adapter、controller 或 native-components 错误。

## 2026-07-17 iOS Wallet Perps / DeFi / NFT / History 等状态最终复比

### 等状态 A/B 与自动 differ 结论

- 本轮继续使用已经验证有效的主要走查方式：同一 iPhone 17 Pro simulator、`Account #1`、BNB 网络、Debug 包和服务端数据，Legacy 与 Native 分别从完整 Header 开始，按 Perps、DeFi、NFT、History 顺序截图；Native 额外保留连续切换录屏。Legacy 采集期间只临时把 `nativeHomeFeatureFlag.native.ts` 设为 `false`，完成后恢复原表达式，最终该文件为零 diff，新首页仍是默认路径。
- Legacy 原图位于 `.tmp/ui/home-tabs-recompare-20260717-final/legacy/`；最终 Native 原图为 `perps-top-latest.png`、`defi-top-latest.png`、`nft-top-latest.png`、`history-top-latest.png`。四个 Tab 连续真实点击录屏为 `.tmp/ui/home-tabs-recompare-20260717-final/native/four-tabs-final.mp4`（492 个实际编码帧 / 16.4s），不是用元素存在或编译通过替代交互证据。
- 宽度 402 的三列 comparison、absolute heatmap 和 edge differ 位于 `.tmp/ui/home-tabs-recompare-20260717-final/diff/<tab>/comparison.png`。最终顶部 `mean_abs_rgb / pixels_changed_ge_16 / edge disagreement` 分别为：Perps `6.008 / 5.308% / 3.870%`，DeFi `7.866 / 6.286% / 5.071%`，NFT `2.500 / 2.259% / 1.313%`，History `9.936 / 7.422% / 4.931%`。这些数字只用于排差优先级；实时价格、余额、交易新增时间和异步图片会制造差异，不能解释为完成率。
- History body 的 raw pixel differ 因两边滚动距离和新增交易不同而不可比较，已明确判为无效数值，不用于通过或失败。有效做法是分别核对固定 compact Header / Tab frame，再逐行核对同一交易语义。Legacy 多次旧坐标误点到 Spot/DeFi、Native 后续尝试滚 DeFi footer 时误进 Pendle 详情并打开 Search 的帧同样全部作废。

### 本轮集中修复与真实结果

- Perps holding 按原版恢复为 `USDC / 10.256 / $10.26 / PNL`，叠 HyperEVM badge；Hot Markets 使用独立 Perps renderer、Roobert 字体、完整 symbol、蓝色 leverage badge、原版价格精度与涨跌色，不再沿用 Market 列约束。真实最终图中 `kBONK / SILVER / ONDO / EIGEN / SPCX` 均未出现 `ON...` 等异常截断，Deposit、真实 holding 和 Hot Markets 同时存在。
- Perps 与 DeFi 的 Native slot 补齐 Upgrade / Support hub；Perps Support 使用 Trading Guide 链接。DeFi 当前 BNB 实际服务数据与 Legacy 都是 `Bitway Earn / 5 Positions / $10.01` 和 `Pendle V2 / 2 Positions / $1.68`，Native 显示顺序、separator、数值和 chevron 一致；当前样本不存在可直接显示的行内 Withdraw/Repay action，不能用其他网络的旧样本强行判失败。
- NFT 当前 BNB 是真实空态。Native 与 Legacy 都显示 `No NFTs / No NFTs found at this address`；移除了重复 NFT section 标题，空态/卡片使用 Native theme 的 strong color，卡片 collection/title 改为 Roobert，单链 network badge 语义保持与 Legacy 一致。该结论只覆盖当前空态，不覆盖图片全部失败或 NFT 详情跳转。
- History main 从 bg snapshot 同时接收 `addressMap`，按 network/address key 恢复 PancakeSwap、Bitway 等原版应用标签；send/receive target、approve spender、function/unknown target 都使用相同规则。Swap 恢复发送/接收双图标、双边 amount，`Unlimited` 使用与 Legacy 相同翻译，日期、68pt 行高、分组间距和 Roobert 16/14 typography 对齐。
- 最终 History 实图真实显示 `Request withdrawal / Bitway / -0.0009608 bwUSDT`、`Send / 0x5cb306...cbe28e`、`Approve / PancakeSwap / Unlimited`、`Revoke USDC allowance` 和 Swap 双图标；`Request withdrawal` 不再被截断。对应顶部为 `history-top-latest.png`，收起后为 `history-small-pan-account-inset.png`。
- 折叠 Header 根据 A/B 实测把 compact height 从 48pt 调整为 60pt，并给 pinned account row 保留 16pt top inset。History 短上滑录屏为 `.tmp/ui/home-tabs-recompare-20260717-final/native/history-small-pan-account-inset.mp4`（380 个实际帧 / 12.67s）；转场 90 帧 contact sheet 为 `history-small-pan-account-inset-transition-all-frames.png`。可见 full Header 到 compact account/Tab/rows 只做连续单向位移，Market/History 内容全程存在，没有 blank/loading，也没有瞬间跳回顶部。

### 最终 Debug、运行时与数据安全

- 最后一处 compact account inset 修改后，重新从仓库根目录执行标准 `yarn app:ios`；结果 `Build Succeeded`、0 errors、11 warnings，并由该命令更新安装 `Debug-iphonesimulator/OneKeyWallet.app`、启动 `so.onekey.wallet`。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。最终 appstate 前台仍为 `so.onekey.wallet`；`Account #1`、BNB 网络、`$23.47` 余额、USDT/USDC/BNB 资产和 Perps/DeFi 非零仓位均正常，应用持续存活。
- 最终 main probe：`runtime=main`、`jsReadyAt=1784260244937`、`uiVisibleAt=1784260246536`、`backgroundTransportState=ready`。独立 bg ready payload 为 `runtime=background/status=ready/protocolVersion=1/bootId=1784260246629-i4vk3j7r/ts=1784260246941`，独立 background target 的 Jotai bridge 存在；没有用 main ready 代替 bg ready。
- **main scope：** Native Home Header/Tab/UI、Perps/DeFi/NFT/History display adapter、selection/cache/snapshot/section patch、scroll owner 和 compact pin。**bg scope：** Perps/DeFi/History/portfolio/Market service 数据、address map 与权威持久化。iOS main/bg 是独立 Hermes JS heap，proxy 数据分别序列化/反序列化，各自持有副本，初始化顺序独立。
- 图片/字体 cache 和底层持久化句柄是进程级共享 Native 资源；cell constraint、represented image/favorite signature、request cancellation、paired icon frame、selected/pressed/hover、compact transform 与 scroll owner 是 per-view/main 状态。

### 检查与剩余边界

- `xcrun swiftc -parse HomeContainerView.swift HomeContainerModels.swift` 通过；指定 Native Home 文件的 `git diff --check` 通过；5 个 TS 文件的 type-aware Oxlint 为 0 warning / 0 error；聚焦 Prettier 通过。
- 聚焦 Jest `nativeHomeDataAdapters.test.ts` 与 `HomeContainerController.test.ts` 共 2 suites / 18 tests 全部通过；新增覆盖 Perps holding DTO、History addressMap 标签和双图标顺序。
- 最终 staged 内容执行 `yarn agent:check --profile commit`，日志为 `node_modules/.cache/agent-checks/2026-07-17T04-02-37-678Z`。`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` 被共享工作区既有 Desktop、Receive、TokenList、Discovery、Swap 等 2 warnings / 10 errors 阻断，`tsc-staged` 被 DeFi、TradingView、WebView、Navigator、AppUpdate、ChainSelector、Firmware、旧 `NativeHomePageView.native.tsx`、ReferFriends 和 Swap 共 12 errors / 10 files 阻断。日志中没有本轮 `NativeHomePage.native.tsx`、adapter、history hook 或 native-components 文件错误；没有修改或回滚这些无关文件制造绿色结果。
- 本节通过的是当前 BNB 服务状态下四个 Tab 的顶部内容、实际数据语义、连续切换与 History full-to-compact 短滑。Dark mode、动态字体、所有 pressed/hover、所有 History 交易类型、NFT 图片失败/取消请求、DeFi/Perps 详情跳转、失败回滚和离线降级仍没有完整真实证据，不能据此声明 Native Home UI 已全部完成。

## 2026-07-17 iOS 17.4+ body → header 向下惯性连续传递

### 复现、失败标准与二次根因

- 用户在最终 Debug 包中确认了一个方向不对称问题：手指向上滑、由 Header 进入 body 时有正常惯性；页面已经滚到 DeFi / Upgrade / Support hub 后，手指向下轻扫、由 body 返回 Header 时只移动接触距离，松手后的惯性在 body 顶部被截断。
- 稳定复现方式是在 DeFi 的 Support hub 锚点，使用同一条 120pt / 90ms 真实触摸：`(380, 520) -> (380, 640)`。旧实现的 nested `UITableView` 先减速到自身 `contentOffset = 0`，随后 outer `UIScrollView` 才获得 header owner；这时 pan velocity 已经归零，因此无法继续展开 Header。仅看最终 Header 是否出现、只做长拖动，或只验证向上方向都不能证明修复。
- 第一版只在 iOS 17.4+ 显式设置 `transfersVerticalScrollingToParent = true`，编译和 Debug 安装均成功，但用户实测仍然是“向上有、向下没有”，因此该版明确判失败。Apple SDK 中该属性从 iOS 17.4 提供且默认已经为 true；当前 Native Home 同时还有手写 owner、clamp 和两个 deceleration owner，系统 edge transfer 不能单独维持同一条速度时间线。
- 成熟的 JXPagingView / JXPagingSmoothView 一类方案通过单一 list scroll view 移动并 pin header，从结构上避免两个纵向 physics owner。Native Home 当前页面与 Nitro section patch 耦合较深，本轮没有引入新依赖或重写整个容器，而是只修复跨越 body → header 的一次减速交接。

### iOS 17.4+ 实现与低版本边界

- `scrollViewWillEndDragging` 读取真实 release velocity 和 UIKit 的 deceleration rate。只有 selected page、当前 owner 为 body、手指向下速度超过 80pt/s、body/outer 都有可消费 offset，且预计减速距离确实会跨过 body 顶部时，才拦截内层目标 offset。
- iOS 17.4+ 使用一个 `CADisplayLink` 和同一条 UIScrollView deceleration 曲线：先连续消费 body offset，剩余 travel 在同一帧序列中继续消费 outer header offset。跨界后 owner 切为 header；新手势、页面切换、完成最大 travel 或速度衰减结束都会停止 handoff。向上和不跨界的手势仍走 UIKit 原生减速，没有被这条路径接管。
- 这是 main runtime 的 per-view UIKit 状态，不经过 bg proxy，也没有新增共享 Native singleton。`VerticalMomentumHandoff`、display link、scroll owner、offset 和 gesture state 都归当前 `HomeContainerView`；图片/字体 cache 和底层持久化资源仍是进程级共享资源。
- 按用户决定，iOS 17.4 以下继续保留旧的 per-scroll-view 边界体验，不为旧系统复制自定义减速物理。源码英文注释明确记录：17.4+ 使用一条跨 body/header 的 deceleration timeline，旧版本保留现有行为。

### 最终 Debug 双向真实触摸证据

- 最终源码后重新执行标准 `yarn app:ios`，结果 `Build Succeeded`、0 errors、11 个既有 warnings；命令完成 Debug build、签名、更新安装并启动 `so.onekey.wallet`。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 向下跨边界有效录屏为 `.tmp/ui/native-home-inertia-17_4/handoff-v2-down-120pt-90ms.mp4`，触摸遥测为同目录 `handoff-v2-down-120pt-90ms.gesture-telemetry.json`，before/after 和 contact sheet 分别为 `handoff-v2-before.png`、`handoff-v2-after.png`、`handoff-v2-down-120pt-90ms-contact.png`。松手后页面继续移动数百点，从 compact Support hub 连续经过 body 顶部并展开完整 Header，显著超过 120pt 接触距离；逐帧可见内容连续，没有 blank/empty、瞬间跳顶或反向回弹。本场景通过。
- 向上回归录屏为 `.tmp/ui/native-home-inertia-17_4/up-regression-120pt-90ms.mp4`，遥测、before/after 和 contact sheet 使用同名前缀。`(380, 640) -> (380, 520)` 松手后继续从完整 Header 滚入 DeFi / Upgrade / Support 内容，没有丢失原有向上惯性，也没有 blank 或跳变。本场景通过。Support carousel 在录制过程中异步切换 Sifu / Quiz 是原版业务轮播，不是空态或滚动回弹。
- 两段手势、截图、开始录制和结束录制放在同一个 `agent-device batch`，避免 daemon/session 漂移；分离命令导致 session 消失的旧点击证据已作废，没有用于通过结论。

### 运行时、数据安全与完成边界

- 最新 main probe：`runtime=main`、`jsReadyAt=1784270673395`、`uiVisibleAt=1784270675072`、`backgroundTransportState=ready`。独立 bg ready payload 为 `runtime=background/status=ready/protocolVersion=1/bootId=1784270675125-tlbjdcng/ts=1784270675454`；独立 background target 的 Jotai bridge 存在。main/bg 均 ready，没有用 main ready 代替 bg ready。
- `Account #1`、BNB 网络、余额、资产和 DeFi 内容正常，watchlist 权威读取仍为 4 条，app 持续存活。没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。
- **main runtime：** Native Home UI、selected page、outer/body offset、scroll owner 和本轮 per-view momentum handoff。**bg runtime：** Market/watchlist/portfolio/DeFi 等 service 数据和权威持久化。iOS main/bg 为独立 Hermes JS heap，proxy 数据各自序列化/反序列化，初始化顺序独立；本轮滚动物理不跨 runtime。
- 本节只通过 iPhone 17 Pro / iOS 26.5 Debug 包上的向下跨边界惯性和向上回归。iOS 17.4 以下按产品决定接受较弱体验；Dark mode、动态字体、所有横滑/pressed/hover、所有降级态和 Native Home 其余未完成项不由本节覆盖，仍不能声明整个 Native Home UI 已完成。

### 检查门禁

- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 通过；指定 Native Home 文件的 `git diff --check` 通过。纯 Swift per-view 滚动物理没有新增 TS/Jest 聚焦范围，最终 Debug 编译与双向真实手势是本轮风险相称的主要验证。
- 最终 staged 内容执行 `yarn agent:check --profile commit`，日志为 `node_modules/.cache/agent-checks/2026-07-17T06-50-30-405Z`。`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` 被共享工作区既有 Desktop、Receive、Discovery、TokenList、Swap 等 2 warnings / 10 errors 阻断，`tsc-staged` 被 DeFi、TradingView、WebView、Navigator、AppUpdate、ChainSelector、Firmware、旧 `NativeHomePageView.native.tsx`、ReferFriends 和 Swap 共 12 errors / 10 files 阻断。日志中没有本轮 Swift/handoff 错误；没有修改或回滚这些无关代码制造绿色结果。

## 2026-07-17 重新打开：Support hub 边界双向惯性手感仍失败

### 用户实测与旧结论降级

- 用户在 iPhone 17 Pro / iOS 26.5 最新 Debug 包中再次确认：页面处于 compact account + DeFi 首行 + Upgrade + Support hub 同屏的位置，从 Support hub 标题右侧空白区域起手，无论向上还是向下短甩都没有原版的自然惯性，上一节“向下跨边界惯性和向上回归通过”的结论必须降级，当前问题仍为失败。
- `2026-07-16 iOS Native Home 纵向滚动 owner 与 Support hub 跳顶修复` 的旧自动验收只执行 3 组固定 110pt 下拉/上推，并检查 `Support hub` 锚点是否出现超过 30px 的单帧跳变、最终是否回到原位。该证据只证明“没有直接跳回 body 顶部”，没有量测松手后的 travel、velocity decay 或 deceleration duration，因此不能证明惯性正确。
- 上一节的 120pt / 90ms 录屏只证明某一次 body → header 路径在松手后仍继续移动，并且向上路径没有 blank/jump；它没有固定在用户红框起点分别比较双向原版速度曲线，也没有检查 handoff 与 UIKit 原生减速的距离/时长是否一致，因此不能再作为手感通过证据。

### 提交历史与引入链路

- 根架构由 `f752d0f138`（`fix: stabilize native home paging and refresh`）引入：原来的 container interaction pan 被替换为 outer `HomeContainerNestedScrollView` + per-page `HomeContainerNestedTableView`，两者 simultaneous recognition，并各自保留 UIKit tracking/deceleration。这产生了两个纵向 physics owner，边界交接从此必须额外协调。
- 当前惯性边界问题的直接引入点是 `a61b94335f`（`fix: stabilize native home vertical scrolling`）。该提交为了修复 Support hub 深层内容偶发直接跳回 body 顶部，新增固定 `header/body` owner；手势开始后 owner 被锁定，`coordinateOuterScroll` 在 body owner 下持续把 outer 钉在最大 offset，`coordinateNestedScroll` 在 header owner 下持续把 body 钉在 0。该策略成功阻止两个 delegate 交叉回调时清空深层 body，但也阻止 UIKit 的某一个 scroll view 携带剩余速度自然越过 owner 边界。
- `444e1889a5`（`fix: preserve native home scroll momentum`）是对该回归的局部补丁，不是最初引入点。它只在 iOS 17.4+、body owner、手指向下、body/outer offset 都大于 0 且预计 travel 跨界时接管；同时把 inner `targetContentOffset` 重置为当前值，再用单独 `CADisplayLink` 模拟 body → header 曲线。用户红框位置接近 `bodyOffset = 0 / outerOffset = maximum` 的临界状态，guard 可能不命中；命中时又从 UIKit 曲线切换为手算曲线，最终表现为停住、突然展开或上下方向手感不一致。
- 因此不能继续给 `444e1889a5` 增加更多方向判断或阈值。正确修复边界是让一次纵向手势和其 deceleration 始终只有一个 physics owner，再把统一的 combined vertical offset 映射到 header/body；或者采用单 list scroll view + pinned header 的成熟 paging 结构。必须保留 `a61b94335f` 所解决的“深层 body 不得被清零”语义，但不能继续依赖两个独立 UIScrollView 同时减速并互相 clamp。

### 当前自动证据与限制

- 当前 Debug 包在同一 DeFi/Support hub 锚点的原始录屏为 `.tmp/ui/support-hub-local-inertia-current.mp4`，触摸遥测为同目录 `support-hub-local-inertia-current.gesture-telemetry.json`，before/after 为 `support-hub-local-inertia-before.png`、`support-hub-local-inertia-after.png`，关键时序图为 `support-hub-local-inertia-timing-strip.png`。手势都从用户标记的 Slot 空白区域附近开始，先向上 120pt / 90ms，再向下 120pt / 90ms。
- 该自动录屏确认当前上下方向走了不同路径：向下最终进入自定义完整 Header 展开，向上仍由 inner/owner 协调；两者不是同一条 UIKit deceleration timeline。agent-device/XCTest 的 90ms swipe 仍有事件采样与命令 round-trip 偏差，不能用这段录屏否定用户真实手感，也不能据此声明已精确复现“两个方向都完全无惯性”。用户的 Simulator 连续触摸结果仍是当前产品失败事实。
- 本节只做诊断与结论降级，没有修改滚动实现，没有重新构建或更新安装 App，也没有执行 uninstall、reinstall、erase、clear data。后续修复前必须先定义红框起点的双向 pass 条件：同一短甩距离/时长下，松手后必须连续移动、速度单调衰减、无 owner 切换停顿/二次启动、无空白/跳顶，并与同状态 Legacy 录屏比较 travel 和 duration。
- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 与 handoff `git diff --check` 通过。staged handoff 执行 `yarn agent:check --profile commit`，日志为 `node_modules/.cache/agent-checks/2026-07-17T07-10-12-633Z`：`lint-worktree-js`、`agent-context`、`lint-staged` 通过；`lint-worktree-ts` / `tsc-staged` 仍由共享工作区既有 Desktop、Receive、Discovery、TokenList、DeFi、TradingView、WebView、Navigator、AppUpdate、ChainSelector、Firmware、旧 Home view、ReferFriends 与 Swap 错误阻断，没有本节 handoff 错误。没有修改或回滚这些无关文件。

## 2026-07-17 iOS 17.4+ Native Home 单一纵向物理驱动修复

### 最终根因与修复结构

- 用户红框 Support hub 位置的双向短甩失败不是 `decelerationRate` 数值问题，而是纵向同时存在 outer `UIScrollView` 与 page `UITableView` 两个 UIKit physics owner。固定 `header/body` owner 能避免深层 body 被错误清零，但边界 clamp 会截断一个 scroll view 的减速；后续 `CADisplayLink` 只模拟 body → header 的一条路径，又产生方向、阈值和速度曲线不一致。
- iOS 17.4+ 最终改为只有 outer `HomeContainerNestedScrollView` 接收真实纵向 tracking/deceleration。page table 关闭用户滚动，只保留渲染、复用和由 outer combined offset 驱动的程序化 `contentOffset`。combined offset 的前半段折叠 Header，超过 `maximumHeaderOffset` 的部分映射为 body offset；Header、Tab 和 pager 通过同一个连续 compensation transform 保持 pinned 结构。
- outer content size 同时包含 viewport、可折叠 Header 距离和当前 page 的最大 body offset；page slot 高度变化、布局和 Tab 完成切换都会重新计算，并把目标 page 的真实 body offset 映射回同一个 outer offset。原 `VerticalMomentumHandoff`、`CADisplayLink`、inner target offset 截断和 iOS 17.4 `transfersVerticalScrollingToParent` 依赖全部删除。
- iOS 17.4 以下按产品决定继续使用原 nested owner fallback；源码英文注释明确这是有意保留的低版本弱体验，不复制自定义滚动物理。

### React Native 手势二次根因

- 第一版单驱动 Debug 包中，LLDB 确认 outer `contentSize={402,1473}`、`isScrollEnabled=true`、方向 gate 通过，但 `gestureRecognizer(_:shouldRecognizeSimultaneouslyWith:)` 的另一个手势实际是 React Native 根 `RCTSurfaceTouchHandler`。原白名单只允许 Native table 和 horizontal pager，返回 false 后 RN root touch handler 抑制 outer pan，自动短甩会退化成 DeFi 行或 action 点击。
- 最终只在 outer unified driver 的 simultaneous 白名单中增加 `RCTSurfaceTouchHandler`。纵向 outer pan 因此能在位移达到阈值后取消 row tap；horizontal pager 仍由方向 gate 保护。修复后的普通 Uniswap V4 行点击仍能打开 Portfolio details，证明不是简单吞掉所有 RN touch。
- 第一版单驱动但尚未加入该白名单的截图/录屏全部作废，不能用于通过结论；最终只使用 `.tmp/ui/native-home-unified-inertia/final/v3-*` 证据。

### 最终 Debug 真实交互证据

- 用户红框附近的局部双向短甩分别为 `.tmp/ui/native-home-unified-inertia/final/v3-support-short-down.mp4` 与 `v3-support-short-up.mp4`，配套 `*.gesture-telemetry.json`、`*-after.png` 和 `*-contact.png`。两个方向在松手后都有连续多帧位移，逐帧时序没有停住后第二次启动、瞬间跳顶、blank/loading renderer 或反向回弹。
- body → header 单手势边界证据为 `v3-body-header-boundary-down.mp4`、`v3-body-header-boundary-down-after.png` 和 `v3-body-header-boundary-down-contact.png`：从 DeFi body 连续展开余额、快捷操作和完整 Header，没有边界平台期。反向 Header → body 为 `v3-header-body-boundary-up.mp4`、`v3-header-body-boundary-up-after.png` 和 `v3-header-body-boundary-up-contact.png`：从完整 Header 一次短甩连续进入 DeFi / Upgrade / Support hub。
- 录屏顶部偶尔出现的蓝色 `Refreshing...` 仍是 Debug Metro `RCTDevLoadingView`，不是 Native Home `UIRefreshControl`；settled 截图 `v3-refresh-settled.png` 已恢复，不能把该 Debug overlay 计作内容空态或滚动跳变。
- 交互回归：`v3-row-tap-before.png` / `v3-row-tap-after.png` 证明同一实现下 Uniswap V4 行仍打开真实 Portfolio details；`v3-horizontal-tab-nft.png` / `v3-horizontal-tab-spot-back.png` 证明 Spot/NFT 点击切换仍生效，纵向 driver 没有抢走横向分类交互。
- 本轮通过的是 iPhone 17 Pro / iOS 26.5 Debug 包的红框局部双向惯性、两个方向跨 Header/body 边界、无 blank/跳顶以及点击/Tab 基础回归。没有用编译通过、元素存在或单张 settled 截图代替手势证据；iOS 17.4 以下体验、Dark mode、动态字体和其他尚未完成的 Market/降级态仍不由本节覆盖，不能声明整个 Native Home UI 完成。

### Debug、运行时与数据安全

- 最终 `RCTSurfaceTouchHandler` 修复后从仓库根目录重新执行标准 `yarn app:ios`，结果 `Build Succeeded`，由命令完成 `Debug-iphonesimulator/OneKeyWallet.app` 的签名、更新安装和启动。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 构建期间曾遇到 CoreSimulator install/terminate 服务挂起，只中断了挂起命令并重启 Simulator/CoreSimulator 服务；没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。后续标准 `yarn app:ios` 成功完成更新安装。
- 最终 appstate 前台为 `so.onekey.wallet`；`Account #1`、余额、Token、NFT 和 DeFi/Portfolio 数据正常，应用持续存活。main probe 为 `runtime=main/jsReadyAt=1784278961289/uiVisibleAt=1784278963196/backgroundTransportState=ready`；独立 bg ready 为 `runtime=background/status=ready/protocolVersion=1/bootId=1784278962967-41ulw4m8/ts=1784278963272`，background target 的 Jotai bridge 存在。没有用 main ready 代替 bg ready。
- **Runtime scope：main。** outer combined offset、Header/body 映射、content size、gesture gate、transform、selected page 和 scroll state 都是当前 Native Home view 的 UIKit 状态；bg 只继续提供 Market/watchlist/portfolio/DeFi 等 service 数据和权威持久化，不参与滚动物理。
- iOS main/bg 是独立 Hermes JS heap，proxy 数据分别序列化/反序列化，初始化顺序独立。图片/字体 cache 与底层持久化句柄属于进程级共享 Native 资源；scroll offset、constraint、gesture、transform、represented image signature、request cancellation 和 pressed/hover 属于 per-view/main 状态。

### 检查与提交边界

- 本节只修改 `packages/native-components/ios/HomeContainerView.swift` 和本 handoff；没有修改或回滚共享工作区里的性能、TradingView、Discovery、Swap 等无关 dirty files。
- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift` 与指定 Native Home 文件的 `git diff --check` 通过。纯 Swift/UIKit 修复没有新增 TS/Jest 聚焦范围；标准 Debug build、双向录屏、边界逐帧 contact sheet、普通行点击和 Tab 切换是风险相称的聚焦验证。
- 最终 staged 内容执行 `yarn agent:check --profile commit`，日志为 `node_modules/.cache/agent-checks/2026-07-17T09-08-35-251Z`。`lint-worktree-js`、`lint-worktree-ts`、`format-worktree`、`agent-context` 和 `lint-staged` 全部通过；唯一失败的 `tsc-staged` 来自共享工作区既有的 Desktop `config.perfReady`、旧 `NativeHomePageView.native.tsx` header export，以及 `useNativeHomeSupplementalData.ts` 的 prefetch/refresh 类型错误。日志中没有本轮 Swift/handoff 错误，没有修改或回滚这些无关代码制造绿色结果。

## 2026-07-17 iOS Native Home 九项回归：修复前复现、根因和验收标准

### 统一复现现场与 A/B 方法

- 设备固定为 iPhone 17 Pro / iOS 26.5，UDID `4837E819-A117-4E08-9936-445785D199E3`，bundle `so.onekey.wallet`，Debug agent-device session `native-home-p0`。开始复现时安装包仍是前文最后一次标准 `yarn app:ios` 生成的 Debug 包；钱包 `Account #1`、All Networks、Token、NFT、DeFi 和 History 数据均存在，应用持续存活。
- 只为 A/B 临时把 `nativeHomeFeatureFlag.native.ts` 改成 `false` 并 Metro reload；Legacy 证据采集后已经恢复 `enabledByDeveloperMode && isHomeContainerAvailable()`，该临时开关最终无 diff。没有 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。
- 修复前 Native 证据目录为 `.tmp/ui/native-home-nine-regressions-20260717/repro/`。动态问题使用真实短点击/连续 fling/录屏和 contact sheet，不能用 settled 单图或 accessibility 元素存在作为通过。Legacy 当前实图 `legacy-history-top-3.png` 证明 incoming value 为绿色；`legacy-current-reconnect.png` 和 `legacy-market-position.png` 证明识别徽章紧跟标题。原版 History footer 以用户提供的 `/Users/huhuanming/Downloads/截屏 2026-07-17 17.23.50.png` 和 `TxHistoryListView` 永久 footer 源码为准。

### 九项修复前结论

1. **Favorites 标题与识别徽章间距错误。** 空收藏推荐卡中 LINK/SHIB/WLFI/UNI 的绿色 Community Recognized 被推到标题可用区右侧，而 Legacy 紧跟标题约 4pt。复现：空收藏滚到 Market，比较 `.tmp/ui/native-home-nine-regressions-20260717/repro/legacy-market-position.png` 与用户图 1。根因是 `HomeContainerMarketRecommendationCardControl` 给 `titleStack` 整个剩余列宽，title label 被拉伸。修复应让 title stack 按标题、badge 和 accessory 的 intrinsic width 布局，并只在超过可用宽度时截断。
2. **底部无法真正触达且被底栏遮挡。** Native History 连续从 `(350,700)` 向上 fling 后停在 `07/09/2026`，仍有数据位于底栏下方，再次 fling 无位移；证据 `history-to-bottom.mp4`、`history-bottom*.png`。根因是 iOS 17.4+ 单一 outer driver 依赖 page table 的 `contentSize`，异步 diffable snapshot/slot 内容完成布局后没有可靠通知 outer 重新计算最大 offset。修复应观察真实 table `contentSize`，在选中页每次变化后更新 outer content size，并保留 112pt bottom inset。
3. **Stocks 标题与识别徽章间距错误。** AAPLOn/SLVOn/CRCLOn 的徽章位置随较长 subtitle 宽度变化；Legacy 始终紧跟标题。证据 `.tmp/ui/ab-audit-legacy-market-stocks-402.png` 与 `.tmp/ui/ab-audit-native-market-stocks-agent-402.png`。根因是纵向 `leftStack` 默认 `.fill`，较宽 subtitle 把横向 title stack 撑满。修复应将 left stack alignment 改为 leading，同时保留 symbol 128pt、subtitle 66pt 上限和价格列压缩优先级。
4. **Market 分类首次切换出现白屏。** 用户图 4 对应 Favorites/Trending/Stocks/Perps 分类，不是顶部 Wallet Tab。调用方已经向 `useHomeMarketCategoryTokens` 传入 `prefetchMarketCategoryIds`，刷新时也调用 `refresh()`，但底层 hook 没有实现这两个接口；TypeScript 同时报出 unknown property / missing method，运行时只能等选中分类后再请求。修复应让底层 owner 并发预取所有服务端分类，按 `category + minLiquidity` 保留 cache，切换直接读取 cache，单分类失败不能清空其他分类。
5. **All Networks 顶部 Tab 数量不符合历史原版。** 修复前 Native 和当前 Legacy 都只显示 Spot/NFT/History；Native 证据 `current-home.png`，Legacy 证据 `legacy-after-reload.png`。这不是当前 Native 单独硬编码错误，而是提交 `e6de024d16` 将共享规则改成“至少一个当前 enabled network 命中 DeFi map”后，当前 service 状态返回 false。该提交之前的原版规则明确为：All Networks 的 DeFi 始终显示；Perps 在 `perpDisabled=false` 时始终显示。按用户确认恢复这一原版 product invariant 到共享 support owner，单链仍使用 service map；禁止只在 Native 写死五个 Tab，也不绕过 Perps 全局关闭开关。
6. **History 末尾说明和 Block explorer 按钮缺失。** Native adapter 只生成日期 sections 和可选 load-more action，没有原版 `showFooter && hasItems && !hasMore` 的永久 footer。修复应在相同业务条件下增加 Native History end slot，复用 `wallet_history_footer_view_full_history_in_explorer`、`global_block_explorer` 和 `useBlockExplorerNavigation`；All Networks 点击仍进入网络选择，不能写死 URL。
7. **NFT 深处切 History 后出现大量空白。** 复现：History 深滚 → NFT，NFT 深滚 → History；证据 `nft-bottom-to-history-blank.mp4`、`history-after-nft-bottom.png`。根因一是目标 tab 首次无预取 section，根因二是 horizontal transition 期间 outer content size 仍按 source page，完成后才换成 target page；异步 target 高度更新又可能漏通知。修复应在 transition 期间暂时使用 source/target 最大 body range，完成时按 target 的真实最大值 clamp 并恢复该 tab offset，同时由 content-size observation 收敛最终高度。
8. **History incoming value 未使用绿色。** Legacy 当前 `+0.0001762 BNB` 和 `+1.2144 POL` 为绿色，证据 `legacy-history-top-3.png`；Native user 图 7 为黑色。根因是 `getHistoryTransferDisplay` 只返回 value string，没有把 receive/positive 语义写入 DTO，Swift 因而使用 primary color。修复应从结构化 transfer direction 传递 positive accent color，禁止从渲染后的 `+` 字符串反推。
9. **折叠时大余额穿透到 Account row。** Native `current-home.png` 和用户图 10 可见余额字符从固定账户行上方/后方露出。根因是 `compactBackdropView` 只覆盖 account row 自身的窄 frame，未覆盖其左右及顶部区域。修复应将 opaque backdrop 扩到 Native Home 全宽、从顶部覆盖到 compact account row 下沿，并保持 account slot 位于最前。

### 本轮最终通过标准

- 重新执行标准 `yarn app:ios`，由它完成 Debug build、签名、更新安装和启动；确认 main runtime 与独立 bg runtime 都 ready、钱包数据正常、应用持续存活。禁止 Release、自定义 xcodebuild、关闭签名及任何数据清理操作。
- 间距项必须在相同状态 Legacy/Native 402px crop 中量测标题到 recognized 的稳定间距，不能只看图标存在；底部必须真实滚到最后 footer 且最后按钮完整位于底栏上方。
- Tab 必须连续执行 Spot/NFT/History/DeFi/Perps 的首次与二次切换，逐帧无纯白/rows→empty→rows，外层 offset 和目标页 offset 不产生不可消费的大空白；All Networks 显示 Spot/Perps/DeFi/NFT/History，Perps 全局 disabled 时仍隐藏。
- History 必须以真实行验证 incoming green、end footer 文案和 Block explorer 点击；账户行遮罩必须在完整 Header→compact Header 录屏中无余额穿透。修复后仍要执行 Swift parse、指定文件 `git diff --check`、聚焦 Jest/ESLint，并记录共享工作区既有门禁阻断，不能回滚无关 dirty files制造绿色结果。

### 九项修复实现与最终 Debug 实测

- `HomeContainerMarketRecommendationCardControl` 不再把 title stack 拉满整列，而是按 title + recognized/accessory 的 intrinsic width 收敛、超过可用宽度时才截断；普通 Market 行的纵向 left stack 改为 `.leading`。最终空收藏截图 `.tmp/ui/handoff-ui-market-favorites-after-debug.png` 中 LINK/SHIB/WLFI/UNI 的绿色 recognized 均紧跟标题，Stocks 截图 `.tmp/ui/handoff-ui-market-stocks-after-debug.png` 中 AAPLOn/SLVOn/CRCLOn 的 source icon 也不再被 subtitle 宽度推走。两张同时保留真正的 402×874 对照图 `*-402.png`；`Add 4 tokens` 前的 `+` 与原版相同为文字级尺寸，不再使用放大的独立图标。
- iOS 17.4+ unified outer driver 现在观察每个 page table 的真实 `contentSize`，异步 snapshot、slot mount 和 footer 完成布局后都会重新计算 outer range；horizontal transition 期间暂用所有 page 的最大 body range，settled 后再按目标 page 的真实范围安全 clamp。`history-reach-footer.mp4` 连续真实 fling 到 `02/02/2026` 后出现完整 History footer，最终图 `history-footer-bottom.png` 中说明文案和 `Block explorer` 全部位于底栏上方，没有最后一行或按钮被遮挡。
- NFT/History 在对应 Tab 可用时即预取，不再等 `visitedTabs` 首次点击后才启动。连续真实点击录屏 `top-tabs-prefetched-no-blank.mp4` 中 NFT 与 History 首帧均已有真实内容；从 NFT 深处切 History 的 `nft-deep-to-history-no-blank.mp4`、`history-after-nft-deep-first-frame.png` 和 `history-after-nft-deep-settled.png` 显示首帧与 settled 几何一致，没有白屏、`rows -> empty -> rows` 或大量空白。
- `useHomeMarketCategoryTokens` 现在把 selected category 与 `prefetchMarketCategoryIds` 去重后并发抓取，按 `category + minLiquidity` 缓存成功结果；刷新复用同一 owner，单分类失败用 `Promise.allSettled` 隔离，不会清空其他缓存。最终有效录屏 `.tmp/ui/native-home-nine-regressions-20260717/final-market-prefetch/market-categories-prefetched-no-blank.mp4` 为 19.2s / 576 帧；真实点击 Trending→Stocks→Favorites 两轮后，`trending-second-first-frame.png`、`stocks-first-frame.png`、`stocks-second-first-frame.png`、`favorites-return-first-frame.png` 和 `favorites-second-first-frame.png` 首帧都已有真实行，没有 loading 空块或 `rows -> empty -> rows`。一段复用漂移 y 坐标而误进 Discover/Token detail 的旧录屏已作废，不用于结论。
- All Networks 的共享 support owner 恢复历史原版 product invariant：DeFi 始终可用，Perps 仅受全局 `perpDisabled` 关闭；单链仍由 bg 的 DeFi capability map 判断。最终 `.tmp/ui/native-home-nine-regressions-20260717/after-debug-home.png` 与上述切换截图真实显示 `Spot / Perps / DeFi / NFT / History` 五个 Tab；聚焦测试同时覆盖 All Networks capability map 暂空与 Perps 全局关闭两种分支，没有只在 Native renderer 写死五项。
- History end slot 复用原版 `wallet_history_footer_view_full_history_in_explorer`、`global_block_explorer` 和 `useBlockExplorerNavigation`。All Networks 实点 footer 按钮后，`history-explorer-network-selection.png` 显示真实 `Select network` 页面；不是只验证按钮存在，也没有写死 block explorer URL。
- History adapter 从结构化 send/receive 关系把 positive accent 写入 DTO，不从渲染后的 `+` 字符串反推。`history-first-frame.png`、`history-settled.png` 以及 NFT 深处切回后的首帧中，`+0.0001762 BNB`、`+1.2144 POL` 等 incoming value 均为绿色。
- compact backdrop 从 header 顶部全宽覆盖到 pinned Account row 下沿。有效证据 `header-compact-fling.png` 中折叠后的 Account 行后方没有余额字符穿透；两段曾误点进 ETH detail 的旧录屏已明确作废，不用于通过结论。
- Favorites 真实星标移除录屏 `favorites-remove-no-blank.mp4` 中，移除 SHIB 后 LINK 平滑补位，首帧和 settled 图都没有空块；继续通过真实星标点击移除 LINK/WLFI/UNI 后，权威 bg watchlist probe 为 `data: []`，空收藏 4 个推荐 Token 和 `Add 4 tokens` 状态正常。本节没有通过直接改数据库制造该状态。
- Market 三类最终 Debug 图为 `.tmp/ui/handoff-ui-market-favorites-after-debug.png`、`.tmp/ui/handoff-ui-market-trending-after-debug.png`、`.tmp/ui/handoff-ui-market-stocks-after-debug.png`，以及各自宽度 402 的 `*-402.png`。Stocks 三个真实服务端 logo 均成功，未落入 CryptoCoin fallback；Trending 当前 BTC 第二行仍为空，运行时原始 `volume24h` 为 `"-"`、归一化后 falsey，Legacy 同样隐藏，因此没有添加假 volume 占位。当前服务端 hot config 仍决定 Market Perps 是否出现，Native 没有写死 Perps 分类。

### Debug 更新、运行时、检查与边界

- 本轮所有行为源码修改后在仓库根目录执行唯一允许的标准 `yarn app:ios`；将 Market 分类集合规则从 hook 内等价抽到纯工具模块以隔离测试后，又对最终将提交的精确源码完整执行一次同一命令。最后一次结果 `Build Succeeded`、0 errors、11 个既有 warnings，由命令构建、签名、更新安装 `Debug-iphonesimulator/OneKeyWallet.app` 并启动 `so.onekey.wallet`。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。最终前台 bundle 为 `so.onekey.wallet`，`Account #1`、All Networks、Token/NFT/DeFi/History 数据正常，应用持续存活；收藏为空是本轮通过真实星标交互得到的业务状态。
- 最后一次 Debug 更新后的干净现场图为 `.tmp/ui/native-home-nine-regressions-20260717/final-after-extraction/home-after-final-debug-clean.png`：`Account #1`、`$54.11`、五个 Tab 和真实 Token 行均正常，应用仍在前台。最终 runtime probe：main 为 `runtime=main/jsReadyAt=1784298657798/uiVisibleAt=1784298659280/backgroundTransportState=ready`，并收到独立 bg ready payload `runtime=background/status=ready/protocolVersion=1/bootId=1784298659438-4efkaiai/ts=1784298659719`；独立 background target 为 `runtime=background/backgroundJotaiBridge=true/sharedRPC=true`。main ready 没有替代 bg ready。
- **Runtime scope：main + bg。** UIKit outer/body range、content-size observation、Tab transition、cache/snapshot/section patch、History accent/footer slot 和 compact backdrop 属于 main/per-view 状态；Market config/category/watchlist、History/NFT/DeFi/portfolio service 数据和权威持久化属于 bg。iOS main/bg 是独立 Hermes JS heap，跨 runtime 数据通过 proxy 分别序列化/反序列化，二者独立初始化，不能假设 bg 先 ready。图片/字体 cache 与底层持久化句柄是进程级共享 Native 资源；constraint、content offset、represented image signature、request cancellation、selected/pressed/hover 属于 per-view/main 状态。
- 本节修改文件为 `HomeContainerView.swift`、`HomeContainer.native.tsx`、`HomeContainer.types.ts`、`NativeHomePage.native.tsx`、History adapter/测试、Home Tab support hook/helper/测试、Market category prefetch hook/纯工具/测试和本 handoff；没有修改 Android renderer，也没有把 yarn.lock、Performance、Discovery、Swap、TradingView 等共享工作区 dirty files 混入。
- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift`、指定 Native Home 文件的 `git diff --check`、聚焦 `oxfmt --check` 和 type-aware `oxlint --deny-warnings` 均通过。聚焦 Jest 为 3 suites / 24 tests 全部通过；Market prefetch 的纯工具测试覆盖 selected/prefetch 去重排序与空 selected，且不会为测试该规则而加载完整 bg proxy/WalletConnect runtime。最终 staged 内容执行 `yarn agent:check --profile commit`，日志为 `node_modules/.cache/agent-checks/2026-07-17T14-26-56-450Z`：`lint-worktree-js`、`lint-worktree-ts`、`format-worktree`、`agent-context` 和 `lint-staged` 全部通过；`tsc-staged` 中本轮原有的 `prefetchMarketCategoryIds` / `refresh()` 两条错误已经消失，只剩 Desktop `config.perfReady` 和旧 `NativeHomePageView.native.tsx` header export 两条共享工作区既有错误。早先聚焦 `npx eslint` 在加载配置前被当前 `node_modules` 缺失的 `typescript` 依赖阻断；没有修改依赖或 yarn.lock 掩盖环境问题，也没有回滚无关代码制造绿色结果。
- 本节通过的是上述九项、Market 三类当前成功态和列出的真实切换/触底/点击证据；Dark mode、动态字体、所有 pressed/hover、全部图片候选失败/取消/缓存失效降级态、更多 History 交易类型和 iOS 17.4 以下滚动体验仍未全量覆盖，不能声明整个 Native Home UI 已完成。

## 2026-07-18 九项回归 subagent 复核修正与最终 Debug 验收

### 复核结论与旧结论修正

- 本轮在上一节实现后由独立 subagent 做两轮只读复核，并按其发现重新检查代码与真机证据。复核要求严格区分普通 All Networks explorer、merge-derive 地址类型选择器、Market 已真实点击分类和仅由 config 出现的分类；元素存在、编译通过和错误坐标命中都不算通过。
- 上一节关于 Market “首次与二次切换均通过”的表述只对有效录屏中真实点击的 Favorites、Trending、Stocks 成立，不能外推到 Perps。当前 Perps 受真实服务端 hot config 与现场交互条件限制，没有同等级的首帧点击证据，因此九项中的 Market 四分类验收仍为 **Partial**，不是完整通过。Native 没有为截图写死 Perps。
- subagent 复核发现 BTC 等 merge-derive 单链的深分页还有一个独立终止态缺陷：真正的末页已经返回 `hasMore=false`，但 15 秒 polling 的 page-1 响应仍可能携带 `hasMore=true`；旧 hook 在保留已加载区间时会把终止态重新打开。此时最后一个 cell 已经保持可见，`willDisplay/onEndReached` 不保证再次触发，于是 UI 停在最大 offset 且 footer 永远不出现。此前 All Networks footer 通过不能外推到该分支。

### 按复核结果完成的修正

- `useHistoryListLoadMore` 增加当前 pagination generation 的 terminal-page ref。深 cursor 一旦没有有效新页，就在保留已加载区间期间拒绝 page-1 polling 把 `hasMore` 重开；账户、网络、过滤条件或 hard reset 开启新 generation 时才清除该终止态。新增聚焦测试覆盖“末页 false → polling first page true → 已加载区间保留但 hasMore 仍为 false → 不再发起额外 load-more”。
- 修复前 BTC 失败现场为 `.tmp/ui/native-home-nine-regressions-20260717/final-after-subreview-fix/history-bitcoin-scroll-command.png`：已到非移动的最大 offset，但 footer 不存在。修复后的真实深滚图 `.tmp/ui/native-home-nine-regressions-20260717/final-after-terminal-fix/bitcoin-history-scroll-1.png` 与 `bitcoin-history-footer-after-trigger-fix.png` 显示完整说明和 `Block explorer` 按钮。
- merge-derive footer 复用原版 `AddressTypeSelector`。实际交互又发现：把 selector trigger 的 Button 包在仅用于 testID 的 Stack 中会破坏 Popover 向直接 trigger 注入 press handler，导致按钮存在但点击不弹出 selector；最终恢复为 **Button 直接作为 `renderSelectorTrigger`**，testID 直接放在 Button 上。实点证据 `.tmp/ui/native-home-nine-regressions-20260717/final-after-terminal-fix/bitcoin-history-selector-direct-trigger-click.png` 已打开真实 `Select address type`，并显示 Taproot、Nested SegWit、Native SegWit、Legacy 与确认操作。普通 All Networks 分支的真实 `Select network` 证据仍为 `.tmp/ui/native-home-nine-regressions-20260717/final-after-subreview-fix/history-all-networks-select-network.png`。
- unified outer driver 的最终 bottom inset 为 `112 + compactHeaderHeight = 172pt`。有效触底证据 `.tmp/ui/native-home-nine-regressions-20260717/final-after-subreview-fix/portfolio-support-bottom-inset-172-valid.png` 和 `portfolio-support-bottom-inset-172-valid-extra-swipe.png` 中 `Help center` 完整位于浮动底栏上方，额外上推不再改变最终位置。
- Market cache owner 继续按 `category + minLiquidity` 独立保存最新 request id；每个分类成功后立即提交并触发渲染，不等待其他分类 settle；同 key 的旧请求不能覆盖新结果，某个分类失败不清空兄弟分类。纯工具测试覆盖 key 隔离、早提交、失败保留、同 key stale rejection 和并行 liquidity scope。

### 最终九项状态和有效证据边界

1. Favorites 标题/recognized 间距：**Pass**，以最新 Favorites Debug 图和 402 图为证据。
2. 底部触达与底栏遮挡：**Pass**，以 172pt inset 的触底及 extra-swipe 两帧为证据。
3. Stocks 标题/source icon 间距：**Pass**，以最新 Stocks Debug 图和 402 图为证据。
4. Market Favorites/Trending/Stocks/Perps 首帧预取：**Partial**。Favorites、Trending、Stocks 有首帧真实行；Perps 没有同等级真实点击证据，不能声明四分类全部通过。
5. All Networks 顶部 Tab 数量：**Pass**，当前真实 All Networks 显示 Spot / Perps / DeFi / NFT / History，并保留 Perps 全局 disabled 时隐藏的共享规则。
6. History 末尾文案与按钮：**Pass**。All Networks 普通分支真实打开 Select network；BTC merge-derive 分支真实到达 footer 并打开 Select address type。BTC 选择具体地址后的外部区块浏览器最终跳转没有单独录证，不把 selector 打开外推为该末端链路也已通过。
7. NFT 深处切 History 大空白：**Pass**，以此前列出的真实切换录屏和首帧/settled 多帧为证据。
8. History incoming value 绿色：**Pass**，以真实 incoming 行截图为证据。
9. compact Header 余额穿透：**Pass**，以完整 Header 到 compact Header 的有效折叠截图为证据。

- 有效 Market 最新 Debug 图仍为 `.tmp/ui/handoff-ui-market-favorites-after-debug.png`、`handoff-ui-market-trending-after-debug.png`、`handoff-ui-market-stocks-after-debug.png` 及各自真正的 402×874 `*-402.png`。旧 verified 图、坐标漂移后误入详情/Discover、Dev mode 误点、Debug LogBox 覆盖和红色错误帧全部排除，不能用于通过或失败结论。
- 最终干净现场图为 `.tmp/ui/native-home-nine-regressions-20260717/final-after-terminal-fix/home-after-final-yarn-app-ios-clean.png`。`Account #1`、All Networks 图标、余额和真实 Token 行正常，应用持续存活。

### 最终 Debug、运行时与数据安全

- 所有上述最终源码修改后再次从仓库根目录执行标准 `yarn app:ios`。结果 `Build Succeeded`、0 errors、11 个既有 warnings；命令构建、签名、更新安装 `Debug-iphonesimulator/OneKeyWallet.app` 并启动 `so.onekey.wallet`。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- 没有执行 uninstall、reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据。钱包数据正常，app 持续前台存活。
- 最终 main probe 为 `runtime=main/jsReadyAt=1784325360874/uiVisibleAt=1784325362374/backgroundTransportState=ready`；main 收到独立 bg ready payload `runtime=background/status=ready/protocolVersion=1/bootId=1784325362507-xltdpcyk/ts=1784325362797`，独立 background target 报告 `runtime=background/backgroundJotaiBridge=true`。main ready 没有代替 bg ready。
- **Runtime scope：main + bg。** Native Home UI、History pagination generation/footer/AddressTypeSelector、Market hook cache、snapshot/section patch、content offset 和每个 view 的交互状态属于 main/per-view；Market config/category/watchlist、History/NFT/DeFi/portfolio service 数据和权威持久化属于 bg。iOS main/bg 使用独立 Hermes JS heap，跨 runtime 数据经 proxy 分别序列化/反序列化，初始化顺序独立，不能假设 bg 先 ready。图片/字体 cache 与底层持久化句柄是进程级共享 Native 资源；constraint、represented image signature、request cancellation、pressed/hover、Market cache instance 和 pagination refs 是 per-view/main 状态。

### 文件、检查与完成边界

- 本次复核修正只涉及 `HomeContainerView.swift`、`NativeHomePage.native.tsx`、Market category hook/纯工具/测试、History pagination hook/测试和本 handoff。没有修改 Android renderer，也没有把 `yarn.lock`、Performance、Discovery、Swap、TradingView 等共享工作区 dirty files 混入。
- 聚焦 Jest 最终为 4 suites / 36 tests 全部通过；聚焦 `oxlint`、`oxfmt --check`、Swift parse 和完整指定文件 `git diff --check` 通过。最终 staged `yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-17T22-03-15-244Z`：`lint-worktree-js`、`lint-worktree-ts`、`format-worktree`、`agent-context` 和 `lint-staged` 全部通过；`tsc-staged` 仅被共享工作区既有的 Desktop `config.perfReady` 缺失和旧 `NativeHomePageView.native.tsx` header export 两条错误阻断。日志中没有本轮 8 个文件的类型错误；没有修改或回滚无关代码制造绿色结果。
- 独立 subagent 最终只读审查未发现 P1/P2，确认当前聚焦代码可以提交；其唯一九项证据缺口同样是 Perps 首帧，并提醒 BTC 选择地址后的外部浏览器最终跳转没有单独录证。
- 本节通过的是九项中的八项和 Market 三个当前成功分类；Perps 四分类首帧仍为 Partial，Dark mode、动态字体、所有 pressed/hover、全部图片失败/取消/缓存降级态、更多 History 交易类型和 iOS 17.4 以下滚动体验仍未全量覆盖。不得声明整个 Native Home 或整个 Market UI 已完成。

## 2026-07-18 iOS Native Home 自适应、交互与图片失败态审计

### 后续主要走查方式：同状态 Legacy / Native 自动 A/B

- 本轮再次确认“同一 Debug 包中临时切换 Legacy 与 Native、按相同状态逐屏截图、同位置 crop 后做 overlay/absolute/edge differ，再用真实点击或录屏复核差异”非常有效，后续应作为 Native Home 的主要走查方式。每组 A/B 必须固定 simulator、账户/网络、主题、Dynamic Type、locale、服务端 config、滚动锚点和数据状态；价格、轮播和异步图片等动态区域需要先 mask 或单独解释。
- 自动 differ 只用于发现区域和排优先级，不是通过证明。最终通过仍要求真实页面、选中态、内容首帧/稳定帧、点击结果和必要录屏；旧坐标因 DeFi/Earn 异步位移而误点详情或其他 View more 的帧全部作废。Nitro Market 子树未进入 accessibility snapshot 时，使用“截图后立即点击”的短 `agent-device` batch，禁止延迟复用旧 y 坐标。
- 原版 feature flag 只允许在 A/B 采样期间临时切换；完成后必须恢复 Native 默认路径并重新执行 `yarn app:ios`。不能删除 Legacy 代码，也不能退回 Legacy 规避 Native 问题。A/B 差异需要集中按 layout / typography / missing component / behavior / failure state 分类修复，再对相同状态重跑一轮 differ。

### 本轮问题、根因与实现

- 图片 loader 现在为每个 represented signature 持有可取消 request；候选 URL 顺序加载，cell 复用、signature 改变或离屏时取消。SDWebImage 内存缓存可能同步回调，因此最终 completion 强制投递到下一次 main run loop，避免旧请求在回调后覆盖新 active request；移除了可能双回调的 `.refreshCached`。网络失败只做初次 + 2s / 4s / 30s 三次有界恢复，request / retry closure 都为弱引用并受 cancel/identifier 保护，不会产生离屏无限流量。
- `ONEKEY_NATIVE_HOME_IMAGE_AUDIT=all-fail` 仅在 Debug 生效，用来强制全部远端候选失败。所有候选失败时：普通 Token/Stocks 使用 CryptoCoin 或字母 fallback；All Networks 每个网络槽独立 fallback；NFT、network badge、recognized/source accessory 等没有合法 fallback 的装饰隐藏；空 URL banner 收起，非空 banner 主图失败使用稳定 photo fallback；Header 账户/网络 URL 变化时先立即应用新 fallback，避免上一账户或网络图片短暂串图。最终正常 Debug 启动前已清除该环境变量。
- fallback 类型、URL candidates、badge/accessory、theme 都进入 represented signature；失败、成功和复用回调只有 signature 仍匹配才允许落图。图片与字体 cache 仍是进程共享 Native 资源，但 request、represented signature、cancel/retry token 和 fallback 显示属于每个 view/cell。
- Dark mode 变更会更新完整 theme signature，并强制可见 cell 重新配置；Token/NFT/banner/card/slot fallback 与边框使用当前 theme，不再把 light 背景缓存进 dark cell。最终 Light 与 Dark 真实帧分别为 `.tmp/ui/native-home-final-20260718/market-light-large-final.png` 和 `market-dark-large-restored-final.png`。
- Dynamic Type 通过 capped `UIFontMetrics` 同步缩放标题、正文、Header、row/footer 高度和 Market segment；顶层 Tab 改为水平滚动，AXXXL 不再互相覆盖或挤掉尾部 Tab。最终 XXXL Market 真机帧为 `.tmp/ui/native-home-final-20260718/market-AXXXL-final.png`，恢复系统 Large 后为 `market-large-restored-final.png`。该证据覆盖当前 Market/邻接 section 的可读性，不代表所有语言和全部页面字号组合均已完成。
- pressed/hover/selected 统一覆盖 row tap、Header/action/button、顶部 Tab/toolbar、Market category/item/favorite、recommendation、NFT、horizontal/banner dismiss 和 section action；favorite 是独立 control，不触发行跳转。iPhone simulator 能验证 press/selected，不能把源码审计外推为真实 pointer hover 证据。
- Market category 变更使用无动画 diffable snapshot，以缓存数据直接替换 rows；结构高度变化仍 pin/restore outer content offset。Favorites 的结构性增删仍保留 diffable 动画，因此移除收藏会由下一行平滑补位而不是空块闪烁。Market segment 的 server icon 为 18pt、图文约 8pt 间距、独立 icon-only width，selected accessibility trait 随真实状态更新。

### 三分类、星标和 BTC DTO 最终 Debug 证据

- 最终 `yarn app:ios` 安装包中的三张稳定图为 `.tmp/ui/handoff-ui-market-favorites-after-debug.png`、`handoff-ui-market-trending-after-debug.png`、`handoff-ui-market-stocks-after-debug.png`，并生成了真正的 402×874 `*-402.png`。Favorites 的 LINK / SHIB / WLFI / UNI 标题均完整，不再出现 `LI...` / `S...` / `W...` / `...` 的异常压缩；localized subtitle 仍按原版上限正常省略。
- 分类最终连续录屏为 `.tmp/ui/native-home-final-20260718/market-category-final.mp4`。Trending、Stocks、Favorites 的点击后首帧与 1s 稳定帧都已有真实 rows，没有 `rows -> empty -> rows`；Market 锚点、Earn 等下方 section 和外层 offset 没有跳变。当前真实 config 显示 Perps label，但本轮没有对 Perps 取得与三分类同等级的首帧点击证据，因此四分类整体仍是 **Partial**，Native 没有写死 hot config。
- Trending 当前真实前三行为 BTC / Jimothy / BRIAN。BTC 第二行为空不是 Native 丢字段：对与 app 相同的 prod endpoint/参数读取原始 DTO，BTC `volume24h` 为字符串 `"-"`；共享 formatter 归一化为 0，Legacy 同样隐藏。Jimothy/BRIAN 的真实 volume 正常显示。继续禁止为 BTC 增加假占位或伪造 volume。
- Stocks 的 AAPLOn、SLVOn、CRCLOn 均显示各自真实服务端 logo、source icon、network badge 和 volume，无 CryptoCoin fallback、无串图；首次帧与稳定帧一致。该组证明正常候选成功态，全部候选失败态由 Debug seam 的独立截图/录屏证明，不能互相替代。
- Star 最终录屏为 `.tmp/ui/native-home-final-20260718/market-star-toggle-final.mp4`：Trending BTC 点击后只把 star 平滑切为实心，再点击恢复空心；三行位置和 Market 高度不变，没有空块、闪烁或冒泡进入详情。最终已恢复原空收藏业务状态。
- 全候选失败态证据为 `.tmp/ui/native-home-accessibility-fix-20260718/image-all-fail-top-rebuilt.png`、`image-all-fail-market-favorites-rebuilt.png`、`image-all-fail-market-stocks-first-frame-rebuilt.png` / settled 和 `image-all-fail-category-switch.mp4`。这些帧验证稳定 fallback、隐藏无 fallback 装饰和分类切换不串图；没有真实模拟网络在 36s 后恢复，因此“相同 signature 在全部重试结束后自动无限恢复”不属于本轮通过项，后续需由 refresh/reconfigure/cell reuse 触发新请求。

### 最终 Debug、运行时与数据安全

- 所有最终源码后从仓库根目录执行标准 `yarn app:ios`，结果 `Build Succeeded`、0 errors；由它构建、签名、更新安装并启动 `Debug-iphonesimulator/OneKeyWallet.app`。最终 binary mtime 为 `2026-07-18 13:10:27`。没有使用 Release、自定义 `xcodebuild`、`CODE_SIGNING_ALLOWED=NO`，也没有执行 uninstall、reinstall、erase、clear data 或删除 simulator app container/钱包数据库。
- 最终前台 bundle 为 `so.onekey.wallet`；`Account #1`、All Networks、余额和真实 Token/Earn 数据正常，钱包持久化数据仍在，应用持续存活。干净钱包现场为 `.tmp/ui/native-home-final-20260718/final-debug-wallet-clean-2.png`。
- 最终 main target probe 为 `jsReady=true/runtime=main/transportState=ready`；独立 background target 为 `runtime=background/bgHandlerReady=true`。main ready 没有替代 bg ready。
- **Runtime scope：main + bg。** Native Home UIKit UI、Market selection/cache/snapshot/section patch、Dynamic Type/theme、diffable mutation、scroll/pressed/hover、image request/signature 属于 main/per-view；Market config/category/watchlist 和各 service 数据、权威持久化属于 bg。iOS main/bg 是独立 Hermes JS heap，数据经 proxy 分别序列化/反序列化，双方持有独立 JS 副本并独立初始化，不能假设 bg 先 ready。图片/字体 cache 与底层持久化句柄是进程级共享 Native 资源。

### subagent 复核、文件与完成边界

- 图片失败/复用、accessibility/interaction、九项回归分别由三个独立 subagent 多轮只读审计；每轮发现后由主 agent 修复，再交回同一审计方向复核。最终三方均报告无 P0/P1/P2：图片审计接受有界重试的明确 tradeoff；interaction 审计确认 selected trait、独立 Star 和 pressed coverage；九项审计确认未回归既有修复。subagent 结论只是源码复核，真实截图与录屏仍以上述证据为准。
- 本轮拟提交文件只包括 `packages/native-components/ios/HomeContainerImageLoader.swift`、`packages/native-components/ios/HomeContainerView.swift` 和本 handoff。没有修改 Android renderer，也不会把 `yarn.lock`、Discovery、Swap、TradingView、Performance 或其他共享工作区 dirty files 混入。
- `xcrun swiftc -parse HomeContainerImageLoader.swift HomeContainerView.swift`、指定 Native Home 文件的 `git diff --check` 和 `HomeContainerController.test.ts` 8 个聚焦 Jest 均通过。最终 staged `yarn agent:check --profile commit` 日志为 `node_modules/.cache/agent-checks/2026-07-18T05-34-58-332Z`：`lint-worktree-js`、`lint-worktree-ts`、`format-worktree`、`agent-context`、`lint-staged` 全部通过；`tsc-staged` 仅被共享工作区既有的 Desktop `config.perfReady` 缺失和旧 `NativeHomePageView.native.tsx` header export 两条错误阻断。日志没有本轮 Swift/handoff 文件错误，没有修改或回滚无关文件制造绿色结果。
- 本节通过的是当前 Debug 包的 Dark/Light、当前 XXXL/Large、Favorites/Trending/Stocks、Star 平滑增删、成功图片候选和强制全部失败降级态。真实 pointer hover、真实断网后跨 36s 自动恢复、更多语言/字号组合、Perps 分类首帧、所有详情跳转和所有业务失败回滚仍没有同等级真机证据，因此不能声明整个 Native Home UI 已完成。

## 2026-07-18 长期协作规则：产品实现与验收全部由 subagent 执行

- 后续 Native Home 工作中，所有产品代码的编写、修改和修复均由 **编写 subagent** 执行；主 agent 不直接编写或修改产品代码。
- 所有 UI 验收与代码验收均由 **验收 subagent** 执行。验收 subagent 必须给出可追溯的复现步骤、通过/失败条件、真实截图或录屏（UI 验收）以及源码审计和检查结果（代码验收）；主 agent 不直接执行 UI/代码验收，也不能根据编译通过、元素存在或自己的观察自行宣告通过。
- 编写与验收必须角色分离：同一项工作的编写 subagent 不能同时作为最终验收 subagent。验收失败后，由主 agent 将失败证据和明确条件交回编写 subagent 修复，再由独立验收 subagent 复核；循环直到通过或记录真实阻断。
- 主 agent 只负责需求拆解、subagent 调度、范围和冲突控制、结论与证据汇总、handoff/提交元数据协调、commit 和 push。主 agent 不代替 subagent 编写产品代码，不代替 subagent 做 UI/代码验收，也不自行扩大通过范围。
- handoff 的维护与发布、提交范围核对以及 commit/push 由主 agent 统一协调；其中涉及产品行为、实现结论或验收结论的内容必须来自对应 subagent 的实际工作和证据，不能由主 agent 补做或推断。

## 2026-07-18 Native Home 状态矩阵扩展：首次空钱包、首次启动与单链有钱钱包

### 调研结论、证据等级与本节边界

- 本节来自三个只读调研方向及一次独立交叉复核：首次创建空钱包、首次启动/no-wallet、单链有钱钱包。调研没有修改产品代码、Simulator 钱包、数据库或持久化数据，也没有执行 uninstall、reinstall、erase、clear data。
- 独立复核对这三类新增状态的总体证据结论为 **Fail / Incomplete**：产品和架构方向已能够确定，但目前没有为三类状态分别准备安全、独立的真实 fixture，也没有同状态 Legacy / Native 全流程 A/B、首帧录屏和最终交互证据。以下“应 Native 化”的产品决策不能被误写成“已经通过”。
- 本节严格区分四类信息：**代码事实**是当前源码能够直接证明的分支和时序；**推断**是根据代码时序得出的风险，尚未由真实录屏证明；**已有证据**只覆盖既有有钱多链钱包或部分切网状态；**证据缺口**必须由隔离 fixture 的真实 Debug 包补齐。代码编译、元素存在、旧截图和当前多链有钱钱包正常都不能外推为这些新状态通过。
- 本轮已经开始调度两条 P0：`未备份 HD 空钱包的 Native shell + RN NotBackedUpEmpty Hybrid body` 与 `首次启动 onboarding verdict 前的可见性 gate`。两项都仍处于编写/复核流程，必须由独立验收 subagent 给出源码审查、聚焦检查和真实状态证据后才能更新为 Pass。

### 总体产品状态矩阵

| 场景 | 产品决策 | Native / Hybrid 边界 | 当前证据状态 |
| --- | --- | --- | --- |
| 首次创建、未备份的标准 mnemonic HD 空钱包 | **需要 Native Home 承接，但必须是 Hybrid 特殊内容态** | Header/页面容器继续 Native；body 复用现有 RN `NotBackedUpEmpty`，不在 Swift 重写备份流程；隐藏普通资产 Tab、Market、Earn、banner 和普通 WalletActions | P0，未验收 |
| 已备份的零资产钱包 | **需要正常 Native Home** | 显示普通零资产 Native 页面；动作与 banner gating 必须和 Legacy 一致 | P1，未验收 |
| Keyless create/recover、导入 mnemonic/KeyTag 的零资产钱包 | **需要正常 Native Home** | 这些路径按当前创建语义视为已备份，不显示未备份 CTA；仍需验证各 wallet type 的动作能力 | P1，未验收 |
| 第一次启动且本地没有钱包 | **Onboarding 本身不 Native 化** | `unknown -> onboarding | main` gate 由现有 RN 导航/启动体系决定；Native Home 只可在不可见、不可点击、不可访问状态下预热，不能先露出任何 Home 像素 | P0，未验收 |
| 普通单链 EVM 有钱钱包 | **需要 Native Home** | Header、Tab、资产列表、History、滚动和 snapshot Native；复杂 selector、More、Explorer、业务 modal 可继续 RN Hybrid | P0/P1，只有部分切网证据 |
| BTC merge-derive 单链有钱钱包 | **需要 Native Home** | Native 列表/分页/footer；AddressTypeSelector、Explorer 等复用 RN；保持 BTC merge-derive 数据与分页语义 | P1，已有部分 BTC 证据但无完整 A/B |
| imported private-key / watching / external / hardware 单链有钱钱包 | **需要 Native Home，不允许退回 Legacy 规避** | Native 页面只展示真实可用 action；账户管理、硬件通信和复杂业务仍由现有 RN/bg owner 负责 | P1，真实 fixture 与动作能力证据缺失 |

### 场景一：首次创建的空钱包

#### 代码事实与产品边界

- 标准 mnemonic 创建路径在 `CreateNewWallet.tsx` 和 account selector action 中传入 `isWalletBackedUp: false`，并在进入 Home 前创建 wallet、indexed account 和默认网络账户。因此它不是“没有钱包”，而是 `HD + 未备份 + 零资产` 的独立内容态。
- Legacy `HomePageView.tsx` 对该状态走 Header + RN `NotBackedUpEmpty`，不展示普通 WalletActions、资产 Tabs、Market、Earn 和 banners。现有 Native `NativeHomePage.native.tsx` 只隐藏了部分 Header 明细、actions 和 banners，仍可能构造 `$0`、Tabs、Market/Earn，且没有现有备份 CTA；这是当前明确的 **P0 行为缺口**。
- 正确实现不是删除 Legacy，也不是把整页退回 Legacy，更不是在 Swift 复制备份业务。Native Home 保持 Header、容器和滚动 owner；特殊 body slot 直接挂载现有 RN `NotBackedUpEmpty`。进入该状态前必须等待 wallet list、active account 和 backup verdict 完成，不能先渲染普通 Native Home 再切换，以免出现完整 Home 闪现。
- 备份完成后应由真实 wallet 状态驱动从 Hybrid 未备份 body 切换为普通 Native Home；不能靠局部按钮自行伪造已备份状态。Keyless create/recover、导入 mnemonic/KeyTag 等当前语义为已备份的路径，不得错误显示备份 CTA。
- 已备份零资产是另一个普通 Native 状态。Legacy 在该状态的快捷动作是 `Add money + More`，而 Native 当前可能仍固定提供 `Send / Receive / Buy & Sell / More`；零资产 banner 也有正余额 gating。这两项列为 P1，不能用未备份 Hybrid body 掩盖。

#### 安全复现与 Pass / Fail

- 需要单独的“标准 mnemonic 新建但尚未备份”隔离 fixture，从创建确认前开始录屏，连续覆盖创建完成、首次进入 Home、备份 CTA 点击、备份流程返回 Home。另需已备份零资产、Keyless、导入 mnemonic/KeyTag 四类对照 fixture；每类先临时切 Legacy 获取同状态基准，再恢复 Native 默认路径执行 A/B。
- **Pass：** 首个 Home 内容帧直接是 Native shell + 完整 RN 未备份 CTA；从未出现 `$0 + 普通 Tabs/Market/Earn`；CTA 可真实进入原备份流程；完成后普通 Native Home 单次稳定出现，无 `empty -> full -> empty`、无 content offset 跳变。已备份/Keyless/导入态不出现错误备份 CTA，零资产动作和 banner 与 Legacy 一致。
- **Fail：** 任意一帧先出现普通 Home、Market/Earn 或错误动作；未备份 CTA 缺失/重复；点击只改变本地 UI 而未走权威备份流程；备份后仍停留旧 body；Keyless/导入态被当成未备份；用退回整页 Legacy 规避问题。
- 当前只有历史 `.tmp/ui/home-after-onboarding-close.png` 可作为线索，不是当前同状态 A/B，也不能作为通过证据。

### 场景二：第一次启动、no-wallet 与 onboarding gate

#### 代码事实、时序推断与产品边界

- 代码事实：Root 初始 route 是 Main；Main/Home 会挂载 `HomePageContainer`，Native feature flag 只检查 Nitro/dev switch；`OnboardingOnMount` 随后异步通过 bg `serviceOnboarding.isOnboardingDone()` 获取 verdict。该 bg service 依据本地 DB 数量判断，而不是单一同步 first-launch flag；false 后才把 root route 重置为 `[Main, Onboarding]`，让 RN Onboarding 位于最上层。
- 代码事实：iOS main 与 bg 是独立 Hermes runtime，main ready 不能代表 bg 已完成 onboarding verdict。Splash 当前在 mount effect 中结束，Native 的 no-wallet 判断又比 Legacy 少 storage init、active account init、wallet list verdict 等 readiness 条件。
- **尚未实证的 P0 推断：** 在慢 bg 冷启动或 transport 尚未 ready 时，Main/Native Home 可能短暂可见或可交互，然后才切入 Onboarding；已有有钱钱包也可能先出现 Native EmptyWallet 再变成真实账户。当前没有真实 fresh fixture 录到该泄漏，文档只能记为结构性高风险，不能宣称已发生隐私泄漏。
- 产品决策是 Onboarding 本身继续使用现有 RN 页面，不做 Swift/UIKit 重写。启动状态必须明确为 `unknown -> onboarding | main`；在 bg 返回权威 verdict 前保持 opaque launch/splash gate。允许 Main/Native Home 在下面预热，但必须同时满足不可见、不可 hit-test、不可进入 accessibility tree，并且不能提前发送会改变业务状态的 Home 交互。
- no-wallet gate 需要同时等待 storage、wallet list、active account 与 bg onboarding verdict，不能把“尚未初始化”当作“确定无钱包”。如果后续恢复 cache-aware splash，需要审计 Native Home 是否提供与 Legacy `HomePageReady` 等价且只在真实内容可展示时触发的 ready contract。

#### 安全复现与 Pass / Fail

- 需要一个从未完成 onboarding、没有钱包和账户数据的独立 fixture；必须在 app process 启动前开始录屏，并把 main ready、bg ready/bootId、transport ready、`isOnboardingDone` request/response 和 route reset 按时间关联。另需已有有钱钱包的真正 cold start 对照，检查是否出现 EmptyWallet 中间帧。
- **Pass（fresh/no-wallet）：** Get Started/Onboarding 是首个可见且可交互业务帧；在此之前 0 个 Search、Account、Balance、Wallet Tab、Market、EmptyWallet 或普通 Wallet Home 像素，accessibility 也无法命中 Home。**Pass（已有钱包）：** gate 结束后首帧直接为正确账户的 Native Home，没有 EmptyWallet/Legacy/空白中间态。
- **Fail：** verdict 前任意 Home 像素或可点击/accessibility 元素暴露；main ready 被当作 bg verdict；先显示 EmptyWallet/错误账户再替换；通过隐藏 Onboarding 或把 Onboarding 改成 Native 规避 gate 问题。
- 当前有钱多链 Simulator 不能安全转换成 fresh/no-wallet fixture，因此该 P0 的真实 UI 通过目前受 fixture 阻断；可以先完成源码、聚焦单测与现有钱包的回归，但不得据此标记真实首次启动通过。

### 场景三：单链有钱钱包

#### Native 范围与当前代码事实

- Native Home feature gate 当前没有 All Networks、资产数量或 wallet type 的 Legacy fallback，因此普通 EVM、BTC merge-derive、imported、watching、external 与 hardware 的单链有钱钱包都属于 Native Home 范围。后续发现差异必须修正能力和 Hybrid slot，不能为这些账户退回 Legacy。
- Native owner：Header、顶层 Tab、Token/NFT/History/DeFi 列表、snapshot、cell、纵向/横向滚动和首帧 cache。RN Hybrid owner：Account/Network selector、More、AddressTypeSelector、Explorer 选择、复杂详情和业务 modal。硬件钱包通信继续由 bg 负责，严禁移入 main/UIKit。
- 共享 `useHomeWalletTabSupport` 的 All Networks 语义是 DeFi 始终可用、Perps 只受全局 disabled；单链则由 bg capability map 和 NFT supported-network config 决定。单链第一次读取期间 `isReady=false`，DeFi/Perps 暂时 false。
- 当前 support hook 使用单个 `lastReadyResultRef`，存在跨 scope 复用风险：从已支持的 EVM 切到不支持的 BTC 时，可能暂时复用前一网络的 Tabs。部分现有测试可能固化该行为。正确 owner 应按 account/network scope 保存 confirmed result，只允许同 scope stale-while-revalidate，禁止跨网络沿用 capability；这是单链连续切换的 P0 数据一致性项。
- 单链数据语义与 All Networks 不同：只显示当前账户数据；BTC 还需要 merge-derive；行内通常不显示重复网络 badge，native coin 使用 gas accessory；Header 是单网络 selector；History 是单链 pagination；普通链 footer 直接走对应 Explorer，BTC merge-derive 复用 AddressTypeSelector。Native 不能把 All Networks DTO/交互原样套用。
- imported private-key、watching、external 与 hardware 的可用 actions 不同。Native 当前动作若无条件展示 Send/Receive/Buy & Sell 等，会让不可写账户暴露无效操作；必须复用现有 capability owner，不能根据 wallet type 字符串在 Swift 猜测。

#### 已有证据与证据缺口

- BNB 有较强 Native 页面和交互证据，但 fixture 实际是多链 HD wallet 切换到 BNB，不等价于真正单链 imported/watching 钱包。BTC 已有 Native Spot/History、merge pagination、footer 与 AddressTypeSelector 证据，但没有最终完整同状态 Legacy / Native A/B，也没有 BTC 选择具体地址后外部 Explorer 的末端录屏。
- 旧 Ethereum differ 早于近期滚动、Dynamic Type、图片和 History 修复，不能作为当前提交的通过证据。现有多链有钱钱包证据只能证明回归基线，不能外推为单链冷首帧和 wallet-type action 能力。
- P0 缺口：supported EVM cold first frame；EVM -> BTC -> EVM 连续切换的 Tab capability、首帧、offset 和空白；按 scope cache 不串值。P1 缺口：Ethereum/BNB/BTC 最终 A/B；真正 imported private-key、watching、external、hardware fixtures 的 action 能力；已备份零资产动作；非空 NFT；DeFi action/detail；普通单链 Explorer 和 BTC 最终 Explorer 跳转。P2 缺口：这些状态组合下的 Dark mode、Dynamic Type、pressed/selected、图片全候选失败和业务失败回滚。

#### 安全复现与 Pass / Fail

- 为 EVM、BTC merge-derive、imported private-key、watching、external、hardware 分别准备独立 fixture；每个 fixture 固定 theme、Dynamic Type、locale、服务端 config 和真实数据，先在同一 Debug 包临时切 Legacy 采集基准，再恢复 Native 默认路径并重新执行标准 `yarn app:ios`。
- supported EVM 冷启动必须从启动前录到 bg capability ready 后；连续执行 EVM -> BTC -> EVM 两轮，并对每次点击的首帧、1s settled、Tab 集合、选中态、outer/page offset 和内容高度逐帧检查。所有坐标操作必须截图后立即执行，旧坐标因异步 section 位移造成的误命中一律作废。
- **Pass：** 每个 network scope 首帧直接使用同 scope cache 或稳定 skeleton，不出现前一网络独有 Tab/行；bg verdict 后只进行一次符合预期的稳定收敛；真实可用 action 与 Legacy/capability 相同；History、NFT、DeFi、Explorer 真实可交互；切换不白屏、不大空白、不跳 offset、不串 badge/logo/账户。
- **Fail：** EVM 的 DeFi/Perps 暂时出现在 BTC；前一网络 rows 或图片串入下一网络；unsupported action 可点击后才报错；BTC merge-derive 数据丢失/重复；footer 或 selector 只存在但不可完成；用 Legacy fallback、假数据或硬编码 Tab 规避服务端能力。

### 优先级与后续任务顺序

1. **P0-A，已开始：** 编写 subagent 实现未备份 HD 的 Hybrid content state；保留 Native shell，复用 RN `NotBackedUpEmpty`，隐藏普通 Tabs/Market/Earn/actions，并建立 wallet/account/backup verdict readiness。独立验收 subagent 先做源码和聚焦测试审计；真实 UI 保持 blocked，直到有安全 fixture。
2. **P0-B，已开始：** 编写 subagent实现 `unknown -> onboarding | main` 可见性 gate，确保 verdict 前 Home 不可见、不可点击、不可访问；同时收紧已有钱包的 no-wallet readiness。独立验收 subagent检查 main/bg 时序和测试，fresh fixture 未提供前不得宣称 UI Pass。
3. **P0-C：** 将单链 capability cache 改为 account/network scope owner，补 EVM -> BTC -> EVM 竞态和 cold first-result 测试；由另一个编写 subagent执行，避免与前两项共享文件冲突，再由独立验收 subagent复核。
4. **P1：** 已备份零资产 actions/banner parity；EVM/BTC DTO、badge/gas accessory、History footer/Explorer；imported/watching/external/hardware action capability；每项先做同状态 Legacy/Native 代码走查，再由编写 subagent修复。
5. **P1/P2 UI：** 取得隔离 fixtures 后，由 UI 验收 subagent使用 Debug 包完成首次创建、首次启动、单链各类型的全流程录屏、首帧/settled 截图、自动 differ 和真实点击；最后覆盖 Dark mode、Dynamic Type、pressed/selected、全部图片候选失败及错误回滚。
6. 每个子项只有在“编写 subagent完成 -> 独立代码验收 subagent通过 -> 标准 `yarn app:ios` 更新 Debug 包 -> 独立 UI 验收 subagent真实通过 -> handoff 更新”后才允许标为完成。若 fixture 不可安全取得，必须记录 Blocked/Partial，不能修改当前钱包制造绿色证据。

### 绝对数据安全与 fixture 要求

- 当前 Simulator `4837E819-A117-4E08-9936-445785D199E3` 是多链有钱钱包真实现场，必须保持钱包、账户、网络、收藏、数据库和持久化数据。绝对禁止把它改造成空钱包/no-wallet/首次启动 fixture；禁止 uninstall、reinstall、erase、clear data，禁止删除 app container、钱包数据库或持久化文件。
- iOS 只允许从仓库根目录执行 `yarn app:ios`，由其完成 Debug build、更新安装和启动；不使用 Release、自定义 `xcodebuild`、`CODE_SIGNING_ALLOWED=NO`。fixture 若需要独立 Simulator、预置账户或 Debug seam，必须与当前现场隔离并经过主 agent 范围确认，不能靠清理当前设备获得。
- 不得记录或提交 mnemonic、private key、seed、硬件钱包敏感信息或真实地址隐私数据。测试 fixture 只能使用授权的非敏感测试账户；硬件通信仍在 bg。
- 隔离 fixture 缺失是有效阻断，不是授权扩张。代码测试可以先推进，但首次空钱包/首次启动/真正单链 wallet-type 的真实 UI 结论必须保持 Incomplete。

### iOS runtime scope 与资源所有权

- **main runtime：** Native Home/Hybrid body 的可见内容选择、Header、Tabs、snapshot/section patch、同 scope UI cache、scroll/content offset、pressed/selected、accessibility、图片 request 和 per-view state；Onboarding route 的可见呈现也在 main。
- **bg runtime：** `isOnboardingDone` 权威 verdict、wallet/account/backup/capability service 数据、Market/History/NFT/DeFi service、watchlist 和持久化读写；hardware-wallet communication 继续只在 bg。main 只能经 proxy 请求和接收序列化结果。
- iOS main/bg 使用独立 Hermes JS heap，wallet、account、capability 和 DTO 会分别序列化/反序列化并在两个 runtime 各有 JS 副本；main ready、transport ready、bg ready 和 onboarding/capability verdict 是不同事件，初始化顺序独立，不能假设 bg 先 ready。
- MMKV、数据库/文件句柄、图片和字体 cache 以及部分 Native singleton 是进程级共享 Native 资源；具体 Header/body 状态、cell constraint、represented image signature、request cancellation/retry、gesture/offset、pressed/hover、Tab capability cache 和 transition token 都属于 per-view/main 状态。共享 cache 不等于共享 JS 对象，也不能替代 per-scope identity 校验。

### 主 agent / subagent 职责矩阵

| 工作 | 责任角色 | 强制边界 |
| --- | --- | --- |
| 需求拆解、P0/P1 排序、文件冲突与 dirty scope 控制 | 主 agent | 不直接编写产品代码，不自行做代码/UI Pass 判定 |
| 未备份 Hybrid、启动 gate、单链 capability 和后续产品修复 | 对应编写 subagent | 每个 subagent 只改被分配范围；不得 reset/checkout/clean/stash，不得 commit/push，不得混入 Discovery/Swap/TradingView/Firmware/Performance 等无关改动 |
| 源码审查、聚焦 Jest/ESLint/Swift parse/diff-check | 独立代码验收 subagent | 与编写角色分离；失败必须给出可定位证据，不能由编写者自验收 |
| `yarn app:ios`、main/bg ready、真实截图/录屏、交互与 A/B differ | 独立 UI 验收 subagent | 只用 Debug；元素存在和编译通过不是 Pass；严格遵守数据安全与 fixture 边界 |
| handoff 内容协调、stage/commit/push 与最终结论汇总 | 主 agent | 产品行为和 Pass/Fail 只能引用 subagent 的实际结果；每轮完成后更新 handoff，并按用户要求 commit/push，不夹带无关 dirty files |

### 当前完成边界

- 本节完成的是三类新增状态的产品决策、Native/Hybrid 边界、风险分级、复现/验收标准、fixture 安全边界和 subagent 工作拆分；不是产品代码或 UI 完成声明。
- 当前可继续在不破坏真实钱包的前提下推进 P0 源码与聚焦测试；fresh/no-wallet、未备份 HD、已备份零资产、Keyless/导入和真正单链 wallet-type 的真实 UI 验收仍需隔离 fixture。后续 handoff 必须逐项填写实际修改文件、检查结果、Debug 更新、main/bg ready、截图/录屏路径和仍存在的阻断。

## 2026-07-18 三类新状态：本轮实现与独立代码验收进展

### 结论边界

- 本轮按上一节职责矩阵，由不同编写 subagent 完成四组实现，再由独立代码验收 subagent 多轮审计。四组最终都达到**聚焦源码/测试 Pass**；过程中任何 P0、lint 或测试失败都先退回编写 subagent 修复，再重新验收，没有把作者自测当作最终结论。
- 这里的 Pass 仅表示当前 diff 的 owner、竞态、类型、聚焦测试和平台 renderer 审计通过。fresh/no-wallet、未备份 HD、已备份零资产、Keyless、导入和真正单链 wallet-type 仍缺隔离 fixture 的真实 Debug UI 证据，不能据此声明首次启动、空钱包或单链 Native Home 已完成。
- 当前多链有钱钱包仍是唯一允许直接使用的真实现场；本轮实现没有授权把它转换成新场景 fixture，也没有授权清理其数据。Android renderer 已通过编译和单元测试，但 Android Debug 真机/模拟器的 RN body 滚动惯性仍没有录屏证据。

### P0-A：未备份 HD Hybrid content.body 与双平台 renderer

- 实现新增 `pending | notBackedUp | normal` 的 Native Home wallet state。只有 storage、active account init 和 active account ready 都完成，且 wallet 确认为未备份 HD 时，才进入 `notBackedUp`；imported 或已备份钱包继续走 normal。wallet-list 与 active-wallet generation 的最终判定没有在这个局部 helper 中重复实现，而是交给统一 launch/Home gate。
- `notBackedUp` 使用新的 `content.body` slot：Native Header 继续保留，普通 Tabs、pager、Market、Earn、banner 和普通 actions 不挂载；body 复用现有 RN `NotBackedUpEmpty` 与其键盘/滚动容器。`pending` 只提供不可交互的中性背景，不先暴露 `$0` 或普通 Home。
- iOS `HomeContainerView` 和 Android `HomeContainerView` 都增加 full-body slot host：挂载时隐藏 tabs/pager、禁用 Native body 滚动/refresh，并让 RN body 占据 Header 下方区域；卸载后恢复普通 Native Home。TS slot bridge/types 同步加入 `content.body`，没有在 Swift/Kotlin 重写备份业务。
- 第一轮独立审计为 **Fail**：Android Surface 的通用 gesture forwarding 会把 `content.body` 的 drag 转交给已经隐藏的 Native pager，属于 P0；同时 reviewer 指出 wallet-list verdict 不应只靠 Native 页面局部状态。修复后 `content.body` 明确保留 RN ScrollView 的 gesture ownership，普通 Header/footer slot 仍使用既有 Surface routing；wallet-list/current generation 纳入下面的统一 launch gate。
- 最终独立代码验收为 **Pass**：JDK 17 下 Android `compileDebugKotlin` 与 `testDebugUnitTest` 通过；Hybrid 聚焦 Jest 为 2 suites / 15 tests；Swift parse、type-aware lint、format 和指定 diff-check 通过。该结果证明 renderer/gesture route 代码可编译且分支受测试覆盖，不证明 Android Debug 的真实 inertia 手感。

### P0-B：always-mounted onboarding launch gate

- `OnboardingOnMount` 从 lazy Home owner 移到长期存在的 app/detail container，首次启动、非 Home deep link 和 WalletClear 时都能持有权威启动检查。native 启动状态使用 `unknown | onboarding | main`，并额外记录真实 foreground、`requiredHomeGeneration` 和 `readyHomeGeneration`。
- bg `serviceOnboarding.isOnboardingDone()` 是唯一 onboarding verdict；RPC reject 使用有界间隔持续 retry，不用 main timer 发布假 verdict。WalletClear 创建新的 authoritative token/generation；WalletUpdate 只排队做 maintenance，并等待当前权威检查完成，不能抢走启动 token。每次跨 `await` 后都检查 request 是否仍为 current，旧 handler 不能覆盖新 generation。
- onboarding 只有在真实 route reset 完成且 foreground 已经变为 onboarding 后才发布可见决定；Home 只有在 `decision=main`、account selector storage/active-account 初始化完成、wallet list 已返回、当前 active wallet 属于已 settled 的 wallet-list generation 后才标记当前 Home generation ready。Splash 的 5s timer只释放原 cache/task gate，不能替代 bg verdict。
- hidden prewarm 同时设置 `opacity=0`、`pointerEvents=none`、隐藏 accessibility descendants；DApp floating trigger、OneKey ID、notification registration、KYT、BTC fresh-address 等 foreground side effects 只在 Home generation 真正可见时挂载。desktop/web 继续走原单 runtime 分支，native split-runtime gate 没有全局套到其他平台。
- 第一轮 reviewer 报告 **4 个 P0**：owner 仍位于 lazy Home、WalletUpdate 会抢 authoritative token、RPC reject 会永久停在 unknown、没有 wallet-list verdict；另有 foreground reset 只是伪 await、hidden side effects 仍挂载、Home generation 不完整及平台边界等问题。第二轮仍因 `main + foreground=onboarding` 组合可能 deadlock、authoritative handler 跨 await 后可能 stale commit，以及 3 个 lint 错误而 Fail；第三轮 P0 已修复但 3 个 lint 仍未通过，仍不得标 Pass。
- 第四轮修复后独立 reviewer 才给出 **Pass**：launch 相关 4 suites / 52 tests 全部通过，覆盖 route foreground、bg reject retry、WalletUpdate serialization、WalletClear generation、旧 async handler 失效、wallet-list/current wallet readiness、hidden side-effect 和 Splash gate；type-aware lint、format、diff-check 通过。该结果仍需要 fresh/no-wallet 与已有钱包 cold launch 的真实逐帧验证。

### P0-C：per-scope capability、bg readiness、LRU 与 lifecycle

- Home 顶部 Tab capability scope 现在由 `indexedAccountId | accountId | walletId`、network id 和 all/single 标记共同组成，避免 EVM -> BTC -> EVM 或换账户时借用另一 owner 的 DeFi/Perps 结果。confirmed cache 只按相同 scope 读取，使用最大 8 项的 LRU；Perps global disabled 在读取 confirmed state 时重新应用，不把配置开关固化进旧 cache。
- 单链结果改用 bg 返回的 `enabledNetworksMap + isReady`；`isReady=false` 保持 neutral pending，不把暂空 map 当成 unsupported。All Networks 在 account/network owner 已确定后仍按既有产品 invariant 直接 confirmed；单链 RPC failure 返回 pending，并通过 enabled-network 事件、focus revalidation 和有限自动 retry 收敛。cache/request lifecycle 受 scope identity 保护。
- 第一轮独立审计为 **Fail**：丢失 bg `isReady`、consumer 忽略 readiness、Map 无界、hook 没有可靠 lifecycle revalidation。第二轮逻辑问题已修复，但 test cleanup 出现 TS2345，因此仍为 Fail。修复测试类型后独立 reviewer 给出 **Pass**：聚焦 capability 30 tests、type-aware lint、format、diff-check 全部通过。
- 该代码 Pass 只证明 scope 不跨 owner、pending/confirmed 和 lifecycle state machine；EVM -> BTC -> EVM 的真实 Tab 首帧、offset、无白屏和实际 bg 时序仍必须在单链 fixture 中录屏。

### P0-D：cold consumer 的 neutral pending、atomic snapshot 与 scoped Perps worth

- Legacy 与 Native consumer 都消费统一 `pending/confirmed` model。cold single-network capability pending 时不提交一个看起来已经最终完成的错误 Tab 集合，也不允许点击/外部 SwitchWalletHomeTab 改变选中项；Legacy 展示中性 pending strip/content，Native 提交带明确 `loading` renderer row 的 neutral portfolio surface。
- 第一版 consumer 仍会先把 Native tab shells 以空 sections 提交，再由 passive effects 分别 patch sections，可能产生首帧空白和选中项/内容不同步；pending RN slot 也没有 Native 可见 loading row。最终实现使用单次 full snapshot 原子提交 tabs、selected tab 与每个当前 section，后续实时数据更新才继续走 section patch。
- Perps net worth 现在携带 account/network `scopeKey`；旧 owner 的异步结果不能写入或展示为新 owner cache。旧合法 selected tab 只在 confirmed 新集合确实移除它后回落到 portfolio，不能在 pending 中间态触发抖动。
- 第一轮独立审计因此以“空 sections 的两阶段提交、pending 没有 loading row、Perps worth 跨 owner 污染”判 Fail。修复后 reviewer 给出 **Pass**：组合聚焦 Jest 2 suites / 39 tests、type-aware lint、format、diff-check 全部通过，其中覆盖 pending loading row、confirmed atomic snapshot 和 scoped worth 拒绝旧 owner 结果。

### 本轮产品文件清单与归属

- **Hybrid wallet/body：** `packages/kit/src/views/Home/nativeHomeWalletState.ts`、`nativeHomeWalletState.test.ts`、`NativeHomePage.native.tsx`；`packages/native-components/src/HomeContainer.types.ts`、`HomeContainer.native.tsx`；`packages/native-components/ios/HomeContainerView.swift`；`packages/native-components/android/build.gradle`、`HomeContainerSurfaceView.kt`、`HomeContainerView.kt`、`android/src/test/java/com/margelo/nitro/onekeynativecomponents/HomeContainerSurfaceGestureRoutingTest.kt`。
- **Launch/onboarding：** `packages/kit/src/provider/Container/index.tsx`、`SplashProvider.tsx`、`SplashProvider.test.ts`；`packages/kit/src/views/Onboarding/components/OnboardingOnMount.tsx`、`onboardingLaunchGate.ts`、`onboardingLaunchGate.test.ts`；`packages/kit/src/views/Home/pages/HomePageContainer.tsx`、`HomeWalletListProvider.tsx`、`homeLaunchVisibility.ts`、`homeLaunchVisibility.test.ts`、`homePageNoWalletContent.ts`、`homePageNoWalletContent.test.ts`。
- **Capability owner：** `packages/kit/src/views/Home/hooks/homeWalletTabSupportUtils.ts`、`useHomeWalletTabSupport.ts`、`useHomeWalletTabSupport.test.ts`。
- **Cold consumer：** `packages/kit/src/views/Home/homeWalletCapabilityTabModel.ts`、`homeWalletCapabilityTabModel.test.ts`、`NativeHomePage.native.tsx`、`pages/HomePageView.tsx`、`pages/HomeOverviewContainer.tsx`。共享文件只列一次提交，但这里按行为归属注明重叠。
- 本 handoff 只记录上述 subagent 结果。共享工作区既有 `yarn.lock`、Performance、Discovery、Swap、TradingView、Firmware 和其他未提交文件不属于本轮 Native Home 状态矩阵修复，不得为通过检查而回滚，也不得未经范围核对混入提交。

### 检查、root TypeScript 阻断与仍未通过的 UI

- 四组聚焦结果分别为：Hybrid 2 suites / 15 tests + Android JDK 17 compile/unit tests + Swift parse；launch 4 suites / 52 tests；capability 30 tests；cold consumer 2 suites / 39 tests。各组最终 reviewer 都报告 type-aware lint、format 和 diff-check 通过。数字存在组合测试重复，不能相加成“总测试数”。
- root TypeScript 仍被两条共享工作区既有错误阻断：`apps/desktop/web-build/static/js-sdk/data/config.ts:2` 缺少 `config.perfReady`；`packages/kit/src/views/Home/NativeHomePageView.native.tsx:15` 引用的 `HOME_HEADER_SEARCH_ROW_HEIGHT` 没有 export。独立 reviewer 报告聚焦新增文件没有额外类型错误；禁止修改这两个无关 owner 只为制造全量绿色结果。
- **仍无 UI Pass：** fresh/no-wallet 首次启动、未备份 HD、已备份零资产、Keyless、导入 mnemonic/KeyTag、真正 imported private-key/watching/external/hardware 单链钱包，以及 EVM/BTC 真正单链 cold first frame 都没有隔离 fixture 的 Legacy/Native A/B、逐帧录屏和完整交互证据。
- 当前有钱多链钱包只允许做非破坏性 Debug 回归：标准更新后确认账户/余额/Token/NFT/DeFi/History 数据仍在；main 与独立 bg 都 ready；Home 首帧没有 opacity gate 卡死；All Networks 五个顶层 Tab 规则、Market 三类、History footer、BTC 已有 selector、滚动惯性、底部 inset、Dark/Light、Large/XXXL、Star、图片正常/强制失败态没有明显回归。它不能证明 no-wallet、未备份、Keyless、导入或真正单链状态。

### 下一步 Debug 与独立 UI 验收

1. 先由主 agent 核对产品 diff、无关 dirty 文件和提交范围；不能把本节代码 reviewer Pass 直接改成 UI Pass。
2. 由独立 UI 验收 subagent 从仓库根目录执行唯一允许的 `yarn app:ios`，让它构建、签名、更新安装并启动 Debug 包；禁止 Release、自定义 `xcodebuild`、`CODE_SIGNING_ALLOWED=NO`，禁止 uninstall/reinstall/erase/clear data 和删除 container/数据库。
3. 在当前有钱多链钱包完成上述非破坏性回归，并记录 Debug binary、main ready、独立 bg ready/bootId、钱包数据、真实截图/录屏和失败项。main ready 不能代替 bg ready。
4. fresh/no-wallet、未备份 HD、已备份零资产、Keyless/导入和真正单链各 wallet type 继续保持 Blocked/Incomplete，直到主 agent 获得与当前钱包完全隔离且获授权的 fixture；届时由另一独立 UI subagent按上一节 Pass/Fail 标准执行同状态 Legacy/Native A/B。
5. Android 仍需标准 Android Debug 包的真实 `content.body` 双向 drag、fling/deceleration、CTA 点击与退出 Hybrid body 录屏；Kotlin compile 和 unit test 不能替代惯性证据。在取得该证据前，Android Hybrid gesture 只能标记 code Pass / UI Pending。

## 2026-07-19 iOS Debug：启动 gate、Market 回归与单链 DeFi 插入复测

本节更新上一节的真实 Debug 状态。三轮均从仓库根目录执行标准 `yarn app:ios`，由该命令完成 Debug build、Metro、更新安装和启动；没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`，没有执行 uninstall/reinstall/erase/clear data，也没有删除 simulator app container、钱包数据库或其他持久化数据。

### 第一轮：当前有钱钱包冷启动黑 Splash，真实 UI Fail

- 第一轮 `yarn app:ios` 构建、更新安装和启动成功，但当前有钱多链钱包停留在黑色 Splash 超过 15 秒。该轮虽然 main runtime 已启动、独立 bg runtime 已 ready，仍属于真实 UI **Fail**，不能用编译成功或 runtime ready 代替 Home 可见。
- 诊断快照为 `decision=main`、`foreground=unknown`、`readyHomeGeneration=2`、`requiredHomeGeneration=2`，真实 route 已是 `main > Home > TabHome`，但 `nativeLaunchReady=false`。bg 的 `bootId=1784361570900-9um2iao8`、`status=ready`，说明阻断不是“bg 未启动”，而是首次 React Navigation state 没有传给长期存在的 foreground/launch gate。
- 关键证据：`.tmp/ui/native-home-launch-gate-diagnostic-20260718.json`；当轮应用日志证据为 `/Users/huhuanming/.agent-device/sessions/native-home-p0/app.log.1`。日志可能随后轮转，JSON 中的 route、generation、main/bg 状态是该次失败的稳定记录。

### 初始 Navigation state 修复：独立代码验收 Pass

- 修复为每个 `NavigationContainer` 独立维护 event store：`listeners`、`isReady` 和 `currentState`。`onReady` 从该 pane 的真实 navigation ref 读取 `getRootState()`，原子写入 ready/current state 并广播；重复 `onReady` 不产生第二次广播；ready 后的 `onStateChange` 才继续更新。
- split view ref 不再混用：MAIN pane 使用 `tabletMainViewNavigationRef`，detail/SUB/普通容器使用 `rootNavigationRef`。晚订阅者只在 store 已 ready 时 replay 真实 `currentState`，不再根据另一个 ref 猜测首次状态。
- listener 使用稳定 callback ref、`Set` 和 cleanup，避免 rerender/StrictMode 造成重复订阅；production `useRouterConfig().containerProps.onReady` 也进入集成测试，而不是只测辅助函数。该修复补齐 `event store + split ref + no-double + production onReady` 四个边界。
- 多轮独立 review 曾因 split ref、重复 handshake 和 production 测试缺口判 Fail；修复后 reviewer 给出代码 **Pass**。最终聚焦结果为 6 suites / 60 tests，覆盖 Navigation events、production integration 和 launch gate；type-aware lint、format 与指定 diff-check 通过。root TypeScript 仍只有上一节已记录的 Desktop `config.perfReady` 和旧 Native Home header export 两个共享工作区阻断，未为制造绿色结果混修。

### 第二轮：foreground 修复后的真实启动与 Market 回归 Pass

- 第二次标准 `yarn app:ios` 后，命令启动和随后两次 relaunch 都直接进入当前有钱钱包；逐帧证据没有出现 Empty Wallet、backup onboarding 或白屏。账户、余额和钱包数据正常显示。
- 第一次 relaunch 的 launch gate 为 `decision=main`、`foreground=home`、generation `2/2`、`nativeLaunchReady=true`，`jsReadyAt=1784388844373`、`uiVisibleAt=1784388848522`；独立 bg `bootId=1784388846110-3bg8vv7y` 且 transport ready。第二次 relaunch 同样为 `main/home/2/2`，`jsReadyAt=1784388905851`、`uiVisibleAt=1784388909797`，独立 bg `bootId=1784388907677-yl2tz32a` 且 ready。两次都证明 main ready、bg ready 和真实 Home 可见三个条件分别成立。
- 启动证据：`.tmp/ui/native-home-after-foreground-fix-splash-to-home.mp4`、`.tmp/ui/native-home-after-foreground-fix-splash-to-home-contact-sheet.png`、`.tmp/ui/native-home-after-foreground-fix-home-clean.png`、`.tmp/ui/native-home-after-foreground-fix-relaunch-initial.png`、`.tmp/ui/native-home-after-foreground-fix-relaunch-settled.png`、`.tmp/ui/native-home-after-foreground-fix-launch-gate-diagnostic.json`、`.tmp/ui/native-home-after-foreground-fix-runtime-probe.json`、`.tmp/ui/native-home-after-foreground-fix-relaunch-gate-diagnostic.json`、`.tmp/ui/native-home-after-foreground-fix-relaunch-runtime-probe.json`。
- 当前有钱钱包的 Market `Favorites -> Trending -> Stocks` 与返回切换获得 immediate/settled 截图和录屏；三个分类首帧直接显示缓存 rows，没有 `rows -> empty -> rows` 白屏。该项真实 UI **Pass**。证据：`.tmp/ui/native-home-after-foreground-fix-market-tab-switch-current-funded.mp4`、`.tmp/ui/native-home-after-foreground-fix-market-trending-immediate-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-market-trending-settled-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-market-trending-return-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-market-stocks-immediate-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-market-stocks-settled-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-market-stocks-switch-current-funded.mp4`。
- Debug 中仍可见既有 Dev Gallery LogBox 历史外部告警；它不是本次 launch gate 或 Native Home 修改引入的问题，不得把 Discovery/Dev Gallery 无关代码混入本轮。留档证据：`.tmp/ui/native-home-after-foreground-fix-logbox-detail.png`、`.tmp/ui/native-home-after-foreground-fix-logbox-log-snippet.txt`、`.tmp/ui/native-home-after-foreground-fix-logbox-relaunch-2.png`。

### All Networks -> Ethereum：原 Fail、Swift 修复与仍未关闭的 UI 边界

- foreground 修复后，在非零 Home offset 从 All Networks 切换到 Ethereum，真实录屏捕获到 Market 前方的异步 DeFi section 单帧硬插入，导致 Market 及下方 section 突然位移。该轮是明确的真实 UI **Fail**，不是 capability Tab 白屏，也不能用最终 settled 截图掩盖。证据：`.tmp/ui/native-home-after-foreground-fix-single-network-current-funded.mp4`、`.tmp/ui/native-home-after-foreground-fix-single-network-immediate-current-funded.png`、`.tmp/ui/native-home-after-foreground-fix-single-network-settled-current-funded.png`。
- Swift 修复针对 `portfolio-defi` section 的 structural diffable 更新：仅当结构变化全部属于该 DeFi section 时启用平滑 diffable animation，让 Market 及下方 section 单向连续移动，避免无动画替换造成的单帧硬插入；普通数据 patch 仍保留既有更新路径。独立代码 reviewer 已给出 **Pass**；这只代表根因路径和实现边界通过代码审计，不等于原非零锚点 UI 已验收。
- 第三次标准 `yarn app:ios` 后，All Networks -> Ethereum 的顶部 offset 录屏切换平滑，未再捕获硬插入。证据：`.tmp/ui/native-home-after-defi-animation-fix-allnetworks-to-ethereum-current-funded.mp4`、`.tmp/ui/native-home-after-defi-animation-fix-allnetworks-to-ethereum-current-funded-contact-sheet.png`、`.tmp/ui/native-home-after-defi-animation-fix-ethereum-immediate-current-funded.png`、`.tmp/ui/native-home-after-defi-animation-fix-ethereum-settled-current-funded.png`。
- 但原 Fail 发生在**非零 Market 锚点**。后续自动化尝试在该锚点录屏时误命中底部 Discover，`.tmp/ui/native-home-after-defi-animation-fix-nonzero-anchor-before-current-funded.png`、`.tmp/ui/native-home-after-defi-animation-fix-nonzero-retry-anchor-before-current-funded.png` 和 `.tmp/ui/native-home-after-defi-animation-fix-nonzero-final-drag-1-current-funded.png` 只能证明坐标漂移/误命中，不能作为通过或失败证据。因此本项当前结论是：Swift code **Pass**、顶部 offset UI **Pass**、原非零 Market 锚点 UI 仍 **Pending/Blocked**。下一轮必须截图后立即短 batch 点击正确 selector，并保留切换前、immediate、transition、settled 多帧；误命中不得计入结果。

### 最终现场、仍 Blocked 的状态与 runtime 边界

- 最终已恢复 Wallet、All Networks 和 `+16` 多链选择器，当前有钱钱包数据仍在。恢复证据：`.tmp/ui/native-home-after-defi-animation-fix-nonzero-final-allnetworks-restored-current-funded.png`；第三轮命令启动证据：`.tmp/ui/native-home-after-defi-animation-fix-command-launch-current-funded.png`、`.tmp/ui/native-home-after-defi-animation-fix-home-clean-current-funded.png`。
- 以下状态仍没有隔离 fixture 的真实 Debug 证据，继续保持 **Blocked/Incomplete**：fresh/no-wallet 首次启动、未备份 HD、已备份零资产、Keyless、导入 mnemonic/KeyTag、真正 imported private-key/watching/external/hardware 单链钱包、EVM/BTC 真正单链 cold first frame，以及 Android Hybrid gesture 的真实双向惯性。不得拿当前有钱多链钱包切换 Ethereum 的结果冒充“真正单链钱包首次启动”。
- iOS/Android 是 split-runtime：main runtime 负责 Navigation event store、foreground/launch visibility、Native Home snapshot/section patch、Market selection/cache、DeFi structural diffable 呈现和 UI offset；bg runtime 负责权威 onboarding verdict、wallet/account/capability、Market/DeFi service 与持久化数据。main 与 bg 使用独立 Hermes heap，proxy 数据会分别序列化/反序列化，初始化顺序独立，main ready 不能代替 bg ready。
- DB/MMKV/file handles、图片/字体 cache 和 native singleton 属于进程级共享 Native 资源；navigation container event store 是 main heap 内的 per-container 状态；UIKit constraint、diffable snapshot、scroll/offset、represented image signature、request cancellation、pressed/selected/hover 属于 per-view 状态。不能把共享 cache 的命中推导成某个 cell/view 的约束或复用状态正确。

## 2026-07-19 EmptyWallet 同状态 A/B、Native Fail 与 RN 页面级新决策

### 本节结论与证据边界

- 本轮已经在同一个未备份 HD 钱包状态下完成 Native 与 Legacy RN 的真实 iOS Debug A/B。Native `content.body` 方案为明确的真实 UI **Fail**；Legacy RN 是当前可交互的产品基准，不是仅凭源码推断或元素存在得出的结论。
- A/B 使用当前 Debug/Metro 现场临时切换 `nativeHomeFeatureFlag.native.ts` 采集 Legacy，完成后已恢复 Native 默认值；`packages/kit/src/views/Home/nativeHomeFeatureFlag.native.ts` 当前无 git diff。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`，没有执行 uninstall/reinstall/erase/clear data，也没有删除 app container、钱包数据库或持久化文件。
- 本轮 A/B 没有完成真实 backup 流程，因此没有修改钱包 `backuped` 状态；Legacy 证据只真实打开并关闭了 More backup options 的 Backup sheet。Native Fail 和 Legacy 基准均来自同一未备份状态，不能外推为已备份零资产、fresh/no-wallet 或普通有钱钱包已经通过。
- 全部证据位于 `.tmp/ui/native-home-empty-wallet-ab-20260719/`。核心并排图为 `native-home-empty-wallet-legacy-vs-native-402.png`，像素 differ 为 `native-home-empty-wallet-legacy-vs-native-diff-402.png`；Native 与 Legacy 的 viewport、录屏、contact sheet、gesture telemetry、Backup sheet 和 runtime/launch probe 均保留在同一目录。

### 同状态量化 A/B 与交互结果

| 检查项 | Legacy RN 基准 | 当前 Native `content.body` | 结论 |
| --- | --- | --- | --- |
| Header/body 分界线 y | 262 | 364 | Native 多保留 102pt Header 空间 |
| illustration/body 内容位置 | 基准 | illustration、标题、描述和 CTA 整体下沉约 198.67pt | Native 几何 Fail |
| 首帧 primary CTA | `Backup to iCloud` 完整可见且位于底部 Tab 之上 | 被浮动 Tab bar 覆盖 | Native Fail |
| 首帧 secondary CTA | `More backup options` 完整可见 | 已超出屏幕 | Native Fail |
| 向上/向下 swipe | 内容保持可用；当前短内容首帧已完整，不依赖补救性滚动 | body 不产生有效滚动，手势反而触发顶部 `Refreshing...` | Native scroll owner Fail |
| More backup options | 真实打开标题为 `Backup` 的 sheet，显示 `Manual backup / OneKey Lite / OneKey KeyTag`，关闭后页面恢复 | 首帧无法触达 secondary CTA | Legacy 交互 Pass / Native Fail |

- Native 首帧与滚动证据：`native-home-empty-wallet-native-before-viewport.png`、`native-home-empty-wallet-native-before-bottom.png`、`native-home-empty-wallet-native-before-scroll.mp4`、`native-home-empty-wallet-native-before-scroll-contact-sheet.png`、`native-home-empty-wallet-native-before-scroll-down.mp4`、`native-home-empty-wallet-native-before-scroll-down-settled.png` 以及对应 `.gesture-telemetry.json`。contact sheet 中真实出现了顶部蓝色 `Refreshing...`，但 backup body 的几何位置没有得到有效修正；不能把“收到 swipe”写成“RN body 能滚动”。
- Legacy 首帧与交互证据：`native-home-empty-wallet-legacy-reference-viewport.png`、`native-home-empty-wallet-legacy-reference-bottom.png`、`native-home-empty-wallet-legacy-reference-scroll.mp4`、`native-home-empty-wallet-legacy-reference-scroll-contact-sheet.png`、`native-home-empty-wallet-legacy-reference-backup-entry.mp4`、`native-home-empty-wallet-legacy-reference-backup-sheet.png`、`native-home-empty-wallet-legacy-reference-backup-sheet-dismissed.png` 以及对应 `.gesture-telemetry.json`。
- Legacy 的两个 CTA 在首帧都完整可见，并且 secondary CTA 的 tap 真实打开业务 sheet。Native primary CTA 后方只能透出部分文字，secondary CTA 完全不在 viewport 内；不能以“继续滑动可能可达”降级本轮 Fail。

### main/bg、launch gate 与最终现场

- Native A/B 前 probe 显示 main `jsReadyAt=1784391444138`、`uiVisibleAt=1784391447793`；独立 bg `bootId=1784391445824-4vq3ioo9`、`status=ready`，transport ready。launch gate 为 `decision=main`、`foreground=home`、generation `2/2`、`nativeLaunchReady=true`。证据：`native-home-empty-wallet-native-before-runtime-probe.json`、`native-home-empty-wallet-native-before-launch-gate.json`。
- 最终恢复 Native 默认路径后的 probe 显示 main `jsReadyAt=1784395805680`、`uiVisibleAt=1784395808144`；独立 bg `bootId=1784395807275-kwuqq73k`、`status=ready`，transport ready。launch gate 仍为 `main/home/2/2` 且 `nativeLaunchReady=true`。证据：`native-home-empty-wallet-native-final-runtime-probe.json`、`native-home-empty-wallet-native-final-launch-gate.json`。
- 恢复截图为 `native-home-empty-wallet-native-final-restored-proof.png` 与 `native-home-empty-wallet-native-final-restored-proof-clean.png`。main ready、bg ready、Home 可见和 feature flag 恢复分别有证据，但这些条件不能抵消 Native EmptyWallet 的几何/手势 Fail。
- iOS 是 split-runtime：main runtime 负责 page surface 选择、RN/Native tree 挂载、Header/body layout、scroll/refresh、accessibility 和整页切换；bg runtime 负责权威 wallet/account/backup 状态、`updateWalletBackupStatus`、wallet list 和持久化。两个 Hermes heap 独立，wallet DTO 经 proxy 分别序列化/反序列化，main/bg 初始化顺序独立。
- DB/MMKV/file handles 与部分 Native singleton 是进程级共享 Native 资源；RN component state、Native Header/body frame、ScrollView offset/refresh、pressed/selected 与 transition state 属于 main/per-view 状态。共享 DB 已更新不等于 main 已收到当前 wallet generation，也不能用共享 cache 代替页面分流的 scope identity。

### 源码根因：为什么 Native 比 Legacy 下沉

- Legacy `HomePageView.tsx` 对未备份 HD 的判断只有 `wallet.type === WALLET_TYPE_HD && !wallet.backuped`，没有余额条件；其未备份分支使用一个 `Keyboard.AwareScrollView` 顺序渲染 `renderHeader()` 与现有 RN `NotBackedUpEmpty`。`renderHeader()` 复用 `HomeHeaderContainer`。
- Legacy `HomeHeaderContainer` 在未备份态隐藏普通 WalletActions 和 banner，并且不设置普通 Native 页面使用的 182/292 最小 Header 高度，因此 Header 随真实 account/balance 内容自然收缩。Legacy `$0` 是现有基准的一部分；本轮失败不是“存在 `$0`”，而是 Native 在 actions/banner 已隐藏后仍保留普通 Header 的空高度。
- 当前 `NativeHomePage.native.tsx` 的 `content.body` 在 Header 后挂载 `Keyboard.AwareScrollView + NotBackedUpEmpty`；iOS `HomeContainerView.swift` 无 banner 时仍把 Header `preferredHeight` 固定为 `216 + headerBottomPadding(40) = 256pt`，Android 同类实现仍保留 216dp。body host 再从 `headerHeight` 开始，仅获得 `bounds.height - headerHeight`。
- `NotBackedUpEmpty` 自身使用 `flex=1`、`justifyContent=center`、上下 padding，包含 180pt illustration、标题/描述与两枚大按钮；当 Native 固定 Header 吞掉额外高度后，整个 body 被迫下沉。iOS swipe 又落到 Native outer refresh owner，真实结果是显示 `Refreshing...` 而不是滚动 RN body。
- 上述根因能够解释 102pt divider 差与约 198.67pt 内容下沉，但用户已经决定不再继续修补 `content.body` 的 Header 高度、inset 或 gesture forwarding。现有 Hybrid 代码可在页面级新路径验证完成前暂时保留，后续清理必须单独审计；不得继续在 Swift/Kotlin 复制未备份业务或堆更多特殊布局分支。

### 用户确认的新产品与架构决策

- 新增精简 RN `EmptyWalletHomePage`，使用 discriminated `variant`。本次只实现 `notBackedUp`；未来可增加 `backedZero`，但不能为了预留未来分支在本轮引入余额 owner、假数据或不可达 UI。
- `notBackedUp` 表示“钱包真实存在、标准 HD、权威 `backuped=false`”，不是“余额等于零”。即使该钱包先收到资产，只要尚未完成备份，仍必须继续显示备份安全提示；禁止以充值、token rows 出现或 balance 变正为条件提前切 Native。
- `backedZero` 是未来“已备份零资产”variant，届时才根据已定义的零资产权威状态决定页面及充值后切 Native。该未来 variant 不能与本次未备份安全态混为一谈。
- fresh/no-wallet 继续由现有 onboarding/no-wallet gate 独立处理，不属于 `EmptyWalletHomePage`。在 bg onboarding verdict、wallet list、storage 与 active account/current generation 全部 settle 前，不能把 `undefined wallet` 当成未备份 wallet，也不能提前露出 EmptyWallet 或 Native Home。
- 页面级分流放在 `HomePageContainer.tsx` 的 `HomeLaunchGatedContent`：该 owner 已同时持有 active wallet/account、bg wallet list、storage init、active-account init/ready 和 onboarding launch snapshot。只有 current wallet 属于已 settled wallet-list generation，且 active/list 两份 wallet 对同一 id 的 type/backuped verdict 一致，才提交页面 surface。
- surface 顺序为：`pending/unknown -> opaque gate`；resolved HD + `backuped=false -> EmptyWalletHomePage(notBackedUp)`；resolved normal wallet -> feature enabled 时 `NativeHomePageView`，否则 Legacy；`no-wallet -> onboarding/no-wallet owner`。不得把 wallet 条件塞进全局 `nativeHomeFeatureFlag`，也不得用整个 Legacy fallback 规避 normal Native Home。
- 用户接受备份完成后的整页重渲染。切换必须由 bg 权威 `serviceAccount.updateWalletBackupStatus()` 写 DB 并发送 `WalletUpdate` 后，等待 Home wallet-list 与 active wallet 同 scope 收敛到 `backuped=true`，再只执行一次 `EmptyWalletHomePage -> NativeHomePageView`。按钮点击不能本地伪造已备份状态。
- WalletUpdate refetch pending 期间，同 wallet 可以保留上一已解决 RN surface，避免 `RN -> blank -> Native`；若 active wallet id 改变，必须立即禁止旧钱包 CTA 继续交互并 fail closed，等待新 scope verdict。不能把旧 wallet 的 sticky surface 显示成新 wallet。
- 不挂载隐藏的 `NativeHomePageView` 做 UI 预热。`opacity=0` 只隐藏像素，不会停止 Native Home 内部 data hooks、RPC、snapshot/controller、image request 和 Native view 资源；同时挂 RN EmptyWallet 与隐藏 Native 会制造双 owner。若未来性能证据要求预热，只允许另行设计可取消、按 wallet scope 隔离的数据 cache，不在本轮挂隐藏 UI。

### 精简页面内容与禁止带入的重型 owner

- `EmptyWalletHomePage(notBackedUp)` 只复用现有 RN Page/Header shell、`Keyboard.AwareScrollView`、`useScrollContentTabBarOffset`、`HomeHeaderContainer` 和 `NotBackedUpEmpty`。`NotBackedUpEmpty` 继续持有现有 cloud/manual/Lite/KeyTag backup owner 和两个 CTA；不得在新页面复制 backup flow。
- Legacy main Home 与 Native disabled/web/desktop 路径也应复用同一个 `EmptyWalletHomePage`，避免维护第二份未备份布局。基于当前 Legacy 基准，account row 与 `$0` 仍显示，WalletActions、banner、资产 Tabs/pager、Market、Earn 和普通列表不挂载；如产品未来决定删除 `$0`，必须作为新的视觉契约单独 A/B，不能在本轮把 Native 固定 Header 的 bug误写成 `$0` bug。
- 不复用整个重型 `HomePageView` 作为未备份 fallback。该组件会初始化 capability、vault/network RPC、approval、focus/pager 以及 Portfolio/DeFi/NFT/History/Perps 树；即使最终 JSX 走未备份分支，前置 hooks 和 effects 仍已运行。
- 新页面内不得重复创建 `AccountSelectorProviderMirror`、`HomeWalletListProvider` 或 `ProviderJotaiContextAccountOverview`；它们已经在 `HomePageContainer` 外层。DApp floating trigger、OneKey ID、notification registration、KYT 和 BTC fresh-address 等 foreground owner继续留在页面 variant 外，只由现有 `isHomeVisible` gate 决定是否挂载。
- normal wallet 继续默认 Native；本次只是为 `notBackedUp` 建立明确的 RN 产品状态页，不允许重新引入“任意差异都退回 Legacy”的总开关。

### 最小实现文件边界

1. 新增 `packages/kit/src/views/Home/pages/EmptyWalletHomePage.tsx`，实现精简 Page shell 和 `variant='notBackedUp'`；未来 `backedZero` 只保留架构扩展点，本轮不实现余额逻辑。
2. 新增或扩展纯 helper 与测试，例如 `pages/homeWalletPageSurface.ts` / `.test.ts`，输入 launch/readiness、active wallet、已 settled wallet-list wallet、feature capability 和上一 scope，输出 `pending | no-wallet | not-backed-up-rn | native | legacy`，不在 helper 内读全局 atom 或发 RPC。
3. 修改 `pages/HomePageContainer.tsx`，在已有 authoritative readiness owner 中提交页面级 surface；保持外层 providers、launch visibility 和 foreground effects 不变。
4. `pages/HomePageView.tsx` 只做 Legacy 同组件复用/去除 main Home 的重复未备份 JSX；URL account 等其他 caller 若仍可能进入旧分支，必须先独立审计，不能为减少 diff 破坏其行为。
5. `components/NotBakcedUp/NotBackedUpEmpty.tsx`、`pages/HomeHeaderContainer.tsx` 原则上直接复用，不搬运业务；只有独立 code reviewer 证明精简页需要可复用 shell prop 时才做最小结构提取。
6. 本轮不应修改 `packages/native-components/ios/HomeContainerView.swift`、Android `HomeContainerView.kt`、Nitro slot bridge或全局 feature flag来修 EmptyWallet。现有 `content.body` 清理是新页面真实通过后的独立 cleanup，不与首次实现混在一起。

### 聚焦测试矩阵

- helper cold matrix：wallet list pending、storage 未 ready、active account 未 ready、wallet 不在当前 list generation、HD `backuped` 未定义或 active/list 不一致均返回 pending，不能先挂 EmptyWallet 或 Native。
- surface matrix：同 id HD/false -> `not-backed-up-rn`；同 id HD/true -> normal Native；imported/watching/hardware 即使 `backuped=false` 也不能误入未备份 HD 页；feature unavailable 只影响 normal wallet 的 Native/Legacy选择。
- no-wallet matrix：`walletContentReadiness=no-wallet` 只进入 onboarding/no-wallet owner，永不进入 `EmptyWalletHomePage`；onboarding `unknown` 或 `onboarding` 时 Home surface不可见、不可 hit-test、不可进入 accessibility tree。
- transition matrix：同 wallet 的 `not-backed-up-rn -> wallet-list pending -> active/list true -> native` 只提交一次最终切换；旧 request/result 不能反向恢复 RN；wallet id 切换立即使旧 CTA 不可交互；backup RPC失败继续 RN并保留重试能力。
- 安全语义：未备份钱包 `balance 0 -> positive`、token rows 到达或 DeFi 数据到达均仍为 `not-backed-up-rn`；只有权威 `backuped=true` 才退出。未来 `backedZero` 的充值切换测试必须在实现该 variant 时另加，不能复用本轮断言。
- component test：`EmptyWalletHomePage(notBackedUp)` 只挂一个 `NotBackedUpEmpty`，两个 testID 均存在；不挂 `HomeContainer`、Tabs、Market、Earn、WalletActions 或 banner；tabBar bottom inset 与 Large/XXXL 可滚区域可注入验证。
- runtime/side-effect test：RN EmptyWallet 可见时不构造 Native Home controller/snapshot，不发 Native Home Market/DeFi/NFT/History请求；外层 foreground effects 仍只随 `isHomeVisible` 挂一次；StrictMode/remount 不重复 backup action。

### 下一轮独立 UI Pass / Fail 条件

- 使用与当前有钱钱包完全隔离且获授权的未备份 HD fixture；从 app process 启动前录制，确认首个 Home 内容帧直接是完整 RN `EmptyWalletHomePage(notBackedUp)`，无 Native Header/body 中间帧、白屏或普通 Home 闪现。
- 首帧 divider、illustration、标题、描述和两枚 CTA 与本节 Legacy 402 基准一致；primary/secondary 都完整位于浮动 Tab bar 上方。小屏、Light/Dark、Large/XXXL 下必须能双向 drag/fling/decelerate，最终 CTA 可达且外层 refresh 不抢 body 手势。
- 两枚 CTA 都要真实交互：primary 进入 cloud/manual权威流程；secondary 打开 Backup sheet，三种可用选项、关闭和返回正确。元素存在不能代替 sheet 内容与返回链路。
- 在仍 `backuped=false` 时注入/取得正余额，页面必须继续显示备份提示；若到账后直接 Native，明确 Fail。随后完成真实 backup，录制 bg WalletUpdate、wallet-list/active wallet收敛、页面只切一次 Native、modal pop 后无 blank/双页/offset跳变。
- 验收过程中必须确认 Debug 包、main ready、独立 bg ready/bootId、钱包数据与持久化数据正常；禁止 uninstall/reinstall/erase/clear data。没有隔离 fixture 时保持 Blocked，不得修改当前真实钱包制造绿色证据。
- **当前状态：** Legacy RN 同状态视觉与 More options 交互基准 **Pass**；当前 Native `content.body` 视觉、底部可达性与 scroll owner **Fail**；`EmptyWalletHomePage` 新架构尚未编写、代码验收或 UI 验收，不能声明 EmptyWallet 已完成。

### subagent 分工与完成门禁

1. 编写 subagent 只实现 `EmptyWalletHomePage`、纯 surface helper/test 与 `HomePageContainer` 页面分流；不修改 Native renderer、无关 Market/Swap/Discovery/Performance 文件，不 commit/push。
2. 独立代码验收 subagent 审计 launch/no-wallet/current-wallet generation、active/list一致性、backup transition、wallet-id switch、无 hidden Native和无重型 HomePageView owner，并运行聚焦 Jest/ESLint/format/diff-check；编写者不能自验收。
3. 独立 UI 验收 subagent 使用标准 Debug 流程和隔离 fixture完成 cold first frame、Legacy基准、正余额仍提示、两 CTA、Backup sheet、backup成功一次切 Native、Dark/Dynamic Type/scroll证据；不能以本节旧 A/B 代替新实现验收。
4. UI或代码 Fail 后由主 agent把具体证据交回编写 subagent，再由同一独立验收角色复核；循环到 Pass 或真实 Blocked。主 agent只负责调度、范围/dirty控制、handoff与最终 commit/push，不直接写产品代码或自行判 Pass。

## 2026-07-19 EmptyWalletHomePage 抽离、刷新手势修复与 Debug 验收

### 最终架构与状态边界

- 本轮已经用精简 RN `EmptyWalletHomePage` 替换未备份 HD 的 Native Hybrid `content.body`。`HomePageContainer` 是唯一页面 surface resolver；任一时刻只挂载 Empty、Native、Legacy 或 no-wallet owner 中的一个，不做 `opacity=0` 的隐藏 Native 预热，也不让重型 `HomePageView` hooks 在 Empty 页面背后执行。
- `notBackedUp` 只由权威钱包状态决定：active wallet 与当前 settled wallet-list wallet 必须是同一 id、同一 type，且两份 `backuped` 都为 `false`。同钱包 refetch/pending 或 active/list 暂时不一致时保留上一 RN safety surface；wallet id 一旦改变，旧 Empty 页面和 CTA 立即卸载并 fail closed。
- 余额、token、portfolio、DeFi 或到账事件不参与 `notBackedUp` 的 surface 选择。HD 钱包即使已经充值，只要仍未备份，就继续显示安全提示；只有 bg 权威备份写入、`WalletUpdate` 和 active/list 同 scope 收敛为 `backuped=true` 后，才整页切换到正常 Native/Legacy Home。
- 用户接受页面状态切换时进行一次完整整页重渲染，不要求维护两套页面或局部过渡。对本轮 `notBackedUp`，实际切换事件是“完成备份”而不是“充值”；未来如果实现 `backedZero`，到账后整页切换也可采用同一简单模型。
- fresh/no-wallet 仍由 onboarding/no-wallet gate 独立处理；normal wallet 在 feature enabled 时继续 Native，feature disabled 时继续 Legacy。全局 `nativeHomeFeatureFlag` 没有改动。

### 实现与清理范围

- 新增 `pages/EmptyWalletHomePage.tsx`、`pages/homeWalletPageSurface.ts` 及相应 component/helper 测试；`HomePageContainer.tsx` 提交权威 surface，并增加生产 `HomeLaunchGatedContent` mount/rerender 集成测试。
- `HomePageView.tsx` 删除重复的未备份 early branch；Legacy/no-wallet 与正常 Native 的路由继续由统一 owner 决定。`HomeHeaderContainer` 和 `NotBackedUpEmpty` 仍复用原 RN Header、backup illustration、文案和 CTA，不复制 backup 业务。
- 已删除 `nativeHomeWalletState.ts` 及其旧测试，并从 `NativeHomePage.native.tsx` 删除 wallet-state/body-slot 分支。
- TS Nitro types/bridge、iOS `HomeContainerView.swift`、Android `HomeContainerView.kt`/`HomeContainerSurfaceView.kt` 中的 `content.body` host、body gesture 特判和残留 symbol 已全部清理。Android 唯一仅服务于该特判的 JUnit 测试与依赖同时删除；JDK 17 compile 已证明 native-components 仍可编译。

### 独立代码验收

- 编写 subagent 完成实现后，独立 reviewer 第一轮没有发现 P0/P1，但指出纯 resolver 与直接 mount Empty 页面不足以证明生产 JSX owner，要求补 `HomeLaunchGatedContent` 的实际转场测试。补测后独立复核为 **Pass**，P0/P1/P2 全部清零。
- 生产集成测试真实执行 `previousPageSurfaceRef + useLayoutEffect` 与互斥 JSX；覆盖 cold pending、HD 双 false、同 wallet refetch/mismatch sticky、双 true 只切一次 Native、wallet id 改变立即卸载旧 CTA、no-wallet、feature false Legacy 和 feature true Native。测试确认 Empty 可见时 Native mount count 为 0，不是隐藏预热。
- 最终聚焦 Jest 为 4 suites / 40 tests Pass；刷新修复另有 2 suites / 2 tests Pass。type-aware Oxlint、Oxfmt、指定 `git diff --check`、Swift parse 均 Pass；Android JDK 17 `:onekeyhq_native-components:compileDebugKotlin` 为 `BUILD SUCCESSFUL`。
- `yarn tsc:only` 的本轮文件没有新增错误，但全量仍被两个无关既有工作区问题阻断：desktop `config.perfReady` 缺失，以及 `NativeHomePageView.native.tsx` 引用未导出的 `HOME_HEADER_SEARCH_ROW_HEIGHT`。不得为制造绿色结果混改这些文件。

### iOS Debug A/B 与交互验收

- 独立 UI verifier 两次完整执行标准 `yarn app:ios`；最终一次 exit 0、`Build Succeeded`、0 errors / 13 warnings，并由该命令更新安装 Debug `OneKeyWallet.app`、启动 `so.onekey.wallet` 和 Metro dev-client。没有使用 Release、自定义 `xcodebuild`、`CODE_SIGNING_ALLOWED=NO`，也没有 uninstall/reinstall/erase/clear data、删除 container/DB 或执行真实备份。
- 当前钱包仍为 `Account #1 / $0.00`，Dark mode。首帧只显示 RN EmptyWallet：Search、account、金额、divider、illustration、标题、描述和两枚 CTA；没有 Native tabs、Market、Earn、WalletActions 或 banner。两枚 CTA 都完整位于浮动底栏上方。
- 与同状态 Legacy 402 基准对比，divider 与 illustration frame 一致；大于阈值的变化像素约 0.054%，集中于状态栏瞬态。证据：`.tmp/ui/native-home-empty-wallet-rn-page-20260719/empty-wallet-debug-command-launch-clean.png`、`empty-wallet-debug-vs-legacy-402.png`、`empty-wallet-debug-vs-legacy-diff-402.png`。
- `More backup options` 真实打开 Backup sheet，显示 `Manual backup / OneKey Lite / OneKey KeyTag`，并安全关闭；最终回归证据位于 `.tmp/ui/native-home-empty-wallet-refresh-fix-20260719/after-fix-backup-sheet-open.png`、`after-fix-backup-sheet-snapshot.txt`、`after-fix-backup-sheet-closed.png`。主 CTA 仅验证可见、enabled/hittable，没有执行 iCloud 或其他真实备份流程。

### `Refreshing...` 失败、根因与复验

- 第一轮新页面 UI 验收的几何与 sheet 已 Pass，但同位置双向 swipe 会短暂显示蓝色 `Refreshing...`，因此当轮明确判 Fail，没有用静态首屏覆盖交互失败。证据：`.tmp/ui/native-home-empty-wallet-rn-page-20260719/empty-wallet-debug-swipe-both.mp4` 与 `empty-wallet-debug-swipe-both-contact.png`。
- 根因不是 `Page`/`Keyboard.AwareScrollView` 的 `RefreshControl`。`HomeHeaderContainer` 的 `notBackedUp` variant 仍把余额区域放在 `HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}` 内；精简页不在 `Tabs.Container/CollapsibleTabContext`，wrapper 没有有效 `scrollYCurrent`，会把起点视为顶部并在超过阈值时触发全局 Home refresh。
- 修复只让 `notBackedUp` 直接渲染原 `HomeOverviewContainer`，不再挂 nested refresh gesture owner；normal Home 的 Overview 与 WalletActions 两个 refresh owner、props 和 handler 保持不变。独立 reviewer确认 wrapper 本身无布局样式，因此该变化不改变 gap、padding、字体、pressed 或 accessibility。
- 修复测试明确断言 Empty 外层 `refreshControl/onRefresh` 都为 undefined，`notBackedUp` header 为 0 个 refresh owner，normal header 仍为 2 个且都连接原 handler。代码独立复核为 Pass。
- 第二次 `yarn app:ios` 更新 Debug 后，同坐标向上、向下 swipe 都有自然位移与回弹，手势阶段不再出现蓝色 `Refreshing...`，末帧恢复原布局。证据：`.tmp/ui/native-home-empty-wallet-refresh-fix-20260719/after-fix-swipe-both-clean.mp4`、`after-fix-swipe-both-clean-contact.png`、`after-fix-stable-after-pure-swipe.png`。
- `agent-device record start`/XCUITest hierarchy 刷新会在录制前约 1 秒制造蓝色 `Refreshing...` 工具 pre-roll；最终证据从第一条真实手势开始前裁切，录制期间没有插入 screenshot/snapshot。原始文件 `after-fix-swipe-both-pure.mp4` 保留用于审计，不能把工具 pre-roll 当成 app 手势失败，也不能用裁切隐藏手势期问题。

### runtime、资源所有权与仍未覆盖项

- 最终 Debug 中 main 与 bg 均独立 ready。main 负责 surface 判定、RN/Native tree 挂载、Empty layout/scroll/pressed/accessibility；bg 是独立 CDP target，负责权威 wallet/account/backup service、DB 更新与 WalletUpdate。最终 bg bootId 为 `1784400579683-hvjzbw2o`、status ready；证据：`.tmp/ui/native-home-empty-wallet-refresh-fix-20260719/after-fix-runtime-globals.json`。
- iOS main/bg 使用独立 Hermes heap并独立初始化，wallet DTO 经 proxy 分别序列化/反序列化；main ready 不能代替 bg ready。DB/MMKV/file handles、图片/字体 cache 和部分 Native singleton 是进程级共享 Native 资源；resolver sticky ref、scroll offset、gesture、pressed、accessibility 与页面 transition 属于 main/per-view 状态。
- 本轮真实通过范围：当前 Dark mode 未备份 HD `$0` fixture 的首帧/Legacy 402 A/B、两枚 CTA 可见性、secondary Backup sheet、双向 swipe/回弹和无 app refresh、应用持续存活、main/bg ready。
- 仍未覆盖：实际 primary backup、backup 完成后 `Empty -> Native` 的真实单次切换、正余额但未备份、Dynamic Type Large/XXXL、Light mode、Android Debug、fresh/no-wallet、已备份零资产/未来 `backedZero` 和真正单链 wallet-type。生产 JSX 测试覆盖权威转场，但这些真实 UI 项继续保持 Partial/Blocked，不能声称整个 Empty Wallet 或 Native Home 已全部完成。

## 2026-07-19 已备份 `$0` 钱包：Manual backup 安全边界与待走查问题

### 本轮目标与当前状态

- 用户已授权把当前未备份 HD `$0` fixture 通过 Manual backup 转成“已备份且总资产为 `$0`”，然后在同一个 Debug 包、同一账户、同一服务 config 和 Dark mode 下采集 Legacy/Native 全页 A/B，按真实截图和交互修复差异。
- 已备份 `$0` 当前没有独立 `backedZero` surface；active wallet 与 settled wallet-list wallet 两份 `backuped=true` 后应进入普通 Home。feature enabled 走 Native，临时关闭 feature 只用于同状态 Legacy基准，采集后必须恢复。余额仍不参与页面 resolver。
- 当前只完成源码和安全流程审计，尚未执行 Manual backup，也尚未取得已备份 `$0` 的真实 UI。不得把下面的源码差异写成最终 UI 结论。

### Manual backup 与敏感数据边界

- 真实链路为 `More backup options -> Manual backup -> bg getHDAccountMnemonic(Security) -> password/biometric verify -> BackupWalletReminder warning -> recovery phrase -> I saved -> bg updateWalletBackupStatus(true)`。Manual 路径没有 VerifyRecoveryPhrase quiz；`I saved` 直接触发权威备份状态写入。
- bg 写 DB 后 emit `WalletUpdate`；main 的 wallet-list 与 active-account listener 独立 refetch。`HomePageContainer` 只有在同 wallet scope 的 active/list 两份数据都收敛为 `backuped=true` 后才从 Empty 卸载并挂正常 Home。
- Manual item当前没有独立 testID；warning 与 recovery phrase 页面又复用同一个 `onboardingv2-btn`。恢复词明文渲染后会进入 accessibility tree。即使 CaptureProtection 阻止屏幕采集，selector失败、XCTest interaction failure 或 runner诊断仍可能输出 AX 内容。
- 因此禁止由 agent-device、XCTest、Hermes 或日志工具无人值守跨越 recovery phrase 页面。敏感区间必须由用户本人接管：从 Backup sheet 选择 Manual backup开始，完成认证、私下保存恢复词并点击 `I saved`，确认敏感页面完全关闭并返回 Home后，再通知 agent恢复采证。
- 敏感区间必须停止 screenshot、record、snapshot、get attrs、is visible、app/Metro/system logs、Hermes/CDP/eval和任何 selector/坐标点击。禁止把密码、passcode、恢复词或其顺序发送到对话、日志或提交文件。Simulator biometric match只能在真实系统认证 prompt已出现时模拟成功硬件事件，不能消除 recovery phrase 页的安全阻断。

### Legacy 已备份 `$0` 契约与 Native 源码风险

- Legacy 普通零资产 Header保留 account row、权威 `$0` 与 refresh owner；零资产时隐藏 banner，实际无 banner header约 182pt。金额/动作在权威 balance settle前不能先猜 `$0` 或业务态。
- Legacy 零资产 actions不是 `Send / Receive / Buy & Sell / More` 四宫格，而是 `Add money to get started`、主按钮 `Add money` 与 icon-only `More`。Native 当前固定构造四个普通 actions，没有 balance-state分支，属于明确待真机复现的源码 Fail。
- Native banner数据当前只按关闭状态、position和network过滤，没有 Legacy 的 positive-balance gate；已备份 `$0` 可能错误显示 banner或保留额外 Header高度，属于明确待真机复现的源码 Fail。
- Legacy All Networks会过滤零余额 token，plainMode空数组最终显示 `Wallet-No-Token-Empty`；Native在 `portfolio.isEmptyAccount` 时可能显示 `Wallet-No-Address-Empty`，否则显示 EmptyToken。当前 fixture属于哪一种必须以同状态A/B决定，不能按类型名猜修。
- Legacy Earn受 block-region gate；Native补充数据与 section当前缺少同等 gate，受限区可能多出 Earn。Tabs capability、hide-zero/filter、Market/Upgrade/Support整体顺序源码基本对齐，但都需要全页真实证据。

### A/B 与 Pass / Fail 门禁

- Manual backup完成后先确认 Empty testID消失、普通 Home真实显示、应用持续存活、钱包仍为同一 Account #1 / `$0`，main ready与独立 bg ready/新 bootId均有证据。由于敏感区间不可录制，不能声称已经取得 recovery phrase期间的连续转场录屏；只允许结合操作前/操作后安全帧和权威 resolver测试说明边界。
- 在同状态临时切 Legacy采集首帧/100ms/300ms/settled、Header、actions、banner absence、Tabs、Spot空态、Market、Earn、Upgrade、Support、最底部、双向 fling/refresh和各 Tab点击前/首帧/settled；恢复 Native后重复同一序列。每次切换都要分别确认 main/bg ready。
- 硬 Fail：任意额外/缺失 action、banner、tab、section、CTA或空态类型；首帧错误态/白屏；点击无真实结果；底部遮挡；失去惯性；offset跳变；Dark硬编码色块。几何误差：icon/文字基线/按钮不超过1pt，Header/section/底部 clearance不超过2pt；402pt differ在mask状态栏/远端瞬态后，静态非文本 changed-pixel ratio目标不超过0.5%。
- 当前优先验证并预计需要修复：zero actions、zero banner gate、权威首帧金额/actions时序、All Networks EmptyToken/EmptyAccount，以及 Earn region gate。后续必须继续遵守“编写 subagent -> 独立代码 subagent -> `yarn app:ios` Debug -> 独立 UI subagent -> handoff -> commit/push”。

## 2026-07-19 已备份 `$0` 钱包：Manual backup、同状态 A/B、集中修复与 Round5 最终验收

### Manual backup 的真实执行、安全边界与页面切换

- 用户明确授权对当前全新、零余额、未来不会入金的 disposable HD 钱包执行 Manual backup，并另行提供了认证密码。密码、恢复词及其顺序没有写入日志、截图、handoff、测试或提交文件；恢复词显示后的受保护区间没有执行 accessibility snapshot、OCR、CDP 读取或页面内容日志。
- 为非敏感入口增加了稳定 testID：Backup sheet 的 `Manual backup / OneKey Lite / OneKey KeyTag`，以及 warning page、显示恢复词 CTA、确认已保存 CTA。测试只使用非 BIP39 fake words；真实恢复词没有进入测试或诊断。
- 真实链路已经执行为 `More backup options -> Manual backup -> 认证 -> warning -> protected phrase -> I saved`。受保护页面由 `CaptureProtection` 把 app window 挂入 secure text-entry layer，因此 XCUITest tree 会消失；本轮只在显示敏感内容前缓存 CTA frame，敏感区用纯 HID 完成确认，不读取页面内容。
- 随后再次执行标准 `yarn app:ios`，Debug 包更新安装并启动后直接进入普通 Native Home；未备份 Empty 页面消失，同一 `Account #1 / $0.00` 数据仍正常。该结果与 bg `updateWalletBackupStatus(true)`、WalletUpdate、active/list 两份 wallet 收敛后的页面 resolver 一致。不能用该状态外推 fresh/no-wallet、正余额未备份或其他 wallet type 已通过。
- Debug 保护页排查期间曾有一次短暂 `simctl launch --console-pty` stdout attach 尝试，收到停止指令后立即终止，未继续交互，也不作为任何验收证据；没有 uninstall、reinstall、erase、clear data、删除 container/DB。全部合格构建、更新安装、启动和最终证据均来自标准 `yarn app:ios`。

### 固化的主要自动走查方式

- 本轮证明“同钱包、同余额、同主题、同服务 config、同 scroll offset 下切 Legacy/Native，完整采 first/settled、402 并排图和像素 differ”可以高效同时发现产品合同、布局、缺失组件、首帧、交互与滚动状态错误，后续把它作为 Native Home 的主要走查方式。
- 标准顺序：先保持 Native 默认，采首帧/100ms/300ms/settled、全页 section、真实点击、触底和双向 fling；再临时切 Legacy，用标准 `yarn app:ios` 采完全相同路径；立即恢复 feature flag，并再次用标准命令确认 Native。临时 flag 最终必须无 git diff。
- Tab/异步 section 的 y 坐标不能延迟复用。每次使用“截图后立即点击”，并为跨 Tab 保留点击前、first、3s/settled，必要时 10s；只存在元素或收到点击事件都不能判 Pass。
- 基线证据：Native `.tmp/ui/native-home-backed-zero-ab-20260719/`；Legacy `.tmp/ui/legacy-home-backed-zero-ab-20260719/`；首轮 402 A/B/diff `.tmp/ui/native-home-backed-zero-ab-diff-20260719/`。最终 Round5 证据为 `.tmp/ui/native-home-mounted-slot-round5-20260719/`。

### 同状态 Legacy / Native 首轮真实 Fail

- Legacy `$0` 顶部真实合同为 `$0.00`、`Add money to get started. Withdraw anytime.`、主 `Add money`、icon-only More，并隐藏 banner。Native 原实现错误显示 `Send / Receive / Buy & Sell / More` 四宫格和 Robinhood banner。
- Legacy Spot 真实显示 BTC、USDT、USDC、ETH、SOL、BNB 等默认零余额 Token rows；Native 原实现显示空资产 illustration。根因不是只选错 Empty 组件，而是 Native 缺少 Legacy default/custom retention、derive merge 和 aggregate fold。
- 从 Spot 的 Support/Help center 底部 offset 切 Perps、NFT、History，Legacy first/settled 会立即 clamp 并显示真实内容/空态；Native first、3s、10s 都持续空白。History 只剩 filter accessory，`No activity yet / Block explorer` 缺失。
- Legacy Help center 到浮动 tab bar 的 clearance 约 39–40 个截图物理像素；Native 原实现约 125px，统一滚动 inset 过大。

### 集中修复后的代码边界

- `useHomeBalanceState` 抽出共享 pure resolver；Native 对齐 Legacy 的 exact-owner 语义：只读 `buildOverviewOwnerKey(concrete account.id, network.id)` 的 `lastConfirmedOverviewBalance.byOwner`，禁止使用跨 owner `latest` 或无 network owner 的 `accountWorth`。
- Native balance precedence 为：current regular/small funded 或 current scoped non-zero 值优先；exact-owner cached non-zero/zero；无 cache 时只有 current Portfolio authority success 才允许 zero；旧 scope、loading 或 error 保持 unknown。finite non-zero 包含负净值，risk rows 不算 funded。DeFi partial failure不作为 zero gate，但 current scoped 已知非零仍可提升 positive。
- funded latch 与 Legacy 一致，以 `concrete account.id__network.id` 隔离并在 Wallet/Account remove 时清理；wallet sticky 在 render 期按 wallet id 同步 reset，同钱包切 owner 可 bridge，换钱包不能泄漏旧 positive。
- unknown 保持 semantic unknown，因此 banner 不提前；presentation 降级为 standard actions，避免 62pt 空槽。zero 使用原版 `ZeroBalanceWalletActions`，Native slot 只补轻量 `HomeTokenListProviderMirrorWrapper`，不复制 Receive/More 业务、埋点、pressed 或 accessibility。
- banner hook 继续挂载取数和 cache，只有 positive 才向 Native header DTO 提交。zero action layout 用显式 `actionLayout=zeroBalance` 与 82pt row；普通 actions 仍 62pt，TS/iOS/Android schema兼容。
- default-token map 首次失败会安全降级为不隐藏零余额并每 3 秒重试；timer 可取消、旧 generation 丢弃，失败不会写 balance authority。custom token projection复用 Native Portfolio 已有 raw owner，避免再挂重型 `useTokenManagement` fan-out。
- All Networks cache、progressive、final 三路统一复用 Legacy canonical response projection：same-network derive merge、aggregate fold、vault round flag与 row `mergeAssets` 同时成立、仅按 canonical `$key` 去重；regular/small/risk 三 map 分桶独立。aggregate config 缺失时先 `syncWalletConfig()` 再重读。该修复消除了 BNB 后重复 BTC，禁止用 symbol/address heuristic 吞合法同名资产。
- iOS 17.4+ unified driver保留 transition max range与 per-tab offset，目标 offset在 settle前捕获并按 target max原子提交；底部 inset从原默认约172收敛到约136并保留至少112安全下限。iOS 17.4 以下仍走旧 nested fallback。
- 持续空白的最终根因不是 offset：目标页 chrome已回顶部，但 empty/loading row 在 mounted state slot key变化时 row id/content signature不变，diffable未把透明 `HomeContainerItemCell` 换成 `HomeContainerSlotHostCell`，RN slot一直停在 hidden parking view。最终修复对 old/new `content.state.<tabId>` symmetric diff涉及的现存 empty/loading row执行明确 `reloadItems`；与 reconfigure集合排他，mount/unmount双向生效，apply completion后重建 visible slot host并回调 layout。

### 失败轮次与重新分析

- Round1：Build/静态测试均绿，但真机约10秒出现 `useContextStore ERROR: store not initialized`；同时 BNB 后重复 BTC。修复为轻量 provider mirror和 response-level canonical projection，未用渲染层 symbol去重。
- Round2：Render Error和重复BTC已消失，但 zero actions长期缺失、保留约360px空槽。真实 Debug日志证明 DeFi 14 child中10成功、4个业务码40111；自定义“所有Portfolio+DeFi+Perps都成功才zero”偏离 Legacy。无本机证据的 Perps/bg/shared试验改动已精确撤销，最终使用上述Legacy exact-owner contract；没有硬编码40111为 authoritative empty。
- Round3/Round4：zero顶部和按钮通过，但 Spot底部切Perps仍persistent blank。截图中Search/Account/Tabs完整展开，反证outer仍在Spot底部；随后从cell class、mountedSlotKeys、diffable signature与hidden parking链路重新定位并修复，不再继续猜scroll约束。
- 每轮 Fail 后都停止完整矩阵、保留录屏/截图并由编写 subagent修、独立代码 subagent复核，再重新 `yarn app:ios`。编译通过、元素存在或源代码推断从未代替真实 UI。

### Round5 最终 Debug UIKit 验收

- 标准 `yarn app:ios` Debug Build Succeeded（0 errors / 13 warnings），由该命令更新安装并启动 `so.onekey.wallet`。应用保持 foreground，钱包仍为同一已备份 `Account #1 / $0.00`，数据正常；没有 Release、自定义 xcodebuild或关闭签名。
- 20秒 smoke：zero说明、主 Add money、icon-only More均可见；无banner、无大块空槽、BTC/USDT/USDC/ETH/SOL/BNB各一次；无全屏Render Error。Add money真实打开Receive全屏并返回，More真实打开sheet并关闭，无冒泡误触。
- Spot在Help center触底切Perps：first立即出现Perps chrome/Hot Markets/View more/slot，3s/10s显示真实rows；不再parking blank。回Spot保留Help center底部offset。第二轮Spot/Perps/DeFi/NFT/History均直接显示各自内容并保留per-tab offset。
- DeFi first/settled显示`$0.00 / Start earning`，NFT显示`No NFTs`，History显示`No activity yet / Block explorer`。History footer和功能不再缺失。
- Header、body、Support区域上下fling都有手指离开后的连续位移；从Support回Market/Tokens、再从header/body上滑到Help center均无跳顶或惯性丢失。
- bottom clearance与Legacy并排约同为40个截图物理像素，Help center无遮挡。top/bottom与Perps/DeFi/NFT/History first/settled共10组402 A/B和diff、531.5秒录屏/contact sheet、`round5-verification.json`均位于 `.tmp/ui/native-home-mounted-slot-round5-20260719/`。
- main Debug runtime transport ready，bg为独立Debug runtime并ready；main/bg是独立Hermes heap、独立初始化，main ready不能代替bg ready。main负责balance presentation、Native Home snapshot/section/slot、per-tab offset与UIKit view状态；bg负责wallet backup状态、Token/DeFi/Perps/Market服务与权威持久化。
- DB/MMKV/file handles、图片/字体cache和Native singleton为进程级共享资源；proxy DTO在main/bg各自序列化/反序列化。UIKit constraint、diffable snapshot、mounted slot host、scroll/offset、pressed/selected、represented image signature与request cancellation属于per-view状态。

### 仍需保持 Partial 的范围

- Round5只覆盖iPhone 17 Pro / iOS 26.5 / Dark mode / 当前已备份All Networks `$0` HD钱包。Light、Dynamic Type Large/XXXL、Android真实Debug、fresh/no-wallet、单链有钱、正余额未备份、Keyless/imported/hardware以及其它服务错误矩阵仍不能声明通过。
- Native目前只读既有 exact-owner `lastConfirmedOverviewBalance.byOwner`，没有新增 Native-only fully-confirmed combined-total writer。无cache时可靠依赖current Portfolio authority；DeFi-only/Perps-only且失败child隐藏真实资产时，zero判定按本轮真实Legacy parity而不是更严格全资产authority。未来若新增writer，必须只在current-owner fully confirmed后按USD写入，partial failure不得覆盖旧positive。
- 标准launch约5秒曾出现一次自行消失的Debug-only toast（`OneKeyLocalError: screen component-Navi...`/debugger warning），20秒消失，Add money/More交互未再次触发；本轮未把它归为zero-home产品阻断，但继续保留在Round3证据中。

## 2026-07-19 iOS Debug：Perps Support 与空态 Tab 首帧连续性最终验收

本节继续使用上一节同一个 iPhone 17 Pro / iOS 26.5、同一个已备份 All Networks `Account #1 / $0.00` 现场，专门处理用户报告的四项问题，并补齐修复后独立 code review 与真实 Debug UI verifier 证据。本轮仍由编写 subagent 写代码、独立 reviewer 验代码、独立 UI verifier 跑设备；主 agent 只负责范围、dirty 文件、证据和提交协调，不自行把作者自测判为 Pass。

### 用户四项问题、Round3 有效复现与无效证据排除

1. **Perps 下方 Support hub 只剩两条线：真实复现。** Native Round3 的 `$0` Perps 空态向下滚动后，Upgrade/Prime 可见，但 `Support hub` 下只有两条 separator，没有 promo、Support 和 Trading Guide。稳定证据为 `.tmp/ui/native-home-four-issues-before-20260719-round3/01-perps-support-first.png`、`01-perps-support-3s.png`、`01-perps-support-10s.png` 和同目录 `native-four-issues-round3.mp4`。
2. **DeFi 一直 loading：没有复现“永久 loading”，但复现了更精确的首帧缺口。** 有效点击后的 Native DeFi first 是整块空白，约 100ms 后直接出现 `$0.00 / Start earning` terminal empty；3s、10s、30s 均稳定，不是永久 skeleton。`02-defi-valid-first.png` 到 `02-defi-valid-30s.png` 是有效序列；早先受错误坐标或仍在旧页面影响的帧不作为证据。
3. **NFT 一直 loading：同样没有复现“永久 loading”，但复现了首帧整块 blank。** `03-nft-valid-first.png` 是空白，100ms 后出现 `No NFTs`，之后到 30s 稳定。问题应归类为 state slot 首帧未挂载，而不是服务永久 loading。
4. **History 底部每次切换跳变：空钱包现场复现为 3/3 次 first blank -> 100ms terminal empty 整块插入。** 三次不同来源切入 History 都先空白，随后一次性插入 `No activity yet / Block explorer`；没有观察到 terminal empty 已经出现后再发生第二次 y jump。因此修复目标是 first-frame 连续性与稳定行高，不是人为增加 animation 或固定延时。

本轮明确排除误点和旧 session stale：DeFi/Earn 等异步 section 会改变顶层 Tab y，延迟复用旧坐标曾命中 Search、Spot 或其他页面；`.tmp/ui/native-home-four-issues-after-20260719/02-hit-spot-y180.png` 到 `02-hit-spot-y220.png`、`02-return-home-after-coordinate-miss.png` 只记录误点排查，不参与 Pass/Fail。旧 agent-device session 的 accessibility snapshot 没有新 ID 时也不能证明控件不存在；最终 ID 结论只采用重建 fresh session 后的文本证据。

### 同状态 Legacy false A/B 与主要走查方式

- 编写前临时把 `nativeHomeFeatureFlag.native.ts` 切到 `false`，用标准 Debug 流程采相同 `$0` 钱包、相同 Dark theme、相同服务 config 和同类切换序列。Legacy 基线位于 `.tmp/ui/native-home-four-issues-legacy-20260719/`，包括 `legacy-four-issues.mp4`（362.46s）以及 Perps、DeFi、NFT、History 的 first/100ms/300ms/3s 帧。
- Legacy Perps 空态完整显示 Upgrade、Prime、Support hub promo、Support 和 Trading Guide；Native Round3 只剩 header 与两条线。Legacy DeFi/NFT/History 切换时 first 已是 skeleton、cache 或 terminal content，没有 Native 的全块 blank；这证明原版代码仍可作为真实合同，而不是凭设计尺寸猜测。
- A/B 完成后 feature flag 已恢复默认 Native `true` 路径；`git diff -- packages/kit/src/views/Home/nativeHomeFeatureFlag.native.ts` 为零。没有用退回旧首页规避 Native 问题。
- 这一流程再次证明有效：同钱包同状态先采 Native first/100ms/300ms/settled，再临时切 Legacy 采同路径，并配合录屏、OCR、fresh accessibility ID 和像素/几何对照，可以迅速区分“服务一直 loading”“首帧 slot 未挂载”“坐标误点”和“真实组件缺失”。后续继续把自动 A/B 作为 Native Home 的主要走查方式；每次仍必须恢复 flag 并重新 Debug 验证。

### 精确根因

- **Perps footer ownership 错误：** `$0` Perps 的 `viewState=empty` state slot 内部又内联了 Upgrade 与没有 `nativeSlot` 的 `SupportHub`。UIKit state row DTO 预留约 1100pt，而 Fabric state slot 仍按约 320pt 的默认合同承载；footer 被塞进 state row 后既出现 Native/Fabric 高度不一致，也绕过了 Spot/DeFi 已使用的稳定 `content.footer.<tab>` native slot owner，最终只渲染出 Support header/separator。
- **首帧 blank：** `contentStateSlots` 只为 `activeTabId` 创建。UIKit 先切 selected page，React 收到 callback 后才创建目标 Empty/Loading child，所以 DeFi/NFT/History 的 state row 已经在 snapshot 中，但对应 Fabric surface 尚未 parked/mounted；首帧只能看到空白，随后整块插入 terminal state。Legacy 的 skeleton/cache 是长期存在的，因而没有相同空窗。
- **loading -> empty identity 与动态高度：** 原 state row id 把 `loading/empty` 写进 id，状态收敛会换 row/cell；即使改为同 id，320/760 等高度变化也需要 UIKit 主动失效行高，但不能替换已经挂载的 slot-host cell，否则会重新引入 parking blank 或滚动手感突变。

### 最终修复设计与 reviewer 阻断

- `buildStateSection` 统一使用稳定 `${id}:state`，Loading 与 Empty 共用同一 diffable identity。`resolveNativeHomeListStateSlot()` 从实际 `empty/loading` DTO 读取 `displayHeight`，Fabric slot 与 UIKit row 共用同一个高度来源；没有 state row 时返回 `content/height=undefined`。
- 所有已经 committed 的 Spot/Perps/DeFi/NFT/History 都保留稳定 `content.state.<tab>` shell，不再只创建 active Tab；但 child 使用 lazy factory，仅当对应 section 真有 Empty/Loading state item 且有 `displayHeight` 时才挂载。真实 DeFi/NFT/History/Perps rows 不会在隐藏 Tab 额外挂空态 React 子树。
- Perps state row 只负责 `$0` state 与 Hot Markets，empty 高度从包含 footer 的 1100 收敛到 560；Upgrade/Support 移到稳定 `content.footer.perps`，empty 与 ready 都复用同一 footer owner，loading 暂不显示。Support 使用 `nativeSlot`，Trading Guide 链接保持原版合同，避免 state 内重复渲染。
- iOS diffable 更新保持稳定 state row 与同一 slot-host cell；检测同 id state item 的 `displayHeight` 变化后，在 snapshot completion 中以 `performWithoutAnimation + beginUpdates/endUpdates` 失效行高，再 refresh visible slot hosts。该设计避免 reload/reparent 引起白屏，也把动态高度变化的滚动风险限制在无动画 layout 更新。
- 第一轮独立 reviewer 拦截了一个重要 hidden bg owner 回归：如果为所有 committed Tab 无条件 mount child，History 即使已有真实 rows 仍会隐藏挂载 `EmptyHistory`，其 `useAccountData` 会经 proxy 发 bg RPC；Perps empty recommendation 也有 30s poller。最终 lazy resolver 的参数化测试锁定“真实 rows 不调用 factory”；parked History 的 `useAccountData.options.overrideIsFocused` 直接接 `isActive` gate，hidden 时不 mount 内部高副作用 `AddressTypeSelector`，重新激活后补跑；Perps recommendation poller同样以 active Tab 覆盖 focus。审计确认 EmptyDeFi/EmptyNFT 只有 intl/navigation/纯视图，Perps Loading 是纯 skeleton，因此没有添加无意义 gate。
- 第二轮 reviewer 又发现 Jest/oxlint 捕捉不到的 TypeScript assignability：resolver 的运行时条件不能把 `perps.viewState` 从 `ready | loading | empty` 缩窄到组件要求的 `loading | empty`。最终 factory 内显式 `if (perps.viewState === 'ready') return null`；Legacy `PerpsEmptyRecommendSection` 使用可选 `isActive=true` 保持原行为，Native 显式传 gate。
- 为了让自动走查不再依赖漂移坐标，iOS 顶层 Tab 增加稳定 `native-home-tab-spot/perps/defi/nft/history` identifier，保留产品 title 作为 label，并用 accessibility `.selected` trait 表达选中，不调用会改变 UIKit 样式的 `UIButton.isSelected`。

本轮产品与聚焦测试文件为：

- `packages/kit/src/components/Empty/EmptyHistory.tsx`
- `packages/kit/src/views/Home/NativeHomePage.native.tsx`
- `packages/kit/src/views/Home/nativeHomeDataAdapters.ts`
- `packages/kit/src/views/Home/nativeHomeDataAdapters.test.ts`
- `packages/kit/src/views/Home/nativeHomeSlotLifecycle.test.ts`
- `packages/kit/src/views/Home/pages/PerpsContainer.tsx`
- `packages/kit/src/views/Market/MarketHomeV2/components/MarketPerpsList/hooks/useMarketPerpsTokenList.ts`
- `packages/native-components/ios/HomeContainerView.swift`
- `packages/native-components/src/HomeContainerController.test.ts`

### 编写与独立 reviewer 检查

- 聚焦 Jest 为 3 suites / 43 tests，覆盖 adapter stable state id/Perps height、all committed stable shells、真实 rows 不调用 hidden child factory、History/Perps active gate、Swift stable row height invalidation、slot-host cell 与 accessibility ID/selected trait。
- `xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift`、`oxfmt --check`、type-aware `oxlint --deny-warnings` 和指定文件 `git diff --check` 均通过。独立 reviewer 在 hidden owner 与 Perps type narrowing 两次阻断修正后最终给出 code Pass。
- 项目级 `yarn tsc:only --pretty false` 不再报告本轮文件，只剩共享工作区两个既有无关错误：`apps/desktop/web-build/static/js-sdk/data/config.ts:2` 缺 `./config.perfReady`；`packages/kit/src/views/Home/NativeHomePageView.native.tsx:15` 引用未 export 的 `HOME_HEADER_SEARCH_ROW_HEIGHT`。不得修改无关 owner 只为制造全量绿色。

### 最终标准 Debug 更新与 UI verifier Pass

- 独立 UI verifier 从仓库根目录执行标准 `yarn app:ios`；Debug Build Succeeded（0 errors / 13 warnings），由该命令完成 Metro、更新安装并启动 `so.onekey.wallet`。应用持续存活，仍显示 `Account #1 / $0.00`，钱包数据正常；main transport ready，独立 bg `bootId=1784438894142-5k07k6ek`、`status=ready`。证据为 `.tmp/ui/native-home-four-issues-after-20260719/runtime-probe.json` 和 `00-native-ready-clean.png`。
- 没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`；没有单独执行 uninstall/reinstall/erase/clear data，没有删除 app container、钱包数据库或持久化文件。
- 最终证据目录 `.tmp/ui/native-home-four-issues-after-20260719/` 共 129 个索引文件，完整清单在 `evidence-files.txt`。`05-perps-valid-bottom.png` 与最终录屏显示 Perps 空态的 Prime、完整 promo、Support、Trading Guide，已不再是两条线。
- DeFi、NFT、History 各从三个不同来源切入，共 9 组 before/first/100ms/300ms/3s：所有 first 已直接显示 `$0.00 / Start earning`、`No NFTs` 或 `No activity yet / Block explorer`，没有 blank、`rows -> empty -> rows` 或 section 高度二次跳变。对应文件为 `03-defi-r1..r3-*`、`03-nft-r1..r3-*`、`03-history-r1..r3-*`。
- `08-history-block-explorer-ocr.txt` 对三次 History settled 帧识别出的 Block explorer logical top/bottom 都为约 `715.63 / 735.53`，证明当前空态 CTA 几何稳定。当前 `$0` 钱包没有 History records，因此本轮不能覆盖“有记录列表底部的 Only recent transactions / Block explorer footer”；这里只能声明空 History terminal 通过。
- 动态 state height 与惯性作为修复风险专项单独验证，不属于用户原始第四项。`dynamic-height-inertia-valid.mp4` 为 191.966667s，配套 telemetry 包含中间位置双向快速 fling；手指离开后仍有连续位移，没有因 state row 320/760 等高度切换丢失上下任一方向惯性。iOS 17.4 以下仍未测试，继续使用旧 fallback，不能外推体验。
- stable ID 只采用 fresh session 结果：`06-native-home-tab-ids-after-session-rebuild.txt` 逐一点击五个 identifier，每次只有目标 Tab `selected=true`；`06-spot-selected-no-blue.png` 证明 accessibility selected 没有触发错误蓝色 UIButton style。旧 session stale snapshot、partial AX tree 和坐标误点均被明确排除。
- 最终 `native-final-verification.mp4`（882.958333s）覆盖 Perps、首帧序列、History、回切与滚动；`dynamic-height-inertia-valid.mp4` 是聚焦惯性证据。独立 UI verifier 的可见 UI 结论为 Pass。hidden polling 已由代码合同与 focus gate 测试覆盖，但无法仅凭可见 UI/log 在本轮绝对证明“永不发生一次隐藏 RPC”，因此保留为 code-reviewed boundary，而不是夸大为 UI 可观测 Pass。

### Runtime scope、资源所有权与职责固化

- **main runtime：** Native Home state/footer slot、UIKit snapshot/section patch、selected Tab、first-frame cache/shell、行高失效、scroll/content offset、pressed/selected/accessibility 与 per-view request state。
- **bg runtime：** wallet/account 权威数据、History/NFT/DeFi/Perps/Market service、Perps recommendation 请求、watchlist 与持久化。History/Perps hidden gate 控制 main 中的 hook 是否经 proxy 启动 bg RPC，但不会把 service owner 移到 main。
- iOS main/bg 是独立 Hermes heap、独立初始化；DTO 经 proxy 序列化/反序列化，在两个 runtime 各有 JS 副本。main ready 不能替代 bg ready，也不能假设 bg 先 ready。DB/MMKV/file handles、图片/字体 cache 和部分 Native singleton 是进程级共享资源；cell constraint、diffable row/cell、mounted slot host、represented image signature、request cancellation、pressed/hover、selected 与 scroll offset 是 per-view/main 状态，共享 Native cache 不等于共享 JS 对象。
- 后续继续执行职责分离：编写 subagent 只写被分配产品代码；独立 reviewer subagent 负责源码、类型和测试 Pass/Fail；独立 UI verifier subagent 负责标准 Debug、真实截图/录屏、A/B 与交互；主 agent 不直接写产品代码，也不自行验收。每轮完成后由 writer 更新本 handoff，再由主 agent按用户要求精确 stage/commit/push，禁止夹带无关 dirty 文件。

## 2026-07-19 iOS Debug 六单链 Native/Legacy A/B 修复前审计

本节是修复前基线，不代表 UI 已完成。当前 HEAD 为 `c371309f17f90579eadec1638409d03b32a961fd`，设备为 iPhone 17 Pro / iOS 26.5，UDID `4837E819-A117-4E08-9936-445785D199E3`，Bundle ID `so.onekey.wallet`，agent-device session 为 `native-home-p0`。Native 由仓库根目录标准 `yarn app:ios` 完成 Debug build、Metro、更新安装和启动；Legacy 仅在同一 Debug/Metro 工作区临时把 `nativeHomeFeatureFlag.native.ts` 切为 `false` 做同状态 A/B，审计后已经恢复默认 `true`，该文件为零 diff。没有使用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`；没有执行手工 uninstall/reinstall、erase、clear data，没有删除 app container、钱包数据库或持久化数据。

Native 运行探针记录 main `jsReadyAt=1784443304273`、`uiVisibleAt=1784443307191`、`transportState=ready`，bg `bootId=1784443305957-jt52io9l`、`status=ready`；Legacy 运行探针记录 main `jsReadyAt=1784446280550`、`uiVisibleAt=1784446283573`、`transportState=ready`，bg `bootId=1784446282276-mlegk65e`、`status=ready`。两次运行应用均持续存活，`Account #1 / $0.00` 和既有钱包数据正常。main ready 仍不能替代 bg ready。

### A/B 证据目录与取证边界

- Native：`.tmp/ui/native-home-single-network-native-20260719/`；完整录屏 `native-single-network-matrix.mp4`（1717.595s），运行探针、截图和索引见同目录 `runtime-probe.json`、`00-debug-after-yarn-app-ios.png`、`00-native-ready-clean.png`、`evidence-files.txt`。
- Legacy：`.tmp/ui/native-home-single-network-legacy-20260719/`；完整录屏 `legacy-single-network-matrix.mp4`（2573.378333s），运行探针、截图和索引见同目录 `runtime-probe.json`、`00-after-yarn-app-ios.png`、`00-legacy-ready-clean.png`、`evidence-files.txt`。
- Native Nitro 网络选择器和部分 Tab 子树在本次 session 的 accessibility snapshot 中不可观察，不能据此声称 identifier 不存在；坐标操作只采用“截图后立即点击，并再次核对目标网络标题/Tab”的帧。所有误点、旧 snapshot 和目标尚未 settled 的过渡帧均排除。
- Native Tron 只采用 `tron-switch-confirmed-*`；最早的 `tron-switch-*` 实际误点到 Ethereum，排除。Legacy BTC 的 `btc-switch-first.png` 是仍在选择器内的帧，排除，采用 `btc-switch-300ms-valid.png`、`btc-switch-3s-valid.png`、`btc-switch-10s-valid.png`。Legacy ETH 的 `eth-switch-first.png` 仍是 Bitcoin 过渡帧，排除，采用目标网络 settled 帧。Legacy Polygon 采用最终复核的 `*-valid3.png`，早期重试帧排除。Legacy 顶层 Tab 只采用 `*-id-valid.png`，旧坐标尝试和 `all-home-restored-after-invalid-tab-attempt.png` 排除。

### Tab capability 源码规则与当前服务端实际结果

Native 和 Legacy 共用 `useHomeWalletTabSupport({ network })` / `buildHomeWalletTabSupport`：scope key 包含 account scope、network、All/单链；Spot、History 恒定存在；All Networks 的 DeFi 恒为 true，Perps 在全局 `perpDisabled` 为 false 时存在；单链 DeFi 由 bg `serviceDeFi.getDeFiEnabledNetworksMapState` 决定，Perps 仅在 DeFi 支持且未全局禁用时存在；NFT 在 All Networks 恒定存在，单链则同时受 `vaultSettings.NFTEnabled` 和 `networkUtils.getEnabledNFTNetworkIds()` 白名单约束。相关实现位于：

- `packages/kit/src/views/Home/hooks/useHomeWalletTabSupport.ts`
- `packages/kit/src/views/Home/hooks/homeWalletTabSupportUtils.ts`
- `packages/kit/src/views/Home/NativeHomePage.native.tsx`
- `packages/kit/src/views/Home/pages/HomePageView.tsx`

当前 Account #1、当前 server config 的真实 Tab 矩阵为：

| scope | 当前实际 Tab |
| --- | --- |
| All Networks | Spot、Perps、DeFi、NFT、History |
| Bitcoin | Spot、History |
| Ethereum | Spot、Perps、DeFi、NFT、History |
| Solana | Spot、NFT、History |
| Polygon | Spot、Perps、DeFi、NFT、History |
| TON | Native 渲染 Spot、History；Legacy 因缺少 TON address/account，在页面层直接显示 `No address / Create address to enable network / Create address` |
| Tron | Spot、History |

通用数量规则不是“单链固定几个”：DeFi=false/NFT=false 为 2 个；DeFi=false/NFT=true 为 3 个；DeFi=true 且全局禁用 Perps时，NFT=false/true 分别为 3/4 个；DeFi=true、Perps 启用时，NFT=false/true 分别为 4/5 个；All Networks 通常为 5 个，全局禁用 Perps 时为 4 个。禁止为截图写死 Perps 或 Tab 数量。

源码还暴露两个未被本次 `$0` fixture 覆盖的风险：hook 会返回 `perpTabShowWeb`，Legacy 会据此过滤 pager 或把点击路由到 Web Perps，但 Native 当前只消费 `isPerpsSupported`，未处理 Web handoff；正余额 Tron 的 Legacy action config 可能用 Staking 替换 Buy，而 Native header action 目前近似固定 Send/Receive/Buy/More。当前 `$0` 只显示零余额 Add money/More，不能据此宣称正余额行为一致。

### 已确认 FAIL 1：All Networks 切到 Bitcoin 后旧 All rows 回灌并导致高度跳变

复现：在 Native All Networks 已有 Spot rows 时打开网络选择器，切 Bitcoin，目标标题和 `Spot / History` 出现后连续保留 first、100ms、300ms、3s。`btc-switch-first.png` 首帧只有 BTC；从 `btc-switch-100ms.png` 起，旧 All Networks 的 USDT、USDC、ETH、SOL、BNB rows 回灌，Market 以下 section 和外层 content offset 随 section 高度一起跳。Legacy 的 `btc-switch-300ms-valid.png`、`btc-switch-3s-valid.png`、`btc-switch-10s-valid.png` 始终只保留 BTC，因此这是 Native FAIL，不是服务端正常渐进加载。

根因在 main runtime 的 owner 生命周期，不在 bg 数据污染、Swift cell 复用或网络过滤：

- `useNativeHomePortfolioData.ts` 的 `applyAllNetworkCache` 直接替换 All response map 并 `applySlice`；`handleAllNetworkStarted`、accounts/cache/settled/finished callback 和最终 `allNetworkResult` effect 都没有校验当前 live owner。
- scope effect 会把 `allNetworkGenerationRef.current` 重置为 0，导致旧 All run 的 generation 在切到 BTC 后仍可能被判定为“更新”；generation 只能表达同一 owner 的 last-write-wins，不能充当 owner identity。
- `useAllNetwork.ts` 在 owner 变化时重置初始化/run count，却没有取消或使已经外逸的 progressive/cache callback 失效；`makeColdRequestFactory.ts` 的 `onRequestSettled` 也直接外调，绕过 `usePromiseResult` 的 result nonce。
- `NativeHomePage.native.tsx` 最终调用 `controller.updateTabSections('portfolio', portfolioSections)`；Controller/DTO/Swift section patch 没有 account/network/scope epoch，错误 rows 会被正常应用并重新计算高度，所以高度跳变是上游 scope 污染的可见症状。

下一修复边界：为每次 All run 捕获不可变 owner signature（至少 wallet/account/network/isAll/requestKind），所有 cache、progressive、warm/cold settled、accounts、finished 和 UI commit callback 在写入前与 live owner ref 比对；stale run 只允许释放内部 fetching，不得写 UI。generation 仅在相同 owner 内做顺序控制。state/section patch 还应带 owner scope/epoch，或只让 consumer 暴露当前 scope slice，形成下游防线。禁止在 adapter 里按 BTC 过滤旧 rows、添加延迟或用猜测性动画掩盖。需要聚焦测试延迟触发 All cache/warm/cold/final/finished 后 All→BTC 均不回灌，并以真实 first/100ms/300ms/3s 和 content offset/section 高度复验。

### 已确认 FAIL 2：TON 缺少 account/address 时 Native 永久 skeleton，Legacy 有终态

复现：同一 Account #1 切到 TON。Native 从 first、100ms、300ms、3s 到约 47s，随后进入 History 再回 Spot 3s，始终是 4 行 skeleton；该序列合计持续约 90s。Legacy 的 `ton-first-valid.png`、`ton-300ms-valid.png`、`ton-3s-valid.png`、`ton-10s-valid.png`、`ton-20s-valid.png`、`ton-30s-valid.png` 均立即显示完整页面终态 `No address / Create address to enable network / Create address`，没有 Spot/History token skeleton。当前 fixture 的直接原因是 Account #1 没有 TON address/account，而不是已证明的 TON API 慢请求。

Native 根因：`useNativeHomePortfolioData` 在 scope effect 先清 rows、置 `initialized=false`，随后因 `!accountId` 提前 return；`loadSingle` 也在缺 accountId 时直接 return。页面没有提交 `no-address` 终态，也没有在进入 Native data tree/tab shell 前复用 Legacy 页面级 guard，于是 adapter 永远把 empty+uninitialized 映射为 skeleton。

同一 hook 还存在一个静态可证、但与本次缺 account 的实际 TON 帧要分开记录的 P0：裸 `setInterval(POLLING_INTERVAL_FOR_TOKEN=15_000)` 会周期调用 `loadSingle()`，没有同 scope in-flight guard；每次又递增 requestId，而全局 Axios timeout 为 30s。对一个有 account、耗时超过 15s 的 service 请求，或被 `commitNativeHomeSnapshotAfterProjection` 的 custom-token task 阻塞超过 15s 的请求，下一轮会把前一轮标记 stale，catch/commit/finally 都因 requestId 失效，随后循环自我取消，可能形成永久 skeleton。Legacy polling 是 request settle 后再计时且会 abort 旧 home-token-list 请求，custom-token projection 也不阻塞 token rows commit。

下一修复边界：先在页面层恢复 Legacy no-account guard，缺 network account 时渲染明确 `No address` 和真实 `Create address` 路由，不 mount 会发数据请求的 Native Home owner；所有 disabled/missing-owner hook 分支必须 terminal-settle。有效 account 的 single-network poll 改为同 owner single-flight/queued poll，下一次从 finally/settle 后计时，owner generation 只在 scope 变化时递增；custom projection 与首屏 rows commit 解耦或设有界等待。测试至少覆盖 no account 不发 service RPC 且 Create address 可交互、20s 慢请求只有一个 in-flight 并能成功落地、owner switch 丢弃旧结果。

### 同状态已存在于 Legacy、不能在本轮误判为 Native-only 的行为

- Ethereum 和 Polygon 切换时都存在 skeleton 到 rows 的渐进插入/重排，Legacy 也可复现；这轮不能把它们当成仅 Native 回归，也不能用静态假数据消除。后续若优化首帧，必须以 scoped cache、同 owner snapshot 和稳定 section height 为基础。
- Ethereum/Polygon 的 Perps 当前 service path 在 Legacy 也约 2–3s 才从 Hot Markets/View more 或已知 loading 状态补齐 rows。只要首帧不是全页白屏，不得伪造 Perps 数据；后续仍需量化 section 高度和 content offset 连续性。
- 单链 BTC、ETH、Polygon、TON、Tron 下都能看到 SOL/Solana Earn row，Native 与 Legacy 一致，是当前全局 Earn 产品行为，不得在 Native adapter 中私自按当前 network 过滤。

### 本轮未覆盖、仍必须保留的验收风险

- 当前只是已有多链 `Account #1 / $0` 在六个单链 scope 间切换，不是“第一次创建的空钱包”“第一次启动进入”“真实单链有钱钱包”。不得外推到正余额或首次启动。
- Native network selector identifier/row identifier 在这次 Nitro accessibility tree 中不可观察；后续需补稳定可观测 ID，或继续使用截图后立即点击并核对标题的短 batch，坐标误点不能作为结论。
- `perpTabShowWeb` 路由、正余额 Tron action、缺 account/hardware account 创建与连接 guard 尚未通过真实交互。
- 当前 `$0` History 主要覆盖空态；有 records 时的日期分组、金额颜色、底部 `Only recent transactions... / Block explorer` 和 NFT→History 保持 offset/无大空白仍未验收。
- imported/private-key、watching、external、keyless、hardware、fresh/no-wallet、unbacked/positive 等钱包类型和状态未覆盖。
- Light mode、Dynamic Type Large/XXXL、iOS 17.4 以下 fallback、Android Native/hybrid 均未覆盖。图片/字体 cache 是进程级共享 Native 资源，但 represented image signature、request cancellation、cell constraint、pressed/hover、selected、scroll offset 仍是 per-view 状态；不能因共享 cache 推断 per-view 正确。

### Runtime scope 与后续 subagent 分工

- **main runtime：** Native Home UI、network/Tab selection、scope cache/snapshot、portfolio/section patch、UIKit height/offset、no-account guard 和 per-view request lifecycle。BTC stale rows 与 TON 未提交终态均属于 main owner/渲染链问题。
- **bg runtime：** account/network 权威数据、DeFi capability、portfolio/Market/History/NFT/Perps service。main/bg 使用独立 Hermes heap，DTO 经 proxy 序列化/反序列化，各 runtime 各持 JS 副本；两者独立初始化，不得假设 bg 先 ready。DB/MMKV/file handle、图片/字体 cache 和部分 Native singleton 可能是进程级共享资源。
- owner/race writer subagent 只处理 All→single scope ownership、generation 和必要 tests；no-account/poll writer subagent 只处理 Legacy guard parity、terminal state、single-flight polling 和必要 tests。禁止顺手修改 Discovery、Swap、TradingView、Firmware、Android 或其他 dirty owner。
- 独立 code reviewer subagent 不参与编写，负责复核 owner identity、所有 callback gate、type/lint/Jest、slow-request/no-account tests 和未混入无关 diff；发现问题必须退回 writer 修正后再复核。
- 独立 UI verifier subagent 只使用标准 `yarn app:ios` Debug，在 main/bg 均 ready、钱包仍正常后录制真实 A/B：All→BTC first/100ms/300ms/3s 无旧 rows、无高度/offset 跳变；TON 无 account 直接出现 Create address 终态；慢请求/有 account fixture 若不可安全构造则明确列为阻断，不能凭代码存在判定通过。
- 主 agent 只负责拆分范围、保护 dirty files、汇总 reviewer/verifier 结论，以及按用户要求精确 stage/commit/push；不直接编写产品代码，也不自行做 code/UI 验收。每轮 writer 负责同步本 handoff，最终不得在视觉、交互、连续切换、空态/降级态证据不全时宣称“Native Home 已完成”。

## 2026-07-19 iOS Debug 六单链修复后最终验收

本节追加在上一节“修复前审计”之后，不覆盖或改写历史 Fail。最终结论只针对 iPhone 17 Pro / iOS 26.5、当前已备份多链 `Account #1 / $0.00` 在 All Networks 与六个单链 scope 间切换的 Native Home Debug 现场；它不是第一次创建空钱包、第一次启动或真正单链有钱钱包的替代证据。

### 修复前矩阵、Legacy A/B 边界与两轮证据

- 修复前同状态 Native/Legacy A/B 的权威基线仍是上一节：Native `.tmp/ui/native-home-single-network-native-20260719/`，Legacy `.tmp/ui/native-home-single-network-legacy-20260719/`。原版 RN 代码仍保留；Legacy 只在同一个 Debug/Metro 现场临时把 `nativeHomeFeatureFlag.native.ts` 切为 `false` 采集基准，采集后恢复 `true` 且该文件保持零 diff。
- 修复前明确的真实 UI **Fail** 保留为四类：All Networks 切 BTC 后旧 All rows 回灌；缺 TON account/address 时 Native 永久 skeleton 而 Legacy 直接给出 No address 终态；补第一轮修复后，Polygon -> TON missing -> Tron/All 会出现 Header/网络图标已切换、body 仍永久停留 Polygon tabs/rows 的持久旧 snapshot；Unified Network Selector 的真实 All Networks manager row 与 Single network row 外层 clickable Pressable 缺少稳定 `select-item-*` identifier。
- 第一轮修复后的中间证据位于 `.tmp/ui/native-home-single-network-after-20260719/`，其中 `99-ton-to-tron-first.png`、`104-ton-to-tron-20s.png`、`107-tron-to-all-first.png`、`111-tron-to-all-20s-stale.png` 及 `native-single-network-after.mp4` 是 controller revision 问题的真实 Fail 证据：Header slot 已显示 Tron 或 All Networks，但 native body 20 秒后仍是 Polygon。它们不得被当成最终通过帧。
- 最终 Native 证据位于 `.tmp/ui/native-home-single-network-final-20260719/`；完整录屏为 `native-single-network-final.mp4`，手势 telemetry 为 `native-single-network-final.gesture-telemetry.json`，双向 fling 聚焦片段为 `72-fling-bidirectional-clip.mp4`。本轮没有再临时切 Legacy；最终判定是修复后的 Native 对照前一节同状态 Legacy 基准及明确的逐帧 Pass 条件，不外推到其它 wallet fixture。

### 根因与最终修复边界

- All -> single stale rows 的根因是 All Networks 异步 cache、progressive、settled、finished 和最终 commit 没有统一绑定 live owner；单一 generation 在 scope effect 中重置，不能表达 wallet/account/network identity。修复后每次 request/run 捕获不可变 owner/epoch，所有外逸 callback 写入前校验 live owner；generation 只在同 owner 内处理顺序，旧 owner 只能完成内部清理，不能再写当前 rows 或 section patch。All -> BTC 的原生 body 因此不会被旧 All response 回灌。
- single-network 请求改为 per-owner single-flight，并在当前请求 settle/finally 后再安排下一轮 polling；同 scope 的重复事件只合并为一次 queued refresh，scope 切换会使旧 generation 失效。这样避免 15 秒 interval 抢占尚未结束的慢请求并持续自我取消。真实 20 秒慢 service fixture 本轮没有安全构造，slow-request 只由聚焦 lifecycle 测试覆盖，不能夸大成真实网络 UI Pass。
- custom-token projection 不再阻塞首屏 canonical token rows commit；projection 完成后只在 owner 仍相同时补充结果，旧 owner projection 被丢弃。服务 rows 可先进入当前 scope，不会因为辅助 projection 延迟而维持 skeleton。
- 缺 account/address 的单链在页面级直接走现有明确的 missing-account terminal，不挂载会启动 portfolio RPC、polling、snapshot/controller 的重型 Native Home owner；TON 因此显示 `No address / Create address to enable network / Create address`，不再永久 skeleton。该页面仍由当前 wallet/network scope 决定，不能把 `undefined wallet` 或尚未 settled 的首次启动状态误判成 missing account。
- Polygon -> TON missing 会条件卸载 `NativeHomePageContent`。此前 controller 位于该子树内，重挂 Tron/All 时 revision 从 0 重新开始；仍存活/复用的 Nitro Native view 已持有更高 revision，合法拒绝低 revision snapshot，于是独立 RN Header slot 更新了网络图标，而 native tabs/body 保留 Polygon。修复后 controller owner 位于条件分支外并跨 missing page 保持同一 revision；重挂前按新 scope 原子 `replaceSnapshot`，detach/attach 绑定真实 target，避免旧 cleanup 误 detach 新 target。Header、tabs、rows 现在属于同一个当前 scope snapshot。
- selector 之前只有内部内容节点或旧 product testID，真实 clickable leaf 不可稳定定位。`ListItem` 新增专用 `nativePressableTestID`，All Networks manager 的 `NetworkListItem` 与 Single network 的 `EditableListItem` 都把 `select-item-${networkId}` 传给唯一外层 iOS RN `Pressable`，同时保留旧内层 testID。外层保持 `cancelable`、50ms press delay 和单一 `onPress`，拖动取消不会误触，内部 checkbox/内容不会造成同一次点击执行两次。
- 独立 code reviewer 在 writer 修正 controller owner/revision 和 selector 真实 caller contract 后给出 code Pass。最终聚焦 Jest 为 7 suites / 24 tests 全部通过，覆盖 owner remount revision、All owner/generation、single-flight/queued refresh、missing account、projection、实际 selector caller 与 drag/click contract；oxlint、oxfmt 和指定 diff-check 通过。root TypeScript 仍只有 Desktop `config.perfReady` 缺失和旧 `HOME_HEADER_SEARCH_ROW_HEIGHT` export 两个共享工作区无关错误，未为制造绿色结果混修。

### 标准 Debug、进程与数据安全

- 独立 UI verifier 从仓库根目录执行标准 `yarn app:ios`，最终为 Debug `Build Succeeded`，由该命令负责 build、Metro、更新安装并启动 `so.onekey.wallet`；最终应用进程 PID 为 `11177`。没有改用 Release、自定义 `xcodebuild` 或 `CODE_SIGNING_ALLOWED=NO`。
- main runtime 与独立 bg runtime 分别确认 ready，不能用 main ready 代替 bg ready。应用持续存活并保持 foreground，钱包仍为 `Account #1 / $0.00`，既有钱包数据正常；最终恢复帧为 `01-all-ready-clean.png`、`03-home-recovered.png`、`04-home-recovered.png` 和 `73-final-foreground.png`。
- 全程没有执行独立 uninstall/reinstall、erase、clear data，没有删除 simulator app container、钱包数据库或持久化数据；`yarn app:ios` 的更新安装不是被禁止的手工 reinstall。没有执行真实创建地址、真实备份或其它会改钱包权威状态的流程。

### All Networks 与六个单链最终结果

以下只采用最终目录中的目标确认帧；selector 尚未关闭、目标标题未确认、坐标误点、上一轮 stale 帧均排除。

| scope | 最终 Tabs | Spot/页面终态与逐帧结论 |
| --- | --- | --- |
| All Networks | Spot、Perps、DeFi、NFT、History | `26` 至 `30` 的 Tron -> All first/100ms/300ms/3s/20s 均进入 All scope；20 秒帧显示 All 聚合 rows（可见 BTC、USDT、USDC、ETH、SOL 等），没有保留 Tron 或 Polygon body。|
| Bitcoin | Spot、History | `34-all-to-btc-first-valid.png` 首帧和 `35-all-to-btc-3s-valid.png` 都只显示 BTC token row；没有旧 All rows 回灌、`rows -> empty -> rows`、section 高度突增或 offset 跳变。|
| Ethereum | Spot、Perps、DeFi、NFT、History | `36`/`37` 首帧与 3 秒帧进入 ETH scope；settled 可见 ETH、USDT、USDC、DAI、RNDR 等当前网络 rows，没有 BTC/All/Polygon 旧 body。|
| Solana | Spot、NFT、History | `38`/`39` 首帧与 3 秒帧进入 SOL scope；settled 可见 SOL、USDT、USDC rows，Tab 数量与当前 capability 一致。|
| Polygon | Spot、Perps、DeFi、NFT、History | `40`/`41` 首帧与 3 秒帧进入 POL scope；settled 可见 POL、USDT、USDC.e、BUSD、DAI rows。随后五个 Tab 分别获得独立 first/3s 证据。|
| TON | 不挂载普通 Native tabs/body | `15` 至 `19` 的 Polygon -> TON first/100ms/300ms/3s/20s 始终为 `No address / Create address to enable network / Create address`；没有 skeleton，也没有 Polygon rows。|
| Tron | Spot、History | `20` 至 `24` 的 TON -> Tron first/100ms/300ms/3s/20s 均显示 Tron scope；settled 可见 TRX、USDT、USDC rows，没有回到 Polygon 或 missing page。|

Polygon 的完整 Tab 结果：Spot 使用当前 POL rows，并在 `50-polygon-spot-bottom.png` 抵达页面底部；Perps 的 `42/43` 显示 `Perps · $0.00`、Deposit 与真实 Hot Markets rows，不是白屏；DeFi 的 `44/45` 收敛为 `$0.00 / Start earning / Your positions will appear here`；NFT 的 `46/47` 收敛为 `No NFTs / No NFTs found at this address`；History 的 `48/49` 收敛为 `No activity yet / Block explorer`。五个 Tab first/3s 均没有跨 Tab 旧 rows、全页白屏或持久 skeleton。

### Selector、底部 inset、惯性与一次性 warning

- All networks/Portfolio panel 使用真实 row clickable leaf；`06-portfolio-arbitrum-off-once.png` 与 `07-portfolio-arbitrum-restored-once.png` 证明 Arbitrum 每次单击只切换一次，`08-portfolio-short-drag-no-toggle.png` 证明短拖动按 cancel 语义不改变 checkbox。旧 `all-networks-manager-item-*` content ID 仍保留，不与外层 ID 重复抢点击。
- Single network panel 使用同一路径的真实外层 identifier；TON 的实际 ID 为 `select-item-ton--mainnet`，不是根据可见文本或旧坐标猜测。`09-selector-network-open.png` 与 `15-polygon-to-ton-first.png` 证明该 row 单击一次后切到 TON；两类 selector panel 都不再依赖不可观察的 Nitro 子树坐标命中来判定。
- `50-polygon-spot-bottom.png` 显示 Help center 完整位于浮动底部 Tab bar 上方，保留约 22pt 可见 clearance，已经能够真正触底，没有被底栏遮挡。
- `51` 至 `54` 为一个方向的 release/100ms/300ms/1s 连续帧，`55` 至 `58` 为相反方向；`70-fling-down-contact-sheet.png`、`71-fling-up-contact-sheet.png`、`72-fling-bidirectional-clip.mp4` 和 gesture telemetry 证明手指离开后两向都继续 decelerate，没有此前“一个方向有惯性、另一个方向立即停住”或轻滑跳顶。
- 标准启动时出现过一次来自 Dev mode Gallery 的 `Alert / asyncImportTest` Debug warning，证据为 `02-system-alert.png`；dismiss 后 Home 正常恢复。`59-warning-repro-start.png` 至 `67-warning-cycle3-portfolio.png` 连续三轮 Single network/Portfolio 切换没有再次出现，因此本轮按一次性 Debug 外部 warning 记录为非阻断，不据此修改 Discovery/Dev Gallery 或扩大 Native Home scope；后续若稳定复现再单独建 owner 调查。

### 未覆盖限制、runtime scope 与职责分工

- 最终 **Pass** 只关闭上述同状态六单链切换、TON missing terminal、controller remount、selector row、22pt 底部 clearance 和 iOS 双向 fling。仍未覆盖：第一次创建空钱包、第一次启动 gate、真正单链有钱钱包、正余额未备份、已备份零资产的其它动作矩阵、Keyless/imported/private-key/watching/external/hardware、正余额 Tron Staking action、`perpTabShowWeb` handoff、TON Create address 完整创建流程、有 account 的真实 20 秒慢 service、非空 NFT/DeFi/History records 与完整 footer、Light mode、Dynamic Type Large/XXXL、iOS 17.4 以下和 Android Debug。不得把本轮 `$0` 多链钱包切 scope 的结果外推为这些状态已 Native 化或已完成。
- **main runtime：** 页面 surface/no-address guard、network/Tab selection、owner/epoch/generation、single-flight/queued polling、custom-token projection、controller snapshot/revision、section patch、UIKit height/offset、selector Pressable、accessibility 与 per-view gesture state。Native view 可以跨 JS 条件子树存活或复用，因此 controller revision 必须由外层 main owner 保持。
- **bg runtime：** wallet/account/address 与 capability 权威状态，以及 portfolio、Market、History、NFT、DeFi、Perps service 数据。main/bg 是独立 Hermes heap、独立初始化；DTO 经 proxy 序列化/反序列化并在两边各有 JS 副本，main ready 不能替代 bg ready，也不能假设 bg 先 ready。
- DB/MMKV/file handles、图片/字体 cache 和部分 Native singleton 是进程级共享 Native 资源；controller JS owner/epoch/generation 属于 main heap，cell constraint、diffable snapshot/cell、represented image signature、request cancellation、pressed/hover/selected、selector drag cancellation 与 scroll offset 是 per-view 状态。共享图片或 DB cache 命中不能证明某个 view 的 revision、复用或手势状态正确。
- 本轮继续固定职责：writer subagent 只编写被分配的产品代码/测试，并在结论稳定后更新本 handoff；独立 reviewer subagent 不参与编写，负责源码、owner/race、类型、lint 和聚焦测试 Pass/Fail；独立 UI verifier subagent 只用标准 Debug 包执行真实截图、逐帧、录屏、identifier 点击和 gesture 验收；主 agent 只负责拆分、汇总结论、保护 dirty files，以及按用户要求精确 stage/commit/push，不直接写产品代码，也不自行替代 reviewer/verifier。
