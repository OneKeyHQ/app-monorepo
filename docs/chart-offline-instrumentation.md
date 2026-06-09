# Chart offline / prewarm 排查计装 (DEBUG)

分支: `debug/chart-offline-instrumentation`(app-monorepo 与 app-modules 两个仓库同名分支)

目标:在**生产包 + 模拟器**上复现并定位:

- **Q1** perps 主页预热(`ChartPrewarm`)为什么没生效、perps 详情页为什么不能秒开
- **Q2** market 页面图表为什么不显示数据

---

## 背景结论(来自线上日志分析)

- 离线选择本身正常:`market => chart => chartSource` 一直是 `sourceKind:offline, pooled:true`,且无 TradingView/CDN 网络请求。
- 但 `chartLoadEnd`(native `WKWebView didFinish` 才会触发)在出问题的会话里 **0 次** → 那个池化 WebView 从没加载完成。
- native 之前用裸 `NSLog`,**不会写进 `app-latest.log`**,所以 native 行为此前完全不可见 —— 这是计装要解决的首要盲区。
- 段(segment)加载时序证明:冷启动 deep-link 下,详情页 `MobilePerpMarket` 先于承载 prewarm 的 `Perp.pages.Perp` 段加载十多秒,prewarm 来不及成为 pool owner。

---

## 计装清单

### Native(app-modules `native-views/react-native-chart-webview/ios/ChartWebview.swift`)
全部经 `OneKeyLog`(tag = `ChartWV`)写入 `app-latest.log`。podspec 新增 `s.dependency 'ReactNativeNativeLogger'`。

| 日志 | 含义 / 排查点 |
|------|------|
| `host.init` / `host.windowChange attached=` | 宿主创建、是否 attach 到 window(`wantsOwnership` 前提) |
| `reconcilePooled ... wantsOwnership=` | 是否满足拥有 pool 的条件(attached && active) |
| `reconcilePooled.CLAIM` / `.YIELD` | 谁拿到/让出 pool 所有权(**Q1 核心**) |
| `setBridgeScript.REGISTERED` / `.SKIP` | bridge 是否注册(空脚本/无 userContent 会 SKIP) |
| `setSource.LOAD` | 真正发起加载(URL) |
| `setSource.BLOCKED bridgeRegistered=false` | **关键**:bridge 没注册导致从不加载 |
| `setSource.SAME_URL` / `.NO_URL` / `.INVALID_URL` | 其它不加载原因 |
| `nav.didFinish` | 加载完成(对应 JS `chartLoadEnd`) |
| `nav.didFail` / `.didFailProvisional` | 加载失败(以前完全沉默) |
| `scheme.serve path= bytes=` | 离线静态资源命中(html/js/css) |
| `scheme.404` / `scheme.NO_BUNDLE` | **Q2**:离线资源未命中(路径错/未打包) |
| `msg.in` / `msg.out` | bridge 收发(截断 200 字符;**Q2** 看 kline 请求/回包);OneKeyLog 自带限频去重 |
| `pool.CREATE` / `pool.DESTROY` | 池实例生命周期 |

### JS(app-monorepo)
新增 logger 方法在 `packages/shared/src/logger/scopes/market/scenes/chart.ts`:
`chartError`、`chartPrewarm`、`chartHost`、`chartKline`。

| 日志 | 文件 | 排查点 |
|------|------|------|
| `market => chart => chartPrewarm phase=mount/disabled/unmount` | `ChartWebView/ChartPrewarm.tsx` | **Q1**:prewarm 何时挂载/是否 enabled |
| `chartHost event=mount/unmount/focus/eagerSend/resync` | `ChartWebView/index.native.tsx` | **Q1**:宿主 focus/active 时序(决定 native 所有权) |
| `chartError`(新接 `onError`) | `ChartWebView/index.native.tsx` | 之前 `onError` 根本没接,加载失败 JS 侧完全无日志 |
| `chartKline phase=request/response/error` | `TradingViewV2/messageHandlers/klineDataHandler.ts` | **Q2**:bars 请求是否到达、回包条数、是否抛错 |

---

## 构建 / 迭代流程(`development/scripts/ios-release-build-deploy.sh`)

前置:已 boot 一个 iOS 模拟器;首次需 `fetch-tradingview-assets.mjs` 已 staged 离线资源(`apps/mobile/tradingview-assets/index.html` 存在 ✅)。

### 首次 / native 改动后
```bash
cd apps/mobile   # 或在脚本里用绝对路径
../../development/scripts/ios-release-build-deploy.sh sync-native   # app-modules -> node_modules
../../development/scripts/ios-release-build-deploy.sh pods          # 仅 podspec 依赖变更后需要(本次加了 ReactNativeNativeLogger,需跑一次)
../../development/scripts/ios-release-build-deploy.sh xcode         # 全量 native 构建(慢,增量)
../../development/scripts/ios-release-build-deploy.sh deploy        # 装到模拟器
```

### JS 改动迭代(快,免 xcode)
```bash
../../development/scripts/ios-release-build-deploy.sh build    # 只打 HBC split bundle
../../development/scripts/ios-release-build-deploy.sh deploy
# 或 all = build + deploy
```

### 看日志
```bash
../../development/scripts/ios-release-build-deploy.sh chart-logs        # 最近 200 行 chart 相关
../../development/scripts/ios-release-build-deploy.sh chart-logs tail   # 实时跟随
../../development/scripts/ios-release-build-deploy.sh chart-logs 500    # 最近 500 行
```

### 提速要点
- native 只在改 Swift/podspec 时跑 `xcode`;其余只 `build`+`deploy`(秒级 bundle 替换 + 重签 + 重装,保留 app 数据)。
- `xcode` 已设 `ONLY_ACTIVE_ARCH=YES ARCHS=arm64`、不 clean derivedData → 增量编译。
- `pods` 只需在 podspec 依赖列表变化时跑一次(本次因新增 `ReactNativeNativeLogger` 必须跑一次)。

---

## 复现时重点看的链路

**Q1(prewarm/秒开)**:按时间排
1. `chartPrewarm phase=mount type=perps`(perps 主页)出现了吗?在详情页 `chartHost event=mount` 之前还是之后?
2. `reconcilePooled.CLAIM` 第一次发生在哪个 host?prewarm 还是详情页?
3. `setSource.LOAD` 之后有没有 `nav.didFinish`?若 `setSource.BLOCKED` → bridge 没注册。
4. prewarm host 的 `chartHost event=focus isFocused=false` → 说明被详情页压栈后失去 active。

**Q2(market 无数据)**:
1. `scheme.serve index.html` → 离线页加载成功?有 `scheme.404` 吗?
2. `chartKline phase=request`(symbol/networkId/resolution)有没有发出?
3. `chartKline phase=response points=0` → 后端返回空;`phase=error` → 抓取抛错(看 message)。
4. `msg.in` / `msg.out` 是否有 kline 往返。

---

## 注意
- 计装为 DEBUG 用途,合入主干前需清理(native `ChartWV` 系列 + JS 新增 4 个 logger 方法及调用)。
- Android(Kotlin)侧未计装,本轮聚焦 iOS 模拟器;需要时按相同 tag 镜像到 `PooledChartWebView.kt`。
