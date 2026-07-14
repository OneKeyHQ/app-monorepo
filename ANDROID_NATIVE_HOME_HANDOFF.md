# Native Home UI Continuation Handoff Prompt

你正在继续维护 OneKey `app-monorepo` 的原生首页。这个文档最初用于 Windows/Android 交接；2026-07-14 的 iOS 真机复测又发现了分页、下拉刷新和业务语义问题，因此现在同时记录 Android UI 对齐要求与 iOS/shared 遗留问题。

如果当前环境是 Windows，只处理并验证 Android 能覆盖的部分，不要宣称 iOS 问题已经通过。如果当前环境是 macOS，先在 iOS 模拟器复现本文新增的 5 个遗留问题，再修改 iOS；涉及公共 schema 或 JS action 的修改必须回归 Android。

## 仓库与分支

- 仓库：`OneKeyHQ/app-monorepo`
- 分支：`codex/native-home-container`
- 原生首页最新基准 commit：`09ff3f0623`（`fix: stabilize native home paging and actions`）
- Base branch 是 `x`，但本次不要切换、合并或 rebase `x`。

开始前执行：

```powershell
git fetch origin
git switch codex/native-home-container
git pull --ff-only
git merge-base --is-ancestor 09ff3f0623 HEAD
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

这部分自动化仍受上面单次 `touchesMoved` 限制，必须在真机逐项复核账户、网络、金额、按钮、Banner、Tabs、accessory 和列表第一行起点。代码层通过条件已经具备：所有起点共享 outer 原生 pan/UIRefreshControl，不存在 Header 专用的第二套阻尼或 spinner 状态。

### 第二轮实现的运行时边界

- **Runtime scope：** 修改仅在 main UI runtime 执行。bg runtime 不创建 native view，也不参与 pan、Pager、Slot host 或 refresh state。
- **Native resource ownership：** outer、Pager、每页 table、Slot host/parking view、方向 gate 和共享 `UIRefreshControl` 都由单个 `HomeContainer` 实例持有；没有新增进程 singleton。图片 cache 仍是既有共享 native resource。
- **JS heap copies：** main/bg 仍各自反序列化自己的 JS 数据；横滑/下拉热路径没有把 offset、progress 或 velocity 复制到任一 JS heap。
- **Timing/order：** main/bg 独立初始化；bg 晚到的数据仍通过 revision/section patch 精确更新，不能假设 bg ready，也不会因 refresh 或横滑重建容器。

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
