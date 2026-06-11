# Performance Scan Rules (perf dimension seed)

Checklist for per-file performance scanning agents. Each scan agent MUST read this file fully before reading its assigned source files.

Distilled from: `1k-performance`, `1k-perf-optimizer`, `react-native-best-practices`, `vercel-react-best-practices` (2026-06).

## Severity framework

- **P0** — 用户可感知:卡顿/冻结/内存泄漏/竞态导致错误数据,或位于冷启动/首页刷新关键路径
- **P1** — 可证明的浪费:多余渲染、重复请求、大数据集上的 O(n²)
- **P2** — 可改进但影响有限

## False-positive guards (MUST read)

- ListView/Tabs/Dialog(forceMount)/Modal navigators/Market views 已内置 `windowSize={5}` 或 `contentVisibility:'hidden'`,不要建议重复优化
- `@onekeyhq/*` 包对外的桶导出是仓库 API 约定,不算违规;桶导入规则只查包内部互引和重三方库整包导入
- 不要建议给简单组件加 `memo`/`useMemo`(文档明确列为反模式);memo 过度使用本身是一类发现
- concurrent-react / reanimated worklet 两类的前提是 New Architecture(RN 0.76+ 默认);发现 legacy Animated/旧 Reanimated API 按类别内指引报告

## Categories

### unbounded-concurrent-requests — 无上限并发请求（Promise.all 风暴） `[OneKey-specific]`

**看什么**: 查找 `items.map(item => fetchData(item))` 后直接 `Promise.all(...)` 的模式，尤其当 items 是动态长度集合（账户列表、网络列表、token 列表）。每个网络请求会产生 6+ 条 RN bridge 消息，15 个并发请求即可让 bridge 饱和、主线程冻结，iOS Watchdog 5 秒后杀进程（AppHang）。正确写法是把任务包成 thunk 数组并用 executeBatched(tasks, 3) 之类的分批执行器限制并发 3~5。重点扫描 kit-bg services 中按 account/network 批量拉数据的代码。出处: .claude/skills/1k-performance/SKILL.md、.claude/skills/1k-performance/references/rules/performance.md (Rule #1, Real-World iOS AppHang 案例)

**严重级别**: P0: 并发数随用户数据规模增长（按账户/网络 map 出请求）且无并发上限，位于启动或首页刷新路径；P1: 并发数固定但 >5 的 Promise.all；P2: 并发 3~5 之间、不在关键路径，仅建议统一改用 executeBatched。

### rn-bridge-overhead — RN bridge 跨越次数与大数据传输

**看什么**: 1) 循环内逐条调用 NativeModules 方法（`items.forEach(item => NativeModules.X.update(...))`），应改为单次 batchUpdate；2) 一次性把大对象（如 10MB JSON）setState/传过 bridge，应分页或懒加载；3) onChangeText 等高频回调内直接调 native/analytics，未做 debounce（lodash debounce 500ms）。bridge 是串行的，一次只能过一条消息，高流量会延迟 UI 更新。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #2)

**严重级别**: P0: 高频事件（每次按键/每帧）直接触发 bridge 调用且无节流；P1: 循环内逐条 native 调用、可明显合并；P2: 偶发的大对象传输，可分页优化。

### heavy-sync-compute-main-thread — 主线程同步重计算（含 BigNumber 循环） `[OneKey-specific]`

**看什么**: 1) render/导航期间同步执行重计算（`const data = processLargeDataset()` 直接在组件体内）；2) 大数组 map 中逐项调用昂贵算法且不分块——正确做法是按 CHUNK_SIZE 分块并在块间 `await new Promise(r => setTimeout(r, 0))` 让出事件循环，或用 InteractionManager.runAfterInteractions 延迟到交互结束（注意 cleanup 要 task.cancel()）；3) OneKey 特有信号：在 token/行情/余额列表循环里反复 `new BigNumber(...)` 做精度运算、或对每项做 fiat 换算/排序比较——bignumber.js 构造和运算远贵于原生 number，属于本规则'循环内昂贵算法'的本仓库典型实例。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #3 Main Thread Protection)；BigNumber 为该规则在 OneKey 代码库的具体化

**严重级别**: P0: 在冷启动/首页刷新/导航动画期间同步跑大数据集计算，可感知卡顿或掉帧；P1: 循环内每项做昂贵运算（BigNumber 链式运算、复杂比较）且数据量可达数百项，无分块/缓存；P2: 数据量小（<50 项）但写法可优化。

### expensive-work-in-render — render 体内未 memo 的昂贵操作

**看什么**: 组件函数体内直接执行 `tokens.sort(...)`、大数组 filter/map/reduce、昂贵比较函数等，每次 render 都重跑。应包进 useMemo 并给正确依赖。注意 `.sort()` 还会原地修改 props 数组（vercel 规则建议 toSorted() 保持不可变）。同时检查每次 render 新建 RegExp（应 hoist 到模块级或 useMemo）。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #4)、.claude/skills/vercel-react-best-practices/rules/js-hoist-regexp.md、rules/js-tosorted-immutable.md

**严重级别**: P0: 昂贵计算位于高频重渲染组件（列表项、输入联动）且数据量大；P1: 明确每次 render 重复执行 >10ms 级别计算；P2: 小数据量的可读性级优化。

### memoization-gaps-and-overuse — memo/useCallback 缺失与过度使用

**看什么**: 缺失侧：重组件未包 memo；传给 memo 子组件的回调是内联箭头函数（每次 render 新引用，使 memo 失效）；传给子组件的内联对象/数组字面量同理（默认值应 hoist 到模块级，见 rerender-memo-with-default-value）。过度侧（反模式，不要建议加）：给只渲染一行 Text 的简单组件加 memo、给廉价表达式加 useMemo 且依赖数组很长（依赖比较本身比计算贵）、对简单原始值表达式用 useMemo。静态 JSX 可 hoist 到模块级复用。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #4, Anti-Patterns #2 #3)、.claude/skills/vercel-react-best-practices/rules/rerender-memo.md、rerender-simple-expression-in-memo.md、rerender-memo-with-default-value.md、rendering-hoist-jsx.md

**严重级别**: P1: 重列表项/重组件接收每次新建的回调或对象导致 memo 失效、可见重渲染浪费；P2: 一般组件的 memo 缺口或轻微过度 memo。不单独报 P0。

### list-virtualization-flashlist — 列表虚拟化：ScrollView/FlatList/FlashList/ListView 选型与配置 `[OneKey-specific]`

**看什么**: 1) `<ScrollView>{items.map(...)}</ScrollView>` 渲染 >20 项——一次性创建全部 view，5000 项可冻结数秒；2) 100+ 项仍用 FlatList 而非 FlashList/ListView；3) FlashList 缺 estimatedItemSize、混合类型缺 getItemType；4) 裸 FlatList 未设 windowSize（默认 21 太大，应 3~5；Android tab 内取 3）；5) key 用数组 index 而非稳定 id；6) renderItem 为内联函数未提取/useCallback；7) 列表项组件未 memo、过重（副作用应移出）。OneKey 特例：`ListView`（@onekeyhq/components）已内置 windowSize={5}，不要建议重复设置，只有需要不同值时才覆盖。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #5)、.claude/skills/react-native-best-practices/references/js-lists-flatlist-flashlist.md

**严重级别**: P0: ScrollView+map 渲染可达数百项的动态列表（交易历史、token 列表、NFT）；P1: 长列表 FlatList 无 windowSize/无 memo 列表项/index 作 key；P2: estimatedItemSize、getItemType、getItemLayout 等调优缺失。

### content-visibility-offscreen — 离屏内容未用 contentVisibility 隐藏（Web） `[OneKey-specific]`

**看什么**: 1) Web 长滚动列表（100+ 项，消息流、交易历史）列表项缺 `content-visibility: auto` + `contain-intrinsic-size`（可带来 10x 首渲提速）；2) 自制 tab 类组件（未用 @onekeyhq/components Tabs）切换时只是条件保留 DOM，未设 `contentVisibility: 'hidden'`；3) 自制折叠面板/显隐区块同理。OneKey 已内置无需处理：Tabs、Dialog(forceMount)、ListView、Modal navigators（createOnBoardingNavigator/createWebModalNavigator）、MarketHomeV2 DesktopLayout——扫描时不要对这些误报。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #5 content-visibility 与 Built-in Optimizations 表)

**严重级别**: P1: 长列表（100+ 项）或重 tab 内容未做离屏隐藏，初次渲染明显变慢；P2: 中等规模可改进项。仅 Web 平台适用（Chrome/Edge 85+, Safari 16.4+），RN 用列表虚拟化代替。

### effect-cleanup-memory-leaks — useEffect 清理缺失与内存泄漏

**看什么**: 1) useEffect 内 addListener/addEventListener/EventEmitter 订阅（含 OneKey 的事件总线订阅）无 return 清理——RN 最常见泄漏源；2) setInterval/setTimeout 未在 cleanup 中 clearInterval/clearTimeout；3) 闭包捕获大对象（应先提取需要的原始值再放入闭包）；4) 模块级数组/Map 只增不减（无界缓存、回调注册表无注销）；5) InteractionManager task 未 cancel。另注意全局快捷键/scroll 监听类 hook：N 个实例注册 N 个 window listener，应去重为单监听器分发。出处: .claude/skills/react-native-best-practices/references/js-memory-leaks.md、.claude/skills/vercel-react-best-practices/rules/client-event-listeners.md、.claude/skills/1k-performance/references/rules/performance.md (InteractionManager 示例)

**严重级别**: P0: 确认的泄漏——订阅/定时器在反复挂载卸载的组件（页面、列表项、modal）中无清理，或模块级集合无界增长；P1: 清理存在但条件分支下可能漏掉，闭包持有大对象；P2: 全局监听器可去重等优化。

### stale-async-race-conditions — 异步竞态：过期请求结果覆盖新结果

**看什么**: useEffect 中 `search(query).then(setResults)` 这类模式：query 快速变化时旧请求可能后到并覆盖新结果。应使用 AbortController（cleanup 中 controller.abort()，catch 中放行 AbortError）或本地 cancelled 标志。重点看搜索框、swap 报价轮询、token 选择器等输入驱动请求的地方。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #8 Cancellation for Stale Requests)

**严重级别**: P0: 涉及金额/报价/余额显示的竞态（用户看到错误数据）；P1: 搜索/列表类竞态导致 UI 闪错但可自愈；P2: 理论竞态、触发窗口极小。

### sequential-await-waterfalls — 串行 await 瀑布（可并行未并行）

**看什么**: 相互独立的异步调用逐个 await（`const a = await fA(); const b = await fB();`），总耗时为各项之和；应 Promise.all 并行（注意与 unbounded-concurrent-requests 规则平衡：固定 2~5 个独立请求可并行，动态大批量要限流）。另两种变体：await 提前发生在不需要结果的分支之前（应把 await 移入实际使用的分支，先拿 promise 后到点再 await）；部分依赖场景可先启动不依赖的 promise。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #8 Parallel vs Sequential)、.claude/skills/vercel-react-best-practices/rules 中 async-parallel / async-defer-await / async-dependencies（SKILL.md 索引）

**严重级别**: P0: 冷启动/首屏关键路径上的串行网络瀑布，叠加延迟用户可感知；P1: 非关键路径但明显可并行的 2+ 个独立请求；P2: 耗时极短的本地异步串行。

### derived-state-in-effect — 派生状态存进 state / 用 effect 同步

**看什么**: 1) `useState(props.x)` + `useEffect(() => setX(props.x), [props.x])` 镜像 props——多一次 render 且易状态漂移，应直接用 props 或 render 期间派生；2) 能由现有 state/props 算出的值（fullName = first + last）存入独立 state 并用 effect 维护；3) 交互逻辑放在 effect 里响应 state 变化，应直接放进事件处理函数（rerender-move-effect-to-event）。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #6 Avoid Derived State)、.claude/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md、rules/rerender-move-effect-to-event.md（索引）

**严重级别**: P1: effect 链式 setState 造成多余渲染轮次或状态漂移 bug 风险；P2: 简单镜像 state 的清理性优化。

### state-update-batching-shape — 状态更新批量化与函数式 setState

**看什么**: 1) 同一处理函数里连续多个 setX/setY/setZ 更新强相关数据——React 18 事件处理器内会自动批处理，但相关数据建议合并为单个 state 对象一次更新；2) setState 依赖旧值却直接闭包读取（`setCount(count + 1)`）而非函数式 `setCount(c => c + 1)`，导致回调无法保持稳定引用、useCallback 依赖膨胀。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #6 Batch State Updates)、.claude/skills/react-native-best-practices/references/js-concurrent-react.md (Automatic Batching)、.claude/skills/vercel-react-best-practices/rules 中 rerender-functional-setstate（索引）

**严重级别**: P1: 在 setTimeout/异步回调（React 17 行为差异处）或循环中多次离散 setState 造成多次渲染；P2: 风格层面的合并与函数式 setState 改造。

### jotai-atom-granularity — Jotai atom 订阅粒度与派生 atom `[OneKey-specific]`

**看什么**: OneKey 全局状态用 jotai（globalAtom/contextAtom 封装）。检查：1) 组件用 useAtom 订阅大聚合 atom 但只用其中一两个字段——任何字段变化都重渲染，应拆细 atom 或订阅派生 atom；2) 只写不读的组件用 useAtom 而非 useSetAtom（白白订阅触发重渲染）；3) 由多个 atom 计算的值在组件内手算且无 memo，应改为派生 atom `atom((get) => ...)` 内置缓存；4) 用 React Context 装频繁变化的 app 状态（所有 consumer 全量重渲染），应迁移 atom；5) 反向反模式：过度原子化，琐碎变量各建 atom，相关状态应分组。出处: .claude/skills/react-native-best-practices/references/js-atomic-state.md（jotai 模式与 pitfalls；OneKey 落地对应 globalAtom/contextAtom 体系）

**严重级别**: P0: 高频更新的全局 atom（行情价格、余额轮询）被大量组件整体订阅造成全页重渲染；P1: useAtom 应为 useSetAtom/useAtomValue、缺派生 atom 的明确浪费；P2: atom 拆分粒度调整建议。

### controlled-textinput-keystroke — 受控 TextInput 按键往返与输入卡顿

**看什么**: `<TextInput value={text} onChangeText={setText} />` 受控模式：每个字符都要 native→JS→native 往返，旧架构下快速输入会闪烁/丢字，低端机输入延迟。简单输入/搜索/提交时校验的表单应改非受控：`defaultValue` + onChangeText 记录，需要程控时用 ref.clear()。例外（保持受控合理）：输入掩码（电话/卡号）、逐字符校验。若输入驱动昂贵列表渲染，配合 useDeferredValue（见 concurrent-react-deferral）。出处: .claude/skills/react-native-best-practices/references/js-uncontrolled-components.md

**严重级别**: P0: 搜索输入直接驱动大列表同步过滤且受控，实测可致打字卡顿；P1: 普通受控输入在性能敏感页（发送金额、搜索）；P2: 一般表单的模式统一。

### concurrent-react-deferral — 缺少 useDeferredValue/useTransition/startTransition 的昂贵更新

**看什么**: 快速变化的值（搜索词、滑块、行情 tick）直接传给昂贵子树：`<ExpensiveList query={query} />` 阻塞每次按键。应 `useDeferredValue(query)` 传入（子组件必须同时 memo，否则父级重渲染照样穿透——最常见误用）；多状态更新里非紧急部分用 startTransition 包裹，需要 pending 指示用 useTransition 的 isPending。注意：这些 hook 不让计算变快，只调整优先级；廉价更新别套（过度使用反模式）；RN 端需 New Architecture（Fabric，RN 0.76+ 默认）。出处: .claude/skills/react-native-best-practices/references/js-concurrent-react.md、.claude/skills/vercel-react-best-practices/rules 中 rerender-use-deferred-value / rerender-transitions / rendering-usetransition-loading（索引）

**严重级别**: P1: 输入/高频值直接驱动可证明昂贵的渲染（大列表过滤、图表重算）；P2: 中等成本场景的可改进项。误用（deferred 但子组件没 memo）按 P1 报。

### reanimated-worklet-hygiene — 动画线程选择与 worklet 卫生

**看什么**: 1) 用旧 Animated API（`new Animated.Value` + Animated.timing）跑视觉动画——在 JS 线程执行，重 JS 工作时掉帧；应用 reanimated 的 useSharedValue + useAnimatedStyle + withTiming（UI 线程）；2) useAnimatedStyle worklet 内做重计算（阻塞 UI 线程，worklet 必须只读 value 快速返回）；3) worklet 内访问 React state 而非 sharedValue；4) 忘记用 Animated.View/Animated.Text 承载动画样式；5) 从 worklet 回调 JS 应走 scheduleOnRN（v4）/runOnJS（v3），且不应每帧高频触发。注意 Reanimated 4 需 New Architecture（Fabric+TurboModules）。出处: .claude/skills/react-native-best-practices/references/js-animations-reanimated.md

**严重级别**: P0: 转账/导航等关键交互动画跑在 JS 线程且伴随重 JS 工作（确定掉帧），或 worklet 内重计算阻塞 UI 线程；P1: 新代码仍用 JS 线程 Animated 做持续动画；P2: API 迁移类建议。

### barrel-imports-bundle — 桶文件导入与重依赖顶层加载（bundle/TTI）

**看什么**: 1) 从 index.ts 桶文件导入单个符号（`import { X } from './components'`）——Metro 会打包并在启动时求值桶内全部模块，拖慢 TTI 且易引入 require cycle（留意 Metro 'Require cycle' 警告对应代码）；内部代码应直接路径导入，对外 API 桶可保留；2) 库级整包导入：`import { format } from 'date-fns'` 应改子路径导入，lodash 同理；3) 仅在某功能激活才用的重模块在顶层 import，应改为动态/条件加载；分析/日志类第三方应延迟加载。注意：@onekeyhq/components 等包对外桶导出是仓库约定 API，重点查包内部互相走桶、以及明显的重库整包导入。出处: .claude/skills/react-native-best-practices/references/bundle-barrel-exports.md、.claude/skills/vercel-react-best-practices/rules 中 bundle-barrel-imports / bundle-conditional / bundle-defer-third-party / bundle-dynamic-imports（索引）

**严重级别**: P1: 引发 require cycle 的桶导入、重库（图表/加密/日期）整包导入进首屏 bundle；P2: 一般直连导入改造、可延迟的三方模块。

### lazy-state-initialization — useState 初始化未用惰性函数形式

**看什么**: `useState(buildSearchIndex(items))`、`useState(JSON.parse(localStorage.getItem('settings') || '{}'))` 这类把昂贵调用直接写在 useState 参数位——初始化器每次 render 都执行（虽只用一次）。应改为 `useState(() => expensive())`。识别特征：useState 实参是函数调用表达式且该函数涉及解析/构建索引/同步存储读取。相关：localStorage/sessionStorage 重复同步读取应缓存（js-cache-storage）。出处: .claude/skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md、rules 中 js-cache-storage（索引）

**严重级别**: P1: 高频重渲染组件中初始化器涉及 JSON.parse/大数据构建；P2: 低频组件中的同类写法。

### inline-component-definitions — 组件内部定义组件（每次 render 重挂载）

**看什么**: 在组件函数体内 `const Inner = () => (...)` 然后 `<Inner />` 渲染——每次 render 产生新的组件类型，React 视为不同组件而整树卸载重挂，销毁全部 state/DOM/native view（常见动机是想闭包访问父变量，应改传 props 提到模块级）。注意与'渲染函数'区分：`renderItem` 这类以普通函数调用 `{renderX()}` 使用的不算重挂载，但若以 `<RenderX />` JSX 形式使用则命中。出处: .claude/skills/vercel-react-best-practices/rules/rerender-no-inline-components.md

**严重级别**: P0: 内联组件包含输入框/列表/动画等有状态内容，重挂载导致丢焦点丢状态、可见闪烁；P1: 内联组件子树较重，重复挂载明确浪费；P2: 极轻量内联组件。

### js-hot-loop-micropatterns — JS 热路径微模式（重复遍历/O(n²) 查找/循环内分配）

**看什么**: 数据处理工具函数与 service 层热路径：1) 对同一数组连续多次 .filter()/.map() 链——可合并为单循环（js-combine-iterations）；2) `array.includes`/`find` 出现在另一数组的 filter/map 内形成 O(n²)——改 Set/Map O(1) 查找（js-set-map-lookups），重复按 id 查找先建索引 Map（js-index-maps）；3) 循环体内 new RegExp、重复属性链访问（a.b.c.d）应提出循环（js-hoist-regexp/js-cache-property-access）；4) 用 sort 取最值应改单循环 min/max（js-min-max-loop）；5) 函数应尽早 return 跳过昂贵分支（js-early-exit）；6) 纯函数重复入参可用模块级 Map 缓存结果（js-cache-function-results）。在 OneKey 中这些常与 token 列表/历史记录处理叠加 BigNumber（见 heavy-sync-compute）放大。出处: .claude/skills/vercel-react-best-practices/rules/js-combine-iterations.md、js-set-map-lookups.md、js-hoist-regexp.md 及 SKILL.md 索引的 js-index-maps / js-cache-property-access / js-min-max-loop / js-early-exit / js-cache-function-results / js-flatmap-filter

**严重级别**: P1: O(n²) 模式作用于可达数百/上千项的数据（多账户 token、交易历史）；P2: 小数据集上的多次遍历、循环内分配等明确但影响小的浪费。一般不单独构成 P0，除非位于每次渲染/每次轮询都执行的热路径且数据量大。

### effect-deps-and-subscription-breadth — effect 依赖过宽与不必要的状态订阅

**看什么**: 1) useEffect 依赖整个对象 `[user]` 但体内只用 `user.id`——应收窄为原始值依赖；连续值（width）驱动布尔逻辑应先派生 `const isMobile = width < 768` 再依赖布尔，避免每像素触发；2) 组件订阅了只在回调里用的动态状态（searchParams/storage/atom），渲染期不需要——应在回调内按需读取，不建立订阅（rerender-defer-reads）；3) 高频瞬态值（手势位置、滚动偏移、临时 flag）放 useState 导致每次更新重渲染——不参与渲染的改 useRef（rerender-use-ref-transient-values）；4) 一个自定义 hook 聚合多个独立数据源、任一变化全部消费者重渲染——应拆分（rerender-split-combined-hooks）。出处: .claude/skills/vercel-react-best-practices/rules/rerender-dependencies.md、rerender-defer-reads.md、rerender-use-ref-transient-values.md 及 SKILL.md 索引的 rerender-split-combined-hooks

**严重级别**: P0: 高频值（滚动/手势/价格 tick）经 useState 驱动每帧重渲染造成可感知卡顿；P1: 宽依赖导致 effect 反复执行副作用（重新订阅、重新请求）；P2: 订阅收窄类清理。

### startup-critical-path-redundancy — 冷启动/首页刷新关键路径上的重复与冗余调用 `[OneKey-specific]`

**看什么**: OneKey perf-ci 的核心指标是 tokensStartMs/tokensSpanMs/functionCallCount（Home tokens 刷新关键路径）。静态扫描对应特征：1) 同一数据在一次启动/刷新流程中被多处重复请求或重复计算（derive-session 的 repeatedCalls/thrashing 模式）——应缓存结果、去重 in-flight 请求；2) 启动路径上做了首屏不需要的工作（可延后到交互后/懒初始化）；3) 不必要的对象分配与可删的冗余逻辑（reduce allocations / remove redundant work）；4) 同一 effect/服务方法被多个触发源反复调起（事件+轮询+焦点各触发一次）。修复建议保持单点小改动、不破坏功能。出处: .claude/skills/1k-perf-optimizer/SKILL.md（Key Metrics、Step 2.2 slowFunctions/repeatedCalls/jsblock、Step 2.4 change types、Important Notes #6 critical path）

**严重级别**: P0: 关键路径（启动→Home tokens 刷新）上的重复网络请求/重复全量计算直接推迟 tokensStartMs/tokensSpanMs；P1: 同流程内可证明的重复调用、可缓存未缓存；P2: 函数调用数层面的小幅冗余（对应 MINOR_IMPROVEMENT 档：调用数可降 ≥20%）。

### image-sizing-optimization — 图片未约束尺寸/未用优化 Image 组件 `[OneKey-specific]`

**看什么**: 1) `<Image source={{ uri }} />` 无 width/height/style 尺寸约束——解码与布局成本不可控；应显式指定尺寸 + resizeMode；2) 直接用 react-native 的 Image 渲染远程图（token logo、NFT 图等）而非 @onekeyhq/components 的 Image（内置优化与缓存）。列表中的图片尤其要查（与 list-virtualization 叠加）。出处: .claude/skills/1k-performance/references/rules/performance.md (Rule #7 Image Optimization)

**严重级别**: P1: 长列表项内无尺寸约束的远程大图（内存峰值与滚动掉帧）；P2: 一般场景未用统一 Image 组件。

