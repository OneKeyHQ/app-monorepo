# 新 Session 提示词：iOS Native Home Debug UI 调试与验收

你正在继续 `/Users/huhuanming/Project/app-monorepo` 的 Native Home 工作。当前分支是 `codex/native-home-container`，交接时 HEAD 为 `120c035707`。请先完整阅读仓库根目录的 `AGENTS.md` 和 `ANDROID_NATIVE_HOME_HANDOFF.md`，重点阅读 handoff 最后的：

- `2026-07-15 Market 行逐像素审计：Star、Token、Badge、字体和 View more`
- `2026-07-16 iOS Release Market UI 真机复测`
- `2026-07-16 交接：后续统一改用 iOS Debug 包做 UI 调试`

## 本次目标

使用 iOS **Debug** 构建恢复可调试环境并继续 Native Home Market UI 真机验收。先验证已有 iOS 左右列约束改动是否修复过度截断，再定位 Stocks 图片 fallback 与 Trending BTC volume。不要先大范围改代码，不要凭编译通过或元素存在宣称 UI 通过。

## 绝对安全约束

1. 不得执行 uninstall、reinstall、erase、clear data、删除 simulator app container、删除钱包数据库或任何会清空钱包数据的命令。
2. 使用仓库标准命令 `yarn app:ios` 构建并更新安装 Debug 包；不要自行切换到 Release 或手工关闭签名。
3. 当前已经没有 crash。旧的 unsigned Release 报告仅是历史构建产物问题，不是当前待修问题，不要继续围绕旧 crash 做分析或修改。
4. 不得 reset、checkout、clean、stash 或覆盖工作区。当前有大量用户和其他任务的未提交改动；只修改 Native Home 明确相关文件。
5. 不得把无关 Discovery、Swap、TradingView、Firmware 等改动混入提交。除非用户明确要求，本轮先不要 commit/push。
6. 默认新首页仍是重点；不得退回旧首页来规避问题。

## 运行时边界（分析和汇报必须明确）

- `main` runtime：Native Home UI、Market category selected/cache、snapshot、section patch。
- `bg` runtime：Market basic config、category/watchlist/service 数据，通过 proxy 提供给 main。
- main/bg 有独立 Hermes JS heap；数据按 runtime 独立序列化/反序列化，不能假设对象共享或 bg 先 ready。
- 图片/font cache 是进程级共享 Native 资源；cell constraint、represented image signature、request cancellation、pressed/hover 是 per-view 状态。
- 当前 Debug 环境已经可以正常启动。UI 验收时仍需分别确认 main 与 bg ready，不能只看到首页就假定两个 runtime 都已完成初始化。

## 当前设备与已知状态

- Simulator：iPhone 17 Pro / iOS 26.5
- UDID：`4837E819-A117-4E08-9936-445785D199E3`
- Bundle id：`so.onekey.wallet`
- agent-device session：`native-home-p0`
- 当前已经没有 crash，钱包数据仍在。
- 新 session 开始后先执行 `yarn app:ios`，重新构建并更新安装当前分支的 Debug 包，然后全部使用 Debug 包调试。
- 不需要继续排查旧的 `OneKeyWallet-2026-07-16-014537.ips`；它只用于说明为什么不能使用曾经的 unsigned Release 产物。

## 第一步：检查工作区，禁止破坏性操作

```bash
cd /Users/huhuanming/Project/app-monorepo
git branch --show-current
git status --short
tail -n 220 ANDROID_NATIVE_HOME_HANDOFF.md
```

确认分支和 handoff 后，不要处理或回滚无关 dirty files。

## 第二步：使用 yarn app:ios 更新 Debug 包

固定使用仓库标准命令构建、安装并启动 Debug 环境：

```bash
cd /Users/huhuanming/Project/app-monorepo
yarn app:ios
```

让 `yarn app:ios` 负责 Debug build、Metro 和应用更新安装。不要用自定义 Release `xcodebuild` 替代，也不要附加 `CODE_SIGNING_ALLOWED=NO`。

## 第三步：验证 Debug 包和数据

确认运行中的应用是刚由 `yarn app:ios` 更新的 Debug 包，而不是旧 Release 产物。验证钱包数据可见、应用持续存活，并确认 main/bg 两个 runtime 都正常 ready 后，再进入 UI 验收。main ready 不代表 bg ready。

## 第四步：先验证已有约束改动，不要立即再改

当前 `packages/native-components/ios/HomeContainerView.swift` 已把 Market row 左右列关系从：

```swift
rightStack.leadingAnchor.constraint(greaterThanOrEqualTo: leftStack.trailingAnchor, constant: 8)
```

改为：

```swift
rightStack.leadingAnchor.constraint(equalTo: leftStack.trailingAnchor, constant: 8)
```

原版 symbol 128pt 和 localized subtitle 66pt 上限仍保留。这个改动已经通过 Swift parse，但还没有新 Debug UI 截图验证。

先截图 Favorites，检查 `LINK/SHIB/WLFI/UNI` 是否仍被压成 `LI.../S.../W.../...`。再切 Trending 检查 `CASHCAT`，切 Stocks 检查 subtitle。如果仍失败，请从 Auto Layout 实际 frame、content hugging/compression resistance 和 stack distribution 重新分析；按照 `AGENTS.md`，失败后必须从根因重新分析，不能继续对同一方案小修小补。

## 第五步：按 handoff 做真实 UI 验收

必须生成新的 Debug 截图，建议放在：

- `.tmp/ui/handoff-ui-market-favorites-after-debug.png`
- `.tmp/ui/handoff-ui-market-trending-after-debug.png`
- `.tmp/ui/handoff-ui-market-stocks-after-debug.png`
- 每张同时生成宽度 402 的 `-402.png` 对照图。

验收项：

1. Favorites 空态显示 4 个推荐 Token 与 `Add 4 tokens`；title 不应异常缩成单字符 ellipsis。
2. Favorites / Trending / Stocks 单次与连续切换时首帧都有缓存数据，无 `rows -> empty -> rows`、无 section 高度抖动。当前服务端没有 `perpsCategories.hot`，不要写死 Perps；换有 hot config 的环境再验。
3. Star path、分类 Star 18pt、行内 Star 20pt、行内独立点击和 pressed/hover 与原版一致。
4. Market Token 32pt；network badge 外层 20pt（2pt app 背景 + 16pt network image）；title/value 使用 Roobert Medium 16/24，subtitle/detail 使用 Roobert Regular 14/20。
5. 普通 Spot 第二行只显示 volume，不显示 token name；Stock/Perps 才允许 subtitle。BTC 没有 volume 时先检查 DTO，原版也会在 falsey volume 时隐藏，不得伪造占位。
6. Stocks 的 AAPL/SLV/CRCL 必须优先显示服务端真实 logo，只有所有 `logoUrl/logoUrls` 候选真实失败才显示 CryptoCoin fallback。记录候选 URL、格式、loader 错误与 represented signature，区分空候选、SVG/格式不支持、缓存和复用串图。
7. Market `View more` 可见高度约 36pt、独立 20pt chevron、字体和 pressed/hover 对齐原版。
8. Light/Dark 都需截图；元素存在、编译通过或单帧截图都不能证明切换无抖动与点击正确。

## 交互自动化限制

Nitro Market 子树当前没有出现在 accessibility snapshot。DeFi/Earn 异步 section 会改变 Market 的 y 坐标，延迟坐标点击容易误命中其他 `Show more` / `View more`。误命中不能作为通过或失败证据。

优先方案：

1. 给必要 Native 控件补稳定 accessibility identifier/label；或
2. 使用“截图后立即点击”的短 `agent-device batch`，不要人工分析几分钟后复用旧坐标；
3. 对连续切换、hover/press 和横滑/下拉手势保留录屏或多帧证据。

## 检查命令

修改后至少执行：

```bash
cd /Users/huhuanming/Project/app-monorepo
xcrun swiftc -parse packages/native-components/ios/HomeContainerView.swift
git diff --check -- ANDROID_NATIVE_HOME_HANDOFF.md \
  packages/native-components/ios/HomeContainerView.swift \
  packages/native-components/ios/HomeContainerModels.swift \
  packages/native-components/src/HomeContainer.types.ts \
  packages/kit/src/views/Home/NativeHomePage.native.tsx \
  packages/kit/src/views/Home/useNativeHomeSupplementalData.ts
```

运行与变更风险相称的聚焦 Jest/ESLint。全量 `yarn agent:check --profile commit` 可能被工作区已有的 Swap/Discovery 等无关 dirty changes 阻断；记录真实阻断，不要回滚别人的改动来制造绿色结果。

## 汇报格式

每次结论都要写清楚：

- 实际运行的是 Debug 还是 Release，以及 main/bg 是否都 ready；
- 覆盖安装前后数据文件计数，明确没有 uninstall/reinstall/clear；
- 哪些验收项有真实截图/录屏通过，哪些仍失败或受服务端 config 限制；
- main/bg runtime scope、共享 Native 资源与 per-view 状态；
- 修改了哪些文件、执行了哪些聚焦检查；
- 不要声称“UI 已完成”，除非 handoff 中列出的视觉、交互、连续切换与降级态均有真实证据。
