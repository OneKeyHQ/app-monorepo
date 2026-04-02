# 性能防劣化测试指南

本文档是自动化性能防劣化系统的综合指南。该系统以**定时方式**运行（默认每天 3 次或通过 daemon 每 6 小时一次），通过 Detox E2E 测试在 iOS 和 Android 上采集性能数据，将指标与已建立的基线进行对比，当检测到劣化时通过 Slack 向团队发出告警。

## 目录

- [系统架构](#系统架构)
  - [设计理念](#设计理念)
  - [整体架构](#整体架构)
  - [数据采集流水线](#数据采集流水线)
  - [自动化调度](#自动化调度)
  - [基线与阈值管理](#基线与阈值管理)
  - [劣化检测策略](#劣化检测策略)
  - [告警与通知](#告警与通知)
- [行业最佳实践与参考](#行业最佳实践与参考)
- [全局指标（所有页面）](#全局指标所有页面)
- [滚动帧率监控](#滚动帧率监控)
  - [帧率采集机制](#帧率采集机制)
  - [可滚动组件清单](#可滚动组件清单)
  - [各页面滚动帧率要求](#各页面滚动帧率要求)
- [平台图例](#平台图例)
- [页面与指标](#页面与指标)
  - [1. 应用冷启动](#1-应用冷启动)
    - [各平台冷启动性能约束](#各平台冷启动性能约束)
  - [2. 首页 / 钱包总览](#2-首页--钱包总览)
  - [3. Token 详情](#3-token-详情)
  - [4. 发送交易流程](#4-发送交易流程)
  - [5. 收款页面](#5-收款页面)
  - [6. 兑换（Swap）](#6-兑换swap)
  - [7. 行情总览](#7-行情总览)
  - [8. 行情详情](#8-行情详情)
  - [9. 发现 / DApp 浏览器](#9-发现--dapp-浏览器)
  - [10. 理财 / DeFi 总览](#10-理财--defi-总览)
  - [11. 质押详情](#11-质押详情)
  - [12. 设置](#12-设置)
  - [13. 账户管理 / 钱包选择器](#13-账户管理--钱包选择器)
  - [14. 引导流程（创建 / 导入钱包）](#14-引导流程创建--导入钱包)
  - [15. DApp 连接授权](#15-dapp-连接授权)
  - [16. 交易历史](#16-交易历史)
- [当前阈值基线](#当前阈值基线)
- [指标模板（新增页面时使用）](#指标模板新增页面时使用)
- [运行系统](#运行系统)
  - [自动化（定时）](#自动化定时)
  - [手动（临时）](#手动临时)
  - [仪表盘与 CLI 分析](#仪表盘与-cli-分析)
- [附录：perfMark 命名规范](#附录perfmark-命名规范)
- [参考资料](#参考资料)

---

## 系统架构

### 设计理念

性能防劣化（Performance Regression Prevention）是一套**主动防御**系统。不是等用户反馈卡顿才处理，而是在专用测试机上持续测量应用性能，在劣化**进入生产环境之前**就将其捕获。

核心原则：

1. **定时自动化** — 日常检查无需人工介入
2. **统计严谨** — 每个场景运行多次（默认 3 次），取中位数减少噪声
3. **基线对比** — 仅当指标超过已建立的阈值（基线 + 容差）时才告警
4. **多维度** — 同时追踪时序（marks）、吞吐量（函数调用）、帧率（FPS）、内存和主线程阻塞（JS blocks）
5. **平台一致** — iOS / Android / Extension / Web / Desktop 使用相同的测试场景
6. **快速反馈** — 劣化时 Slack 告警；任务报告保留用于排查

### 整体架构

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           性能防劣化系统                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐   │
│  │   调度器     │     │  Detox E2E 测试  │     │   Performance Server  │   │
│  │  (launchd / │────▶│ (每次任务3轮运行) │────▶│  (WebSocket :9527)    │   │
│  │   daemon)   │     │                  │     │                       │   │
│  └─────────────┘     └──────────────────┘     └───────────┬───────────┘   │
│                                                           │               │
│                              ┌─────────────────────────────┘               │
│                              ▼                                             │
│                    ┌──────────────────┐                                    │
│                    │   会话存储        │                                    │
│                    │  ~/perf-sessions/ │                                   │
│                    │  (JSONL 文件)     │                                   │
│                    └────────┬─────────┘                                    │
│                             │                                              │
│              ┌──────────────┼──────────────┐                               │
│              ▼              ▼              ▼                               │
│    ┌──────────────┐ ┌────────────┐ ┌────────────────┐                     │
│    │ derive-session│ │  阈值比较   │ │ Slack Webhook  │                     │
│    │ (CLI 分析)    │ │ (中位数 vs │ │  (劣化时告警)   │                     │
│    └──────────────┘ │   基线)    │ └────────────────┘                     │
│                     └────────────┘                                        │
│                                                                            │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │  Web 仪表盘 (http://localhost:9527)                              │    │
│    │  - 时间线火焰图          - 慢函数表                               │    │
│    │  - FPS 迷你图            - 重复调用分析                           │    │
│    │  - 内存迷你图            - 关键 mark 时间线                       │    │
│    │  - 低帧率热点            - 首页刷新分析                           │    │
│    │  - JS 阻塞事件           - Speedscope 导出                       │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 数据采集流水线

每次任务运行遵循以下流程：

```
1. 缓存清理（Metro 缓存、watchman）
       │
2. Performance Server 健康检查（如需则自动启动）
       │
3. Detox 构建（为模拟器/虚拟机编译应用）
       │
4. Detox 测试循环（默认 N = 3 轮）：
       │
       ├── 第 1 轮：启动应用 → 等待 mark → 采集会话 → 关闭应用
       ├── 第 2 轮：启动应用 → 等待 mark → 采集会话 → 关闭应用
       └── 第 3 轮：启动应用 → 等待 mark → 采集会话 → 关闭应用
       │
5. 对每个会话：derive-session.js → 计算衍生指标
       │
6. 聚合：median(tokensStartMs)、median(tokensSpanMs)、median(functionCallCount)
       │
7. 将聚合值与阈值对比
       │
8. 生成 report.json + job-result.json
       │
9. 如检测到劣化：发送 Slack Webhook 通知
```

**每个会话采集的内容：**

| 事件类型 | 文件 | 内容 |
|---------|------|------|
| 函数调用 | `function_call.log` | 每次函数调用：函数名、文件、行号、耗时、模块、调用栈 |
| 性能标记 | `mark.log` | 命名检查点：`app:start`、`Home:refresh:*`、`AllNet:*` 等 |
| FPS 采样 | `fps.log` | 每 100ms 通过 requestAnimationFrame 测量帧率 |
| 内存采样 | `memory.log` | JS 堆（heapUsed、heapTotal、RSS）定期采样 |
| 模块加载 | `module_load.log` | 模块加载事件及耗时 |
| JS 阻塞 | 嵌入 `mark.log` | 主线程阻塞事件（`jsblock:*`），通过 50ms 间隔定时器检测 |
| 所有事件 | `all.log` | 所有事件类型的合并流 |
| 会话元数据 | `meta.json` | 平台、开始时间、事件计数、关键 marks |

### 自动化调度

系统支持三种调度模式：

#### 模式 1：launchd（macOS，推荐用于专用测试机）

预配置的 plist 模板位于 `development/perf-ci/launchd/`：

- **`perf-server.plist`** — 保持 Performance Server 永久运行（`KeepAlive: true`、`RunAtLoad: true`）
- **`ios-perf-job.plist`** — 每天在 **09:00、14:00、19:00** 运行性能任务

```bash
# 安装（一次性配置）
cp development/perf-ci/launchd/perf-server.plist \
  "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
cp development/perf-ci/launchd/ios-perf-job.plist \
  "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"

# 编辑：替换两个文件中的 __REPO_ROOT__ 和 __HOME_DIR__

# 加载
UID="$(id -u)"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
```

#### 模式 2：Daemon 进程（跨平台）

持续运行，按固定间隔执行任务（默认 6 小时）：

```bash
# iOS release，每 5 小时
yarn perf:ios:release:daemon --interval-minutes 300

# Android release，每 6 小时（默认）
yarn perf:android:release:daemon
```

Daemon 特性：
- 以无头模式运行（无模拟器 UI）
- 自动管理 perf-server 生命周期
- 单次任务失败后继续运行（进入下一个间隔）
- 响应 SIGINT/SIGTERM 优雅关闭

#### 模式 3：CI/CD 流水线集成（未来）

可集成到 GitHub Actions 或其他 CI 系统：

```bash
# 在 CI 工作流中
yarn perf:ios:release
# 退出码：0 = 正常, 3 = 检测到劣化, 2 = 错误
```

### 基线与阈值管理

阈值以 JSON 文件形式存储在 `development/perf-ci/thresholds/`：

| 文件 | 平台 | 构建模式 |
|------|------|---------|
| `ios.release.json` | iOS 模拟器 | Release（无 Metro） |
| `ios.debug.json` | iOS 模拟器 | Debug（有 Metro） |
| `android.release.json` | Android 虚拟机 | Release |
| `android.debug.json` | Android 虚拟机 | Debug |

**阈值结构：**

```json
{
  "_comment": "阈值说明",
  "_baseline_note": "来源会话 + 应用的容差",
  "tokensStartMs": 3948,
  "tokensSpanMs": 2550,
  "functionCallCount": 671,
  "strategy": "median"
}
```

**如何建立新基线：**

1. 在稳定分支（如 `x`）上运行 3 次以上性能任务
2. 取每个指标的中位数
3. 应用 +10% 容差缓冲
4. 写入对应的阈值文件
5. 提交到仓库

**何时更新基线：**

- 在有意的性能优化之后（降低阈值）
- 在预期的性能变化之后（例如新增功能合理增加了函数调用）
- 测试机硬件更换时定期重新校准

### 劣化检测策略

支持两种策略：

#### 策略：`median`（默认）

```
对每个指标：
  如果 median(run1, run2, run3) > threshold → 劣化
```

适用于稳定环境。中位数天然过滤异常值（3 次中 1 次偏差会被忽略）。

#### 策略：`two_of_three`

```
对每个指标：
  如果 count(超过阈值的运行次数) >= 2 → 劣化
```

更敏感 — 3 次中有 2 次超过阈值即标记为劣化。适用于需要更早检测但可接受偶尔误报的场景。

**为什么需要多轮运行：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| 单次运行 | 快速 | 噪声大：GC 暂停、后台进程可能导致误报 |
| 3 次运行 + 中位数 | 平衡 | 业界标准方案，已被 Callstack Reassure、Meta 验证 |
| 5 次以上 + p95 | 最精确 | 慢，资源消耗大 |

### 告警与通知

检测到劣化时，系统发送 Slack 消息：

```
REGRESSION: iOS release Perf Regression Guard
commit: abc123def
time: 2025-01-15T09:00:00Z
output: development/perf-ci/output/ios-release-20250115-090000

runs:
#0 session=perf-xxx start=3200ms span=2800ms functionCalls=750
#1 session=perf-yyy start=3100ms span=2700ms functionCalls=740
#2 session=perf-zzz start=3300ms span=2900ms functionCalls=760

median: start=3200ms span=2800ms functionCalls=750
thresholds: start=3948ms span=2550ms functionCalls=671 (strategy=median)
```

告警规则：
- **检测到劣化** → 发送 Slack 告警
- **任务失败**（Detox 崩溃、服务器宕机等） → 发送 Slack 告警
- **正常（无劣化）** → 不发送告警（静默成功）

---

## 行业最佳实践与参考

我们的系统设计借鉴了各大技术公司的成熟方案。以下是影响我们设计决策的行业实践总结。

### 性能防劣化金字塔

```
                    ┌─────────────────┐
                    │   生产环境       │  ← Sentry、APM、真实用户监控
                    │   监控          │     （最后一道防线）
                    ├─────────────────┤
                    │   定时          │  ← 本系统
                    │   劣化          │     Detox + perf-server + 阈值
                    │   防护          │     （发版前捕获）
                    ├─────────────────┤
                    │   PR/CI         │  ← 每个 PR 的性能检查
                    │   性能          │     （合并前捕获）
                    │   检查          │
                    ├─────────────────┤
                    │   开发者         │  ← 性能仪表盘、Profiling
                    │   工具          │     （开发过程中捕获）
                    └─────────────────┘
```

### 行业关键经验

**1. 基线 + 容差模型（Meta、ByteDance、美团采用）**

从稳定构建建立基线指标，当新构建偏差超过容差阈值时告警。ByteDance 抖音团队将此应用于启动时间、FPS、内存和 ANR 率。美团 Hertz 系统在开发/测试/生产阶段监控 FPS、CPU、内存、卡顿和页面加载时间。

**2. 统计聚合降低噪声（Callstack Reassure 采用）**

Reassure 是 Callstack 开源的 React Native 性能测试工具，运行场景多次并应用统计分析来判断变化是否显著。他们建议先检查机器稳定性 — 随机波动应低于 5%，10% 以上表示测试环境噪声太大。

**3. 多轮运行取中位数策略**

运行 3 次取中位数是过滤 GC 暂停、后台进程干扰和其他瞬态噪声的成熟技术。比单次测量更可靠，同时在 CI 时间预算内可行。

**4. Trace Diff 用于根因分析**

ByteDance 为 HarmonyOS 开发了 Trace Diff 方案，将静态代码变更与动态性能 trace 差异关联，将劣化定位到特定的函数级变更。我们的 `derive-session.js` 提供了类似的函数级热点分析。

**5. 分层监控（美团 Hertz 采用）**

美团移动端性能监控覆盖三个阶段：
- **开发阶段**：集成到 App 内的离线检测工具，以浮层形式展示 FPS/CPU/内存
- **测试阶段**：结合测试工具生成性能报告
- **生产阶段**：真实用户数据上报的监控平台

我们的系统覆盖前两个阶段，Sentry 作为生产环境监控层。

**6. 动态基线（Apache SkyWalking）**

高级系统使用基于历史数据趋势自动调整的动态基线，而非静态阈值。这减少了季节性模式带来的误报。我们的系统目前使用手动重新校准的静态阈值，但可以演进为动态基线。

**7. Shopify React Native 性能分析器**

Shopify 贡献了 `react-native-performance`，用于测量不同应用流程的渲染时间，以及导航和列表性能的专用库。这与我们的函数调用级插桩方案一致。

### 能力对比

| 能力 | 我们的系统 | Reassure | Meta（内部） | ByteDance（抖音） |
|------|:---:|:---:|:---:|:---:|
| 自动定时运行 | 是（launchd/daemon） | 仅 CI | CI + 定时 | CI + 定时 |
| E2E 测试（真实应用） | 是（Detox） | 否（组件级） | 是 | 是 |
| 函数级性能分析 | 是（Babel 插件） | 否 | 是 | 是 |
| FPS 监控 | 是（rAF） | 否 | 是 | 是 |
| 内存监控 | 是 | 否 | 是 | 是 |
| JS 阻塞检测 | 是 | 否 | N/A | 是 |
| 基于 Mark 的计时 | 是 | 否 | 是 | 是 |
| 多轮聚合 | 是（3 轮，中位数） | 是（可配置） | 是 | 是 |
| Slack/Webhook 告警 | 是 | GitHub PR 评论 | 内部 | 内部 |
| Web 仪表盘 | 是 | Markdown 报告 | 内部 | 内部 |
| Speedscope 导出 | 是 | 否 | 内部 | 内部 |

---

## 全局指标（所有页面）

以下指标适用于每个页面，应在每次测试会话中检查：

| 指标 | 说明 | 采集方式 | 劣化阈值 |
|------|------|---------|---------|
| **FPS** | 页面交互期间的帧率 | `fps.log`（100ms 采样间隔） | 任何窗口 FPS < 30 持续 > 500ms |
| **滚动 FPS** | 列表/内容滚动期间的帧率 | `fps.log` 结合滚动 marks | 见[滚动帧率监控](#滚动帧率监控) |
| **JS 阻塞** | 主线程阻塞事件 | `jsblock:*` marks（50ms 检查间隔，200ms 上报阈值） | 任何阻塞 > 200ms |
| **内存（堆）** | JS 堆使用量 | `memory.log` | 同操作后堆增长 > 20% vs 基线 |
| **函数调用数** | 总函数调用次数 | `function_call.log` 行数 | 同场景 > 15% 增加 vs 基线 |
| **慢函数（p95）** | p95 耗时 > 16ms（一帧预算）的函数 | `/api/sessions/:id/slow-functions` | top-50 中出现新函数，或已有函数 p95 增加 > 25% |
| **高频重复调用** | 100ms 窗口内同一函数被多次调用 | `/api/sessions/:id/repeated-calls?mode=rapid` | 出现新的重复调用模式 |
| **Storage I/O** | AsyncStorage 读写操作 | `storage:*` marks | 总耗时增加 > 30% |
| **SimpleDB I/O** | SimpleDB CRUD 操作 | `simpledb:*` marks | 总耗时增加 > 30% |
| **页面导航转场 FPS** | 任何页面导航动画期间的帧率（250ms 模态动画） | 转场期间的 FPS 采样 | 低于 40 fps |
| **弹窗动画 FPS** | 任何弹窗打开/关闭动画期间的帧率（300ms） | 动画期间的 FPS 采样 | 低于 40 fps |
| **Toast 出现时间** | 从触发到 Toast 在屏幕上可见的时间 | 交互计时 | > 200ms |
| **图片加载（缓存）** | 从渲染到缓存图片可见的时间 | 交互计时 | > 100ms |
| **剪贴板复制 → Toast** | 从复制操作到确认 Toast 的时间 | 交互计时 | > 500ms |

---

## 滚动帧率监控

滚动性能是用户最容易感知的性能指标之一。滚动卡顿直接影响用户体验和应用品质感知。

### 帧率采集机制

FPS 采集器（`packages/shared/src/performance/collectors/fpsCollector.ts`）使用 `requestAnimationFrame` 测量帧率：

- **采样间隔**：每 100ms，采集器上报当前 FPS
- **计算公式**：`fps = Math.round((frameCount * 1000) / elapsed)`
- **目标帧率**：60 FPS（每帧 16.67ms 预算）
- **最大上限**：240 FPS（过滤不可靠的测量值）
- **丢帧数**：`dropped = max(0, 60 - fps)`

**FPS 数据流：**

```
requestAnimationFrame 循环（100ms 间隔）
    │
    ▼
__perfReportFPS({ fps, dropped })
    │
    ▼
WebSocket → Performance Server
    │
    ▼
fps.log（JSONL，每会话）
    │
    ▼
仪表盘迷你图 + 低帧率热点分析
```

### 可滚动组件清单

所有包含可滚动元素的页面及其底层滚动组件：

| 页面 | 可滚动元素 | 组件 | 库 |
|------|-----------|------|---|
| **首页（Token 列表）** | Token/资产列表 | `Tabs.FlatList` via `TokenListView` → `ListView` | FlashList (native) / FlatList (web) |
| **首页（NFT 网格）** | NFT 网格 | `Tabs.FlatList` via `NFTListView` | FlashList，多列 |
| **首页（历史）** | 交易历史 | `Tabs.SectionList` via `TxHistoryListView` | SectionList 带日期分组头 |
| **首页（授权）** | 授权列表 | `Tabs.FlatList` | FlashList |
| **首页（容器）** | 可折叠头部 + 标签页 | `Tabs.Container` | react-native-collapsible-tab-view |
| **Token 详情** | 详情标签页（历史/持有者） | `Tabs`（CollapsibleTabView） | react-native-collapsible-tab-view |
| **行情总览** | Token 价格列表 | `FlatList` via `MobileMarketTokenFlatList` | FlatList 带分页（20条/页） |
| **行情详情** | 详情内容 | ScrollView + Chart | TradingView + ScrollView |
| **Swap Token 选择器** | 带搜索的 Token 列表 | `ListView` | FlashList |
| **发现 DApp 列表** | DApp 目录 | `ListView` | FlashList |
| **发现浏览器** | WebView 内容 | WebView 内部滚动 | 平台 WebView |
| **理财协议列表** | 协议卡片 | `ListView` | FlashList |
| **质押详情** | 协议信息 | ScrollView | ScrollView |
| **设置** | 设置列表 | `ListView` | FlashList |
| **账户选择器** | 账户/钱包列表 | `SortableSectionList` | react-beautiful-dnd / react-native-draggable-flatlist |
| **链选择器** | 链列表 | `SectionList` with `useFlashList` | FlashList |
| **地址簿** | 地址列表 | `SectionList` | SectionList |
| **通知** | 通知列表 | `ListView` | FlashList |
| **Swap 历史** | Swap 交易历史 | `ListView` | FlashList |
| **全局搜索** | 搜索结果 | `ListView` | FlashList |

### 各页面滚动帧率要求

**移动端（React Native）目标：**

| 滚动场景 | 最低 FPS | 丢帧阈值 | 备注 |
|---------|:--------:|:-------:|------|
| Token 列表快速滚动 | >= 50 fps | <= 10 丢帧/秒 | FlashList，`windowSize=5` |
| Token 列表慢速滚动 | >= 55 fps | <= 5 丢帧/秒 | 正常浏览速度 |
| NFT 网格滚动 | >= 45 fps | <= 15 丢帧/秒 | 多列网格更重 |
| 交易历史滚动 | >= 50 fps | <= 10 丢帧/秒 | SectionList 带日期分组头 |
| 行情 Token 列表滚动 | >= 50 fps | <= 10 丢帧/秒 | FlatList 带迷你图 |
| 可折叠头部收起/展开 | >= 50 fps | <= 10 丢帧/秒 | 头部动画过渡 |
| 账户选择器滚动 | >= 55 fps | <= 5 丢帧/秒 | 轻量列表项 |
| 链选择器滚动 | >= 55 fps | <= 5 丢帧/秒 | 简单图标 + 文字 |
| Swap Token 选择器滚动 | >= 50 fps | <= 10 丢帧/秒 | 带余额的 Token 项 |
| 设置列表滚动 | >= 58 fps | <= 2 丢帧/秒 | 静态项，应接近完美 |
| WebView（DApp）滚动 | >= 45 fps | <= 15 丢帧/秒 | 取决于 DApp 内容 |

**桌面端 / Web / 扩展端目标：**

| 滚动场景 | 最低 FPS | 备注 |
|---------|:--------:|------|
| 任何虚拟化列表滚动 | >= 55 fps | 更大视口 = 更多可见项 |
| 任何非虚拟化滚动 | >= 58 fps | 静态内容应流畅 |
| 图表交互（平移/缩放） | >= 50 fps | TradingView 渲染 |

**滚动帧率劣化检测：**

```
对每个可滚动场景：
  1. 记录自动滚动操作期间的 FPS 采样
  2. 计算：平均 FPS、最低 FPS、p5 FPS、丢帧数
  3. 与基线对比：
     - 平均 FPS 下降 > 10% → 警告
     - 平均 FPS 下降 > 20% → 劣化
     - 最低 FPS < 20（新出现） → 劣化
     - 任何持续窗口（>500ms）低于 30 FPS → 劣化
```

### 推荐的滚动帧率 perfMark 插桩

为了将帧率下降与滚动操作关联，在滚动交互前后添加 marks：

```typescript
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

// 触发自动滚动前
perfMark('scroll:start:TokenList');
// ... 滚动操作 ...
perfMark('scroll:end:TokenList');

// 然后 perf server 可以关联此时间窗口内的 fps.log 数据
```

---

## 平台图例

| 缩写 | 平台 | 备注 |
|------|------|------|
| **M** | 移动端（iOS / Android） | React Native，Hermes 引擎，列表使用 FlashList |
| **E** | 扩展端（Chrome / Firefox） | Popup (550x600) + Side Panel + Full Page 模式 |
| **W** | Web 端 | 标准浏览器标签页，标签页列表使用 react-virtualized |
| **D** | 桌面端 | Electron 应用，与 Web 端相同的渲染引擎 |

---

## 页面与指标

### 1. 应用冷启动

**平台**：M / E / W / D

**说明**：从进程启动到首页第一个可交互帧。这是用户感知性能最关键的流程，也是自动化劣化防护的主要目标。

**perfMark 检查点**：
- `app:start` — JS 开始执行
- `Home:overview:mount` — 首页组件挂载
- `Home:refresh:start:tokens` — Token 数据请求开始
- `Home:refresh:done:tokens` — Token 数据请求及渲染完成

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **可交互时间（TTI）** | `app:start` → `Home:overview:mount` | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | 增加 > 20% |
| **Tokens 开始时间（tokensStartMs）** | `Home:refresh:start:tokens` 距会话开始的时间戳 | iOS release: < 3948ms, Android release: < 3101ms | 中位数 > 阈值 |
| **Tokens 耗时（tokensSpanMs）** | `Home:refresh:start:tokens` → `Home:refresh:done:tokens` | iOS release: < 2550ms, Android release: < 4898ms | 中位数 > 阈值 |
| **函数调用数** | `function_call.log` 总行数 | iOS release: < 671, Android release: < 899 | 中位数 > 阈值 |
| **模块加载数** | `module_load.log` 计数 | 基线 ± 5% | 增加 > 10% |
| **模块加载总耗时** | 所有 module_load 耗时之和 | 基线 ± 10% | 增加 > 20% |
| **JS 阻塞事件** | 启动期间的 `jsblock:*` marks | 0 个阻塞 > 300ms | 出现新的阻塞 > 300ms |
| **空闲时内存** | 首页完全加载并空闲（5s）后的堆 | M: < 150MB, D/W/E: < 200MB | 增加 > 20% |
| **Deep Link → 目标页面** | URL scheme/通用链接 → 目标页面可见 | M: < 3000ms, D/W/E: < 2000ms | 增加 > 25% |
| **Deep Link 解析** | 接收 URL → 解析完成并确定路由 | 全平台 < 50ms | > 100ms |

**平台特定说明**：
- **移动端**：还需测量原生启动屏消失 → `app:start` 之间的间隔（如已插桩）。Deep Link 增加约 200ms 的路由解析开销。
- **扩展端**：单独测量 popup 打开时间（popup 有自己的冷启动）
- **桌面端**：测量 Electron 主进程就绪 → 渲染进程 `app:start`

#### 各平台冷启动性能约束

以下按平台拆分详细的冷启动阶段约束。每个平台的启动流程不同，因此拆分的阶段和目标值也不同。

##### iOS（移动端）

| 阶段 | 测量方式 | Release 目标 | Debug 目标 | 劣化阈值 |
|------|---------|-------------|-----------|---------|
| **原生启动 → JS 执行** | 启动屏消失 → `app:start` | < 500ms | < 1500ms | 增加 > 30% |
| **JS Bundle 加载** | Hermes 字节码加载耗时 | < 300ms | < 800ms（含 Metro） | 增加 > 25% |
| **JS 执行 → 首页挂载** | `app:start` → `Home:overview:mount` | < 2000ms | < 5000ms | 增加 > 20% |
| **Tokens 开始时间** | `Home:refresh:start:tokens` 距会话开始 | < 3948ms | < 10858ms | 中位数 > 阈值 |
| **Tokens 加载耗时** | `start:tokens` → `done:tokens` | < 2550ms | < 3403ms | 中位数 > 阈值 |
| **端到端 TTI** | 进程启动 → 首页可交互 | < 4000ms | < 12000ms | 增加 > 20% |
| **函数调用总数** | `function_call.log` 行数 | < 671 | < 942 | 中位数 > 阈值 |
| **启动期间 JS 阻塞** | `jsblock:*` marks（> 300ms） | 0 个 | 0 个 | 出现新阻塞 |
| **空闲内存** | 首页加载后空闲 5s 的堆 | < 150MB | < 200MB | 增加 > 20% |

##### Android（移动端）

| 阶段 | 测量方式 | Release 目标 | Debug 目标 | 劣化阈值 |
|------|---------|-------------|-----------|---------|
| **原生启动 → JS 执行** | Activity 创建 → `app:start` | < 600ms | < 2000ms | 增加 > 30% |
| **JS Bundle 加载** | Hermes 字节码加载耗时 | < 400ms | < 1200ms（含 Metro） | 增加 > 25% |
| **JS 执行 → 首页挂载** | `app:start` → `Home:overview:mount` | < 2000ms | < 6000ms | 增加 > 20% |
| **Tokens 开始时间** | `Home:refresh:start:tokens` 距会话开始 | < 3101ms | < 14965ms | 中位数 > 阈值 |
| **Tokens 加载耗时** | `start:tokens` → `done:tokens` | < 4898ms | < 8467ms | 中位数 > 阈值 |
| **端到端 TTI** | 进程启动 → 首页可交互 | < 5000ms | < 16000ms | 增加 > 20% |
| **函数调用总数** | `function_call.log` 行数 | < 899 | < 1784 | 中位数 > 阈值 |
| **启动期间 JS 阻塞** | `jsblock:*` marks（> 300ms） | 0 个 | 0 个 | 出现新阻塞 |
| **空闲内存** | 首页加载后空闲 5s 的堆 | < 180MB | < 250MB | 增加 > 20% |

> **注**：Android Debug 由于 Metro + Babel 插桩开销，阈值显著高于 Release。实际优化应以 Release 构建为准。

##### 浏览器扩展端（Extension）

扩展端有两种冷启动场景：**Popup 打开**和 **Side Panel / Full Page 打开**。

| 阶段 | 测量方式 | Popup 目标 | Side Panel / Full Page 目标 | 劣化阈值 |
|------|---------|-----------|---------------------------|---------|
| **Service Worker 激活** | SW 注册 → `app:start` | < 200ms | < 200ms | 增加 > 50% |
| **JS Bundle 解析与执行** | 脚本加载 → 框架就绪 | < 400ms | < 500ms | 增加 > 25% |
| **JS 执行 → 首页挂载** | `app:start` → `Home:overview:mount` | < 1500ms | < 1500ms | 增加 > 20% |
| **Tokens 加载耗时** | `start:tokens` → `done:tokens` | < 1500ms | < 1500ms | 增加 > 15% |
| **端到端 TTI** | 用户点击图标 → 首页可交互 | < 2000ms | < 2500ms | 增加 > 20% |
| **函数调用总数** | `function_call.log` 行数 | < 500 | < 600 | 增加 > 15% |
| **启动期间 JS 阻塞** | `jsblock:*` marks（> 200ms） | 0 个 | 0 个 | 出现新阻塞 |
| **空闲内存** | 首页加载后空闲 5s 的堆 | < 100MB | < 150MB | 增加 > 20% |
| **Popup 首帧渲染** | 点击图标 → 首帧像素渲染 | < 500ms | — | > 800ms |

> **注**：Popup 在 550×600 受限视口中运行，需特别关注首帧渲染速度，因为用户对 Popup 响应的即时性期望更高。MV3 Service Worker 可能需要从休眠中唤醒，增加冷启动延迟。

##### Web 端

| 阶段 | 测量方式 | 目标 | 劣化阈值 |
|------|---------|------|---------|
| **HTML 文档加载** | `navigationStart` → `DOMContentLoaded` | < 500ms | 增加 > 25% |
| **JS Bundle 解析与执行** | 主 bundle 脚本加载 → 框架就绪 | < 600ms | 增加 > 25% |
| **JS 执行 → 首页挂载** | `app:start` → `Home:overview:mount` | < 1200ms | 增加 > 20% |
| **Tokens 加载耗时** | `start:tokens` → `done:tokens` | < 1200ms | 增加 > 15% |
| **端到端 TTI** | `navigationStart` → 首页可交互 | < 2500ms | 增加 > 20% |
| **首次内容绘制（FCP）** | `performance.getEntriesByName('first-contentful-paint')` | < 800ms | > 1200ms |
| **最大内容绘制（LCP）** | `PerformanceObserver` LCP | < 1500ms | > 2000ms |
| **累计布局偏移（CLS）** | `PerformanceObserver` CLS | < 0.1 | > 0.25 |
| **首次输入延迟（FID）** | `PerformanceObserver` FID | < 100ms | > 200ms |
| **函数调用总数** | `function_call.log` 行数 | < 500 | 增加 > 15% |
| **启动期间 JS 阻塞** | Long Tasks API（> 300ms） | 0 个 | 出现新阻塞 |
| **空闲内存** | 首页加载后空闲 5s 的堆 | < 150MB | 增加 > 20% |
| **JS Bundle 体积** | 主 bundle gzip 后 | < 2MB | 增加 > 10% |

> **注**：Web 端引入 Core Web Vitals（FCP、LCP、CLS、FID）指标作为补充。这些指标可通过浏览器原生 Performance API 采集，无需额外插桩。Bundle 体积直接影响 JS 解析时间，需持续监控。

##### 桌面端（Desktop / Electron）

| 阶段 | 测量方式 | 目标 | 劣化阈值 |
|------|---------|------|---------|
| **Electron 主进程启动** | 进程启动 → 主进程 `ready` 事件 | < 800ms | 增加 > 25% |
| **主进程 → 渲染进程就绪** | `ready` → 渲染进程 `app:start` | < 500ms | 增加 > 25% |
| **JS 执行 → 首页挂载** | `app:start` → `Home:overview:mount` | < 1500ms | 增加 > 20% |
| **Tokens 加载耗时** | `start:tokens` → `done:tokens` | < 1500ms | 增加 > 15% |
| **端到端 TTI** | 进程启动 → 首页可交互 | < 3000ms | 增加 > 20% |
| **窗口首帧可见** | 进程启动 → `BrowserWindow` 首帧显示 | < 1500ms | > 2000ms |
| **函数调用总数** | `function_call.log` 行数 | < 600 | 增加 > 15% |
| **启动期间 JS 阻塞** | `jsblock:*` marks（> 300ms） | 0 个 | 出现新阻塞 |
| **空闲内存（渲染进程）** | 首页加载后空闲 5s 的堆 | < 200MB | 增加 > 20% |
| **空闲内存（主进程）** | 首页加载后空闲 5s 的堆 | < 80MB | 增加 > 25% |
| **IPC 通信耗时** | 主进程 ↔ 渲染进程 IPC 往返 | < 10ms | > 30ms |

> **注**：桌面端需同时监控主进程和渲染进程的资源消耗。Electron 主进程负责窗口管理、硬件钱包通信等，渲染进程负责 UI。IPC 通信延迟过高会导致用户操作卡顿。

##### 各平台冷启动目标汇总

| 指标 | iOS Release | Android Release | Extension (Popup) | Web | Desktop |
|------|:----------:|:--------------:|:-----------------:|:---:|:-------:|
| **端到端 TTI** | < 4000ms | < 5000ms | < 2000ms | < 2500ms | < 3000ms |
| **JS → 首页挂载** | < 2000ms | < 2000ms | < 1500ms | < 1200ms | < 1500ms |
| **Tokens 加载** | < 2550ms | < 4898ms | < 1500ms | < 1200ms | < 1500ms |
| **函数调用预算** | < 671 | < 899 | < 500 | < 500 | < 600 |
| **空闲内存** | < 150MB | < 180MB | < 100MB | < 150MB | < 200MB |
| **JS 阻塞（> 300ms）** | 0 | 0 | 0 | 0 | 0 |

---

### 2. 首页 / 钱包总览

**平台**：M / E / W / D

**路由**：`ETabRoutes.Home` → `TabHome`

**说明**：主钱包仪表盘，展示账户余额、Token 列表和近期活动。使用 `Tabs.Container`（react-native-collapsible-tab-view）包含多个标签页：Portfolio（Token 列表）、NFTs（网格）、History（分组列表）、Approvals。

**perfMark 检查点**：
- `Home:overview:mount` / `Home:overview:unmount`
- `Home:refresh:start:tokens` / `Home:refresh:done:tokens`
- `Home:done:tokens`
- `AllNet:useAllNetworkRequests:start`
- `AllNet:getAllNetworkAccounts:start` / `AllNet:getAllNetworkAccounts:done`

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **Token 刷新耗时** | `Home:refresh:start:tokens` → `Home:refresh:done:tokens` | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | 增加 > 15% |
| **全网络账户获取** | `AllNet:getAllNetworkAccounts:start` → `done` | 全平台 < 3000ms | 增加 > 20% |
| **Token 列表滚动 FPS** | Token 列表（FlashList）滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 30 fps 持续 > 500ms |
| **NFT 网格滚动 FPS** | NFT 网格滚动时的 FPS | M: >= 45 fps, D/W/E: >= 55 fps | 低于 30 fps 持续 > 500ms |
| **历史列表滚动 FPS** | 交易历史（SectionList）滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 30 fps 持续 > 500ms |
| **可折叠头部 FPS** | 头部收起/展开时的 FPS | M: >= 50 fps | 低于 40 fps |
| **刷新期间函数调用数** | 刷新窗口内的 function_call 计数 | 基线 ± 10% | 增加 > 15% |
| **刷新 Top 慢函数** | `/api/sessions/:id/home-refresh` topFunctions | 无函数 p95 > 50ms | 出现新函数 > 50ms 或已有增加 > 25% |
| **Storage 操作** | 刷新期间的 `storage:*` marks | 总计 < 500ms | 增加 > 30% |
| **SimpleDB 操作** | 刷新期间的 `simpledb:*` marks | 总计 < 300ms | 增加 > 30% |
| **后台调用** | 刷新期间的 `bgcall:*` marks | 总计 < 1000ms | 增加 > 25% |
| **下拉刷新总耗时** | 用户下拉 → 所有数据刷新完成 | M: < 3000ms | 增加 > 20% |
| **下拉刷新 FPS** | 下拉手势 + 动画（1200ms 加载指示器）期间的 FPS | M: >= 55 fps | 低于 45 fps |
| **标签页切换（Portfolio ↔ NFTs ↔ History）** | 点击标签页 → 新内容可见（100ms 回调延迟） | 全平台 < 200ms | > 300ms |
| **标签页切换 FPS** | 标签页内容转场期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **键盘弹出 FPS（搜索）** | 搜索时键盘出现的 FPS | M: >= 45 fps | 低于 35 fps |

**平台特定说明**：
- **移动端**：使用 50+ Token、5+ 网络测试以压测 Token 列表渲染。可折叠标签头部动画是常见的 FPS 瓶颈。下拉刷新有固定 1200ms 动画 — 测量包含数据刷新在内的总周期。
- **扩展端 Popup**：较小视口中的 Token 列表 — 在 550x600 popup 尺寸下测试滚动性能
- **Web/桌面端**：大屏幕测试所有 Token 无需滚动的场景；也测试 react-virtualized 虚拟化滚动

---

### 3. Token 详情

**平台**：M / E / W / D

**路由**：`EModalRoutes.MainModal` → `TokenDetails`

**说明**：单个 Token 的详情视图，包含价格图表、余额和交易历史。使用 `Tabs`（CollapsibleTabView）含历史/持有者/组合标签页。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开（TTI）** | 导航开始 → 内容可交互 | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | 增加 > 20% |
| **价格图表渲染** | 图表数据加载 → 图表绘制完成 | 全平台 < 1000ms | 增加 > 25% |
| **交易历史加载** | 首批交易渲染完成 | 全平台 < 1500ms | 增加 > 20% |
| **历史滚动 FPS** | 交易历史 SectionList 滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 30 fps 持续 > 500ms |
| **标签页切换延迟** | 点击标签页 → 新标签页内容可见（100ms 回调） | 全平台 < 200ms | > 300ms |
| **标签页切换 FPS** | 标签页切换动画期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **图表交互 FPS** | 图表缩放/平移期间的 FPS（25ms 节流） | M: >= 45 fps, D/W/E: >= 50 fps | 低于 30 fps |
| **图表十字线响应** | 光标/手指移动 → 十字线 + 提示框更新 | < 25ms（节流） | > 50ms |
| **导航转场 FPS** | 模态打开动画（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **返回导航** | 返回按压 → 首页可见 | 全平台 < 300ms | > 400ms |
| **内存增量** | 从首页 → Token 详情的堆增量 | < 30MB | 增加 > 50% |

---

### 4. 发送交易流程

**平台**：M / E / W / D

**路由**：`EModalRoutes.SendModal` → `SendDataInput` → `SendConfirm` → `SendFeedback`

**说明**：从输入收款方到交易广播确认的完整发送流程。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **发送页面打开** | 导航 → SendDataInput 可交互 | M: < 600ms, E: < 500ms, W: < 400ms, D: < 500ms | 增加 > 20% |
| **地址验证** | 输入完成 → 验证结果 | 全平台 < 500ms | 增加 > 30% |
| **手续费估算** | 请求 → 费用选项展示 | 全平台 < 2000ms | 增加 > 25% |
| **Token 选择器打开** | 点击 → Token 列表渲染 | 全平台 < 500ms | 增加 > 30% |
| **Token 选择器滚动 FPS** | 选择器中 Token 列表滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **确认页加载** | SendDataInput 提交 → SendConfirm 可交互 | 全平台 < 800ms | 增加 > 20% |
| **交易签名与广播** | 确认 → SendFeedback（成功/失败） | < 3000ms（不含硬件钱包） | 增加 > 25% |
| **输入时 FPS** | 输入地址/金额时的 FPS | 全平台 >= 55 fps | 低于 45 fps |
| **键盘弹出 FPS** | 地址/金额输入框键盘出现时的 FPS | M: >= 45 fps | 低于 35 fps |
| **键盘收起 FPS** | 键盘消失时的 FPS | M: >= 45 fps | 低于 35 fps |
| **导航转场（→ 确认页）** | 发送表单提交 → 确认页动画完成（250ms） | 全平台 < 400ms | > 500ms |
| **发送按钮响应** | 确认按钮点击 → 操作发起 | 全平台 < 100ms | > 200ms |
| **剪贴板粘贴 → 地址填充** | 粘贴地址 → 字段填充 + 验证 | 全平台 < 300ms | > 500ms |
| **确认弹窗 FPS** | 发送确认弹窗动画（300ms）期间的 FPS | >= 50 fps | 低于 40 fps |

**平台特定说明**：
- **移动端**：测试键盘打开/关闭对 FPS 的影响 — 地址/金额输入触发布局重排
- **扩展端 Popup**：紧凑视口中的表单布局
- **所有平台**：硬件钱包签名不包含在广播计时中 — 仅测量软件钱包

---

### 5. 收款页面

**平台**：M / E / W / D

**路由**：`EModalRoutes.ReceiveModal` → `ReceiveToken`

**说明**：展示收款地址和二维码。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开** | 导航 → 二维码可见 | M: < 500ms, E: < 400ms, W: < 300ms, D: < 400ms | 增加 > 25% |
| **二维码渲染** | 地址就绪 → 二维码绘制 | 全平台 < 200ms | 增加 > 50% |
| **地址派生** | HD 钱包派生地址的时间 | 全平台 < 1000ms | 增加 > 30% |
| **复制地址（剪贴板）** | 点击复制 → 地址进入剪贴板 + Toast 可见 | 全平台 < 300ms | > 500ms |
| **导航转场 FPS** | 模态打开动画（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |

---

### 6. 兑换（Swap）

**平台**：M / E / W / D

**路由**：`ETabRoutes.Swap` → `TabSwap`，`EModalRoutes.SwapModal` → `SwapMainLand`

**说明**：Token 兑换界面，包含报价获取、供应商选择和交易执行。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开** | 导航 → 兑换表单可交互 | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | 增加 > 20% |
| **报价获取** | 输入金额 → 首个报价展示 | 全平台 < 3000ms | 增加 > 20% |
| **Token 选择器打开** | 点击 → 带余额的 Token 列表渲染 | 全平台 < 600ms | 增加 > 30% |
| **Token 选择器滚动 FPS** | Token 选择器列表滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **Token 搜索** | 按键 → 过滤结果（50ms 防抖） | 全平台 < 200ms | 增加 > 50% |
| **供应商对比加载** | 报价完成 → 供应商列表渲染 | 全平台 < 1000ms | 增加 > 25% |
| **供应商列表滚动 FPS** | 供应商列表滚动时的 FPS | 全平台 >= 55 fps | 低于 45 fps |
| **Swap 确认页** | 提交 → 确认页可交互 | 全平台 < 500ms | 增加 > 25% |
| **历史列表滚动 FPS** | Swap 历史列表滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **交互时 FPS** | 与兑换表单交互时的 FPS | 全平台 >= 55 fps | 低于 45 fps |
| **Swap 确认按钮响应** | 确认点击 → 交易发起 | 全平台 < 100ms | > 200ms |
| **键盘弹出 FPS（金额输入）** | 金额输入时键盘出现的 FPS | M: >= 45 fps | 低于 35 fps |
| **导航转场 FPS** | 模态推入/弹出动画（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |

---

### 7. 行情总览

**平台**：D / W / E（移动端标签页中隐藏，可通过发现页访问）

**路由**：`ETabRoutes.Market` → `TabMarket`

**说明**：加密货币行情总览，含可排序的 Token 列表和价格迷你图。移动端使用带分页（20 条/页）的 `FlatList`。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开（TTI）** | 标签页切换 → 首批 Token 列表渲染 | D: < 1000ms, W: < 800ms, E: < 1000ms | 增加 > 20% |
| **完整列表渲染** | 所有可见行渲染完成 | 全平台 < 2000ms | 增加 > 20% |
| **Token 列表滚动 FPS** | 行情 Token 列表滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps 持续 > 500ms |
| **带迷你图滚动 FPS** | 滚动时（迷你图渲染中）的 FPS | M: >= 45 fps, D/W/E: >= 50 fps | 低于 35 fps |
| **排序操作** | 点击列头 → 列表重新排序 | 全平台 < 300ms | 增加 > 50% |
| **搜索** | 按键 → 过滤结果（50ms 防抖） | 全平台 < 200ms | 增加 > 50% |
| **排序点击响应** | 点击列头 → 视觉反馈 | 全平台 < 50ms | > 100ms |
| **分页加载** | 滚动到底部 → 下一批 20 条加载 | 全平台 < 500ms | 增加 > 30% |
| **图片加载（Token 图标）** | Token 图标缓存命中 → 可见 | < 50ms（缓存），< 500ms（网络） | 增加 > 30% |
| **内存占用** | 加载 500+ Token 后的堆 | < 80MB（相对基线增量） | 增加 > 30% |

**平台特定说明**：
- **扩展端 Popup**：行情为限制视图 — 在全页模式下测试完整列表
- **Web/桌面端**：使用大列表（500+ Token）测试以压测虚拟化

---

### 8. 行情详情

**平台**：M / D / W / E

**路由**：`EModalRoutes.MarketModal` → `MarketDetailV2`

**说明**：Token 详情，含 TradingView 图表、统计数据和交易信息。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开** | 导航 → 基本信息可见 | M: < 800ms, E: < 700ms, W: < 600ms, D: < 700ms | 增加 > 20% |
| **图表加载** | 页面打开 → TradingView 图表可交互 | 全平台 < 2000ms | 增加 > 25% |
| **图表时间框架切换** | 点击时间框架 → 图表重绘 | 全平台 < 1000ms | 增加 > 30% |
| **图表平移/缩放 FPS** | 图表缩放/平移期间的 FPS（25ms 悬停节流） | M: >= 45 fps, D/W/E: >= 50 fps | 低于 30 fps |
| **图表十字线响应** | 移动 → 十字线 + 提示框更新（25ms 节流） | < 25ms | > 50ms |
| **图表数据更新** | 新数据 → 图表重渲染（30ms 防抖） | 全平台 < 100ms | > 200ms |
| **内容滚动 FPS** | 页面内容滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **内存增量** | 从行情总览 → 行情详情的堆增量 | < 50MB | 增加 > 40% |

---

### 9. 发现 / DApp 浏览器

**平台**：M / E / W / D

**路由**：`ETabRoutes.Discovery` → `TabDiscovery`

**说明**：DApp 浏览器，含搜索、书签和嵌入式 WebView。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **发现页打开** | 标签页切换 → DApp 列表渲染 | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | 增加 > 20% |
| **DApp 列表滚动 FPS** | 滚动 DApp 目录列表时的 FPS | M: >= 55 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **DApp 搜索** | 按键 → 搜索结果 | 全平台 < 300ms | 增加 > 50% |
| **WebView 加载** | 选择 DApp → WebView 内容加载 | M: < 3000ms, D/W/E: < 2000ms | 增加 > 25% |
| **WebView 内容滚动 FPS** | 在已加载的 DApp 中滚动的 FPS | M: >= 45 fps, D/W/E: >= 50 fps | 低于 30 fps |
| **标签页切换（浏览器）** | 切换已打开的 DApp 标签页 | 全平台 < 500ms | 增加 > 30% |
| **书签列表滚动 FPS** | 滚动书签列表的 FPS | 全平台 >= 55 fps | 低于 45 fps |
| **每标签页内存** | 每个已打开 DApp 标签页的堆增量 | M: < 50MB, D/W/E: < 80MB | 增加 > 40% |
| **DApp 注入时间** | Provider 注入 WebView | 全平台 < 500ms | 增加 > 50% |
| **浏览器标签页切换** | 切换已打开的 DApp 标签页 | 全平台 < 500ms | 增加 > 30% |
| **DApp 搜索响应** | 按键 → 搜索结果（50ms 防抖） | 全平台 < 300ms | 增加 > 50% |

**平台特定说明**：
- **移动端**：WebView 较重 — 多标签页时需密切监控内存
- **扩展端**：DApp 浏览器仅在全页模式运行
- **桌面端/Web**：支持多标签页浏览器 — 打开 5+ 标签页测试

---

### 10. 理财 / DeFi 总览

**平台**：D / W（移动端可通过发现页嵌入访问）

**路由**：`ETabRoutes.Earn` → `EarnHome`，`EarnProtocols`

**说明**：DeFi 理财机会、质押协议和投资组合总览。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开（TTI）** | 标签页切换 → 协议列表渲染 | D: < 1200ms, W: < 1000ms | 增加 > 20% |
| **协议列表加载** | API 响应 → 完整列表渲染 | 全平台 < 2000ms | 增加 > 20% |
| **协议列表滚动 FPS** | 协议卡片列表滚动时的 FPS | >= 55 fps | 低于 40 fps |
| **筛选/排序** | 应用筛选 → 列表更新 | < 300ms | 增加 > 50% |
| **筛选点击响应** | 点击筛选 → 视觉反馈 | < 50ms | > 100ms |
| **投资组合数据加载** | 页面打开 → 组合价值展示 | < 2000ms | 增加 > 25% |
| **协议卡片点击 → 详情** | 点击卡片 → 详情页导航（250ms 动画） | < 400ms | > 500ms |
| **导航转场 FPS** | 详情页推入动画期间的 FPS | >= 50 fps | 低于 40 fps |

---

### 11. 质押详情

**平台**：M / D / W / E

**路由**：`EModalRoutes.StakingModal` → `ProtocolDetails`，`Stake`，`Withdraw`

**说明**：质押协议详情，含仓位管理、质押和提现流程。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **协议详情打开** | 导航 → 协议信息渲染 | 全平台 < 800ms | 增加 > 20% |
| **APY / 统计加载** | 页面打开 → 收益数据展示 | 全平台 < 1500ms | 增加 > 25% |
| **详情内容滚动 FPS** | 协议详情 ScrollView 滚动时的 FPS | M: >= 55 fps, D/W/E: >= 58 fps | 低于 45 fps |
| **质押表单打开** | 点击质押 → 表单可交互 | 全平台 < 500ms | 增加 > 30% |
| **质押预览计算** | 输入金额 → 预期收益展示 | 全平台 < 1000ms | 增加 > 30% |
| **提现表单打开** | 点击提现 → 表单可交互 | 全平台 < 500ms | 增加 > 30% |
| **质押按钮响应** | 确认质押点击 → 交易发起 | 全平台 < 100ms | > 200ms |
| **导航转场 FPS** | 模态推入/弹出动画（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **键盘弹出 FPS（金额输入）** | 质押/提现金额输入时键盘出现的 FPS | M: >= 45 fps | 低于 35 fps |

---

### 12. 设置

**平台**：M / E / W / D

**路由**：`EModalRoutes.SettingModal` → `SettingListModal`

**说明**：应用设置列表，包含各种配置选项。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开** | 导航 → 设置列表渲染 | 全平台 < 400ms | 增加 > 30% |
| **设置列表滚动 FPS** | 设置列表滚动时的 FPS | 全平台 >= 58 fps | 低于 50 fps |
| **子页面导航** | 点击项目 → 子页面渲染 | 全平台 < 300ms | 增加 > 30% |
| **清除缓存操作** | 点击清除 → 操作完成 | 全平台 < 3000ms | 增加 > 30% |
| **自定义 RPC 保存** | 保存 RPC URL → 验证并保存 | 全平台 < 1000ms | 增加 > 30% |
| **生物识别弹窗出现** | 点击生物识别设置 → 原生对话框可见 | < 200ms（原生 OS） | > 400ms |
| **生物识别 → 解锁** | 成功扫描 → 操作授权 | < 100ms（扫描后） | > 300ms |
| **导航转场 FPS** | 设置子页面导航（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |

---

### 13. 账户管理 / 钱包选择器

**平台**：M / E / W / D

**路由**：`EModalRoutes.AccountManagerStacks` → `AccountSelectorStack`

**说明**：账户和钱包选择浮层，包含多账户管理。使用 `SortableSectionList`（支持拖放）。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **选择器打开** | 点击账户 → 选择器面板可见 | M: < 500ms, E: < 400ms, W: < 300ms, D: < 400ms | 增加 > 25% |
| **账户列表渲染** | 选择器打开 → 所有账户渲染 | < 800ms（20+ 账户时） | 增加 > 20% |
| **账户列表滚动 FPS** | 滚动账户/钱包列表的 FPS | 全平台 >= 55 fps | 低于 40 fps |
| **拖放排序 FPS** | 拖放重新排序时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 40 fps |
| **账户切换** | 点击账户 → 首页以新数据刷新 | 全平台 < 2000ms | 增加 > 20% |
| **批量创建账户** | 提交 → 账户创建完成 | 10 个账户 < 5000ms | 增加 > 25% |
| **选择器打开动画 FPS** | 底部面板打开动画（300ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **拖拽开始响应** | 长按 → 拖拽手柄激活 | 全平台 < 200ms | > 300ms |

---

### 14. 引导流程（创建 / 导入钱包）

**平台**：M / E / W / D

**路由**：`EModalRoutes.OnboardingV2` → `GetStarted` → `CreateOrImportWallet` → ...

**说明**：新用户钱包创建和导入流程。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **引导开始** | 应用首次启动 → GetStarted 可见 | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | 增加 > 20% |
| **助记词生成** | 点击创建 → 短语展示 | 全平台 < 1000ms | 增加 > 30% |
| **助记词验证** | 所有词选择完成 → 验证通过 | 全平台 < 500ms | 增加 > 30% |
| **从助记词导入** | 粘贴短语 → 钱包恢复 | 全平台 < 3000ms | 增加 > 25% |
| **导入账户发现** | 短语接受 → 账户发现完成 | 全平台 < 5000ms | 增加 > 25% |
| **硬件钱包连接** | 点击连接 → 设备识别 | < 5000ms（不含用户操作） | 增加 > 30% |
| **助记词粘贴（剪贴板）** | 粘贴短语 → 所有词填充 | 全平台 < 200ms | > 400ms |
| **键盘弹出 FPS** | 助记词/密码输入时键盘出现的 FPS | M: >= 45 fps | 低于 35 fps |
| **导航转场 FPS** | 引导步骤转场（250ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **密码弹窗 FPS** | 密码设置弹窗动画（300ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |

---

### 15. DApp 连接授权

**平台**：M / E / W / D

**路由**：`EModalRoutes.DAppConnectionModal`

**说明**：DApp 请求钱包连接授权。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **授权面板打开** | DApp 请求 → 授权 UI 可见 | 全平台 < 500ms | 增加 > 30% |
| **授权中账户列表** | 面板打开 → 账户渲染 | 全平台 < 300ms | 增加 > 30% |
| **账户列表滚动 FPS** | 授权面板中滚动账户的 FPS | 全平台 >= 55 fps | 低于 45 fps |
| **授权确认** | 用户确认 → DApp 收到响应 | 全平台 < 500ms | 增加 > 30% |
| **授权按钮响应** | 点击授权 → 操作发起 | 全平台 < 100ms | > 200ms |
| **签名确认加载** | 签名请求 → 确认页渲染 | 全平台 < 600ms | 增加 > 25% |
| **WalletConnect 配对** | 扫码 → WC 配对建立 | M < 3000ms | > 5000ms |
| **WC 会话提案 → UI** | 收到会话提案 → 授权 UI 可见 | 全平台 < 500ms | > 800ms |
| **授权面板动画 FPS** | 底部面板打开动画（300ms）期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |

**平台特定说明**：
- **扩展端**：这是扩展端最频繁的模态框 — popup 必须快速打开
- **移动端**：WalletConnect deep link → 授权面板计时。WC 配对应在 3 秒内完成，会话提案 → UI 在 500ms 内。

---

### 16. 交易历史

**平台**：M / E / W / D

**路由**：`EModalRoutes.MainModal` → `HistoryDetails`

**说明**：按账户或按 Token 的交易历史列表和详情视图。使用带日期分组头的 `SectionList`。

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **历史列表加载** | 页面打开 → 首批渲染 | 全平台 < 1000ms | 增加 > 20% |
| **历史列表滚动 FPS** | 历史 SectionList 滚动时的 FPS | M: >= 50 fps, D/W/E: >= 55 fps | 低于 30 fps 持续 > 500ms |
| **分组头吸顶 FPS** | 吸顶分组头过渡时的 FPS | M: >= 50 fps | 低于 40 fps |
| **历史详情打开** | 点击交易 → 详情渲染（250ms 导航动画） | 全平台 < 400ms | 增加 > 30% |
| **历史详情导航 FPS** | 详情模态打开动画期间的 FPS | 全平台 >= 50 fps | 低于 40 fps |
| **复制交易哈希（剪贴板）** | 点击复制 → 哈希进入剪贴板 + Toast 可见 | 全平台 < 300ms | > 500ms |
| **分页 / 加载更多** | 滚动到底部 → 下一批追加 | 全平台 < 800ms | 增加 > 25% |
| **内存增长** | 每加载 100 条的堆增量 | < 10MB | 增加 > 40% |

---

## 当前阈值基线

以下是当前自动化劣化防护阈值（来自 `development/perf-ci/thresholds/`）：

### iOS

| 指标 | Debug | Release |
|------|------:|--------:|
| **tokensStartMs** | 10,858 ms | 3,948 ms |
| **tokensSpanMs** | 3,403 ms | 2,550 ms |
| **functionCallCount** | 942 | 671 |
| **策略** | median | median |

### Android

| 指标 | Debug | Release |
|------|------:|--------:|
| **tokensStartMs** | 14,965 ms | 3,101 ms |
| **tokensSpanMs** | 8,467 ms | 4,898 ms |
| **functionCallCount** | 1,784 | 899 |
| **策略** | median | median |

> 注：Debug 构建包含 Metro 开销和 Babel 插桩，因此数值明显更高。

---

## 指标模板（新增页面时使用）

新增页面到劣化测试时，使用此模板：

```markdown
### N. 页面名称

**平台**：M / E / W / D

**路由**：`EModalRoutes.XXX` → `PageName`

**说明**：页面及其关键交互的简要描述。

**可滚动元素**：
- 元素名 → 使用的组件（如 FlashList、SectionList、ScrollView）

**perfMark 检查点**（需添加到代码中）：
- `PageName:mount` — 组件挂载
- `PageName:data:start` — 数据请求开始
- `PageName:data:done` — 数据请求及渲染完成
- `PageName:interactive` — 页面完全可交互

| 指标 | Mark / 来源 | 目标 | 劣化阈值 |
|------|------------|------|---------|
| **页面打开（TTI）** | 导航 → 可交互 | < Xms | 增加 > Y% |
| **导航转场 FPS** | 模态打开动画（250ms）期间的 FPS | >= 50 fps | 低于 40 fps |
| **数据加载** | data:start → data:done | < Xms | 增加 > Y% |
| **列表滚动 FPS** | 列表滚动时的 FPS | M: >= X fps, D/W/E: >= Y fps | 低于 Z fps 持续 > 500ms |
| **标签页切换** | 点击标签页 → 新内容可见（如有标签页） | < 200ms | > 300ms |
| **按钮响应** | 主操作按钮点击 → 操作发起 | < 100ms | > 200ms |
| **键盘弹出 FPS** | 键盘出现时的 FPS（如有输入框） | M: >= 45 fps | 低于 35 fps |
| **弹窗动画 FPS** | 弹窗打开/关闭时的 FPS（如有弹窗） | >= 50 fps | 低于 40 fps |
| **搜索响应** | 按键 → 过滤结果（如有搜索） | < 200ms | > 300ms |
| **剪贴板复制** | 点击复制 → Toast 可见（如有复制操作） | < 300ms | > 500ms |
| **内存增量** | 进入页面的堆增量 | < XMB | 增加 > Y% |
```

### 在代码中添加 perfMark

```typescript
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

// 在组件中
useEffect(() => {
  perfMark('PageName:mount');
  return () => perfMark('PageName:unmount');
}, []);

// 数据请求前后
perfMark('PageName:data:start');
const data = await fetchData();
perfMark('PageName:data:done');

// 滚动交互前后（用于 FPS 关联）
perfMark('PageName:scroll:start');
// ... 滚动操作 ...
perfMark('PageName:scroll:end');
```

---

## 运行系统

### 自动化（定时）

#### 方案 A：launchd（推荐用于 macOS 测试机）

```bash
# 一次性配置
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/perf-logs" "$HOME/perf-sessions"

# 复制并编辑 plists（替换 __REPO_ROOT__ 和 __HOME_DIR__）
cp development/perf-ci/launchd/perf-server.plist \
  "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
cp development/perf-ci/launchd/ios-perf-job.plist \
  "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"

# 加载服务
UID="$(id -u)"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
```

任务在每天 **09:00、14:00、19:00** 运行。perf-server 以 `KeepAlive: true` 永久运行。

#### 方案 B：Daemon 进程

```bash
# iOS release，每 5 小时，无头模式
yarn perf:ios:release:daemon --interval-minutes 300

# Android release，每 6 小时（默认），无头模式
yarn perf:android:release:daemon --interval-minutes 360
```

### 手动（临时）

```bash
# 单次 iOS release 运行
yarn perf:ios:release

# 单次 Android debug 运行
yarn perf:android:debug

# 指定模拟器
DETOX_DEVICE_UDID="218B05AF-8053-44EE-9D6C-7F4F48630591" yarn perf:ios:release

# 带 Slack 通知
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." yarn perf:ios:release
```

### 仪表盘与 CLI 分析

#### Web 仪表盘

```bash
# 启动 perf server（如未作为服务运行）
cd development/performance-server && yarn start

# 打开仪表盘
open http://localhost:9527
```

仪表盘功能：
- **时间线火焰图** — 按模块着色的函数调用条
- **FPS 迷你图** — 一眼识别低帧率窗口
- **内存迷你图** — 追踪会话生命周期内的堆使用
- **关键 Marks 时间线** — 查看所有 perfMark 检查点及计时
- **首页刷新分析** — Token 刷新热点的详细分解
- **慢函数表** — 按 p95/max/avg 排序，按模块筛选
- **重复调用表** — 检测冗余重复调用（rapid 模式：<100ms）
- **低帧率窗口** — 将帧率下降与函数调用和 marks 关联
- **JS 阻塞事件** — 识别主线程阻塞及根因
- **Speedscope 导出** — 在 speedscope.app 中打开会话进行火焰图分析

#### CLI 分析

```bash
# 完整会话分析
node cli/derive-session.js <sessionId> --pretty --output report.json

# 关键 marks 计时
curl http://localhost:9527/api/sessions/<sessionId>/key-marks | jq .

# 首页刷新热点
curl http://localhost:9527/api/sessions/<sessionId>/home-refresh | jq .

# 慢函数（top 100，阈值 10ms）
curl "http://localhost:9527/api/sessions/<sessionId>/slow-functions?pageSize=100&thresholdMs=10" | jq .

# 低帧率窗口（阈值 30fps）
curl "http://localhost:9527/api/sessions/<sessionId>/low-fps?threshold=30" | jq .

# JS 阻塞事件（最小 100ms）
curl "http://localhost:9527/api/sessions/<sessionId>/jsblock?minDrift=100" | jq .

# 高频重复调用
curl "http://localhost:9527/api/sessions/<sessionId>/repeated-calls?mode=rapid&minCount=3" | jq .
```

#### 对比会话

```bash
# 导出基线和测试会话
node cli/derive-session.js <baseline-id> --output baseline.json
node cli/derive-session.js <test-id> --output test.json

# 对比关键 marks
jq '.keyMarks.marks["Home:refresh:done:tokens"].first.sinceSessionStartMs' baseline.json test.json
```

### 各平台测试矩阵

| 测试场景 | iOS | Android | 扩展端 | Web | 桌面端 |
|---------|:---:|:---:|:---:|:---:|:---:|
| 冷启动 → 首页加载 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 首页 Token 刷新（下拉刷新） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 首页 Token 列表滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 首页 NFT 网格滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 首页历史滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token 详情打开 + 图表 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token 详情历史滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发送流程（输入 → 确认） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发送 Token 选择器滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 收款二维码展示 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swap 报价获取 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swap Token 选择器滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 行情列表滚动 FPS | — | — | ✅ | ✅ | ✅ |
| 行情详情图表交互 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发现 DApp 列表滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 发现 WebView 滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 理财协议列表滚动 FPS | — | — | — | ✅ | ✅ |
| 质押详情滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 设置列表滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 账户选择器滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| 账户切换 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 引导流程创建钱包 | ✅ | ✅ | ✅ | ✅ | ✅ |
| DApp 连接授权 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 交易历史滚动 FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| **交互指标** | | | | | |
| 导航转场 FPS（250ms 模态） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 按钮点击 → 操作响应 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 标签页切换延迟（首页标签页） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 弹窗打开/关闭动画 FPS（300ms） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 下拉刷新周期（1200ms 动画） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 搜索/筛选响应时间 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 键盘打开/关闭 FPS | ✅ | ✅ | — | — | — |
| 图表交互 FPS（平移/缩放） | ✅ | ✅ | ✅ | ✅ | ✅ |
| 剪贴板复制 → Toast | ✅ | ✅ | ✅ | ✅ | ✅ |
| 生物识别认证计时 | ✅ | ✅ | — | — | ✅ |
| 二维码扫描打开 + 解码 | ✅ | ✅ | — | — | — |
| WalletConnect 配对 + 会话 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deep Link → 目标页面 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 图片加载（Token 图标、NFT） | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toast 出现计时 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 附录：perfMark 命名规范

```
{页面或模块}:{阶段}:{详情}
```

### 已有 Marks

| Mark 名称 | 位置 | 说明 |
|-----------|------|------|
| `app:start` | `performance/init.ts` | JS 开始执行 |
| `Home:overview:mount` | `HomeOverviewContainer.tsx` | 首页组件已挂载 |
| `Home:overview:unmount` | `HomeOverviewContainer.tsx` | 首页组件已卸载 |
| `Home:refresh:start:tokens` | `HomeOverviewContainer.tsx` | Token 刷新开始 |
| `Home:refresh:done:tokens` | `HomeOverviewContainer.tsx` | Token 刷新完成 |
| `Home:done:tokens` | `HomeOverviewContainer.tsx` | Token 处理完成 |
| `AllNet:useAllNetworkRequests:start` | `useAllNetwork.ts` | 全网络请求 hook 启动 |
| `AllNet:getAllNetworkAccounts:start` | `useAllNetwork.ts` | 全网络账户获取开始 |
| `AllNet:getAllNetworkAccounts:done` | `useAllNetwork.ts` | 全网络账户获取完成 |
| `jsblock:main` | `jsBlockCollector.ts` | 检测到主线程 JS 阻塞 |
| `bgcall:*` | 各处 | 后台 API 调用 |
| `storage:*` | 各处 | Storage 读写操作 |
| `simpledb:*` | 各处 | SimpleDB 操作 |

### 推荐新增 Marks（待插桩）

| Mark 名称 | 添加位置 | 用途 |
|-----------|---------|------|
| `TokenDetail:mount` | Token 详情页 | 页面打开计时 |
| `TokenDetail:chart:done` | 图表组件 | 图表渲染完成 |
| `TokenDetail:scroll:start/end` | 历史标签页滚动 | 滚动 FPS 关联 |
| `Send:mount` | 发送页面 | 发送流程开始 |
| `Send:confirm:mount` | 确认页面 | 确认页计时 |
| `Send:broadcast:done` | 广播后 | 交易完成 |
| `Swap:mount` | Swap 页面 | Swap 页面打开 |
| `Swap:quote:start` / `Swap:quote:done` | 报价逻辑 | 报价计时 |
| `Swap:tokenSelect:scroll:start/end` | Token 选择器滚动 | 滚动 FPS 关联 |
| `Market:mount` | 行情页面 | 行情页打开 |
| `Market:list:done` | 列表渲染后 | 列表渲染计时 |
| `Market:scroll:start/end` | Token 列表滚动 | 滚动 FPS 关联 |
| `MarketDetail:mount` | 行情详情 | 详情页打开 |
| `MarketDetail:chart:done` | 图表组件 | 图表渲染完成 |
| `Discovery:mount` | 发现页面 | 发现页打开 |
| `Discovery:webview:loaded` | WebView | DApp 加载完成 |
| `Discovery:scroll:start/end` | DApp 列表滚动 | 滚动 FPS 关联 |
| `Earn:mount` | 理财页面 | 理财页打开 |
| `Earn:protocols:done` | 协议列表后 | 协议列表已渲染 |
| `Earn:scroll:start/end` | 协议列表滚动 | 滚动 FPS 关联 |
| `Settings:mount` | 设置页面 | 设置页打开 |
| `Settings:scroll:start/end` | 设置列表滚动 | 滚动 FPS 关联 |
| `AccountSelector:mount` | 账户选择器 | 选择器打开 |
| `AccountSelector:switch:done` | 切换后 | 账户切换完成 |
| `AccountSelector:scroll:start/end` | 账户列表滚动 | 滚动 FPS 关联 |
| `Onboarding:mount` | 引导开始 | 引导流程开始 |
| `Onboarding:wallet:created` | 创建后 | 钱包创建完成 |
| `DAppConnect:mount` | 连接授权 | 授权面板打开 |
| `History:mount` | 历史页面 | 历史页打开 |
| `History:list:done` | 列表渲染后 | 列表渲染完成 |
| `History:scroll:start/end` | 历史列表滚动 | 滚动 FPS 关联 |
| `Nav:push:start` / `Nav:push:animated` / `Nav:push:interactive` | 导航系统 | 页面转场计时 |
| `Tab:switch:start` / `Tab:switch:visible` | Tabs 容器 | 标签页切换延迟 |
| `Dialog:open` / `Dialog:ready` / `Dialog:close` | 弹窗组件 | 弹窗动画计时 |
| `PullRefresh:start` / `PullRefresh:complete` | 下拉刷新 | 刷新周期计时 |
| `Search:start` / `Search:results` | 搜索 hooks | 搜索响应计时 |
| `Clipboard:copy` / `Clipboard:toast` | useClipboard | 剪贴板操作计时 |
| `Button:press` / `Button:complete` | 按钮组件 | 按钮响应计时 |
| `WC:pairing:start` / `WC:pairing:done` | WalletConnect | WC 会话计时 |
| `DeepLink:receive` / `DeepLink:navigate` | Deep Link 处理器 | Deep Link 处理计时 |
| `Biometric:prompt` / `Biometric:done` | 认证流程 | 生物识别认证计时 |
| `Scanner:open` / `Scanner:decode` | 二维码扫描器 | 二维码扫描计时 |

---

## 参考资料

### 工具与库

- [Callstack Reassure](https://github.com/callstack/reassure) — React 和 React Native 的性能测试工具，使用渲染耗时/次数的统计对比
- [Shopify react-native-performance](https://github.com/oblador/react-native-performance) — 测量不同流程的渲染时间、导航和列表性能
- [React Native Performance Docs](https://reactnative.dev/docs/performance) — React Native 官方性能概述
- [Sentry for React Native](https://sentry.io/for/react-native/) — 生产环境错误和性能监控

### 行业实践

- [美团 Hertz](https://tech.meituan.com/2016/12/19/hertz.html) — 美团移动端性能监控方案，覆盖 FPS、CPU、内存、卡顿、页面加载和网络，贯穿开发/测试/生产阶段
- [Apache SkyWalking 动态基线](https://skywalking.apache.org/blog/2025-02-24-improving-alert-accuracy-with-dynamic-baselines/) — 使用基于 Prophet 的预测替代静态阈值，实现更精准的告警
- [Callstack 博客：性能劣化测试](https://www.callstack.com/blog/performance-regression-testing-react-native) — CI 中自动化 React Native 性能劣化测试的方法论

### 通用测试实践

- [回归测试最佳实践](https://www.testdevlab.com/blog/regression-testing-for-mobile-apps) — 移动应用回归测试综合指南
- [基线测试](https://www.virtuosoqa.com/post/baseline-testing) — 基于历史数据和 SLO 设置合适阈值
- [移动应用性能测试](https://abstracta.us/blog/performance-testing/mobile-app-performance-testing/) — 自动化和扩展移动性能测试指南
