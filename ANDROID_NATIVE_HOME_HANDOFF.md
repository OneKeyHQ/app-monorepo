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
