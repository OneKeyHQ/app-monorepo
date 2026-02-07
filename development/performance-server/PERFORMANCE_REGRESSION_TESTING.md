# Performance Regression Prevention Guide

A comprehensive guide for the automated performance regression prevention system. This system runs on a **scheduled basis** (default: 3 times/day or every 6 hours via daemon), collecting performance data via Detox E2E tests across iOS and Android, comparing metrics against established baselines, and alerting the team via Slack when regressions are detected.

## Table of Contents

- [System Architecture](#system-architecture)
  - [Design Philosophy](#design-philosophy)
  - [Overall Architecture](#overall-architecture)
  - [Data Collection Pipeline](#data-collection-pipeline)
  - [Automated Scheduling](#automated-scheduling)
  - [Baseline & Threshold Management](#baseline--threshold-management)
  - [Regression Detection Strategy](#regression-detection-strategy)
  - [Alert & Notification](#alert--notification)
- [Industry Best Practices & References](#industry-best-practices--references)
- [Global Metrics (All Pages)](#global-metrics-all-pages)
- [Scroll FPS Monitoring](#scroll-fps-monitoring)
  - [FPS Collection Mechanism](#fps-collection-mechanism)
  - [Scrollable Components Inventory](#scrollable-components-inventory)
  - [Per-Page Scroll FPS Requirements](#per-page-scroll-fps-requirements)
- [Platform Legend](#platform-legend)
- [Pages & Metrics](#pages--metrics)
  - [1. App Cold Start](#1-app-cold-start)
    - [Per-Platform Cold Start Constraints](#per-platform-cold-start-constraints)
  - [2. Home / Wallet Overview](#2-home--wallet-overview)
  - [3. Token Detail](#3-token-detail)
  - [4. Send Transaction Flow](#4-send-transaction-flow)
  - [5. Receive Page](#5-receive-page)
  - [6. Swap](#6-swap)
  - [7. Market Overview](#7-market-overview)
  - [8. Market Detail](#8-market-detail)
  - [9. Discovery / DApp Browser](#9-discovery--dapp-browser)
  - [10. Earn / DeFi Overview](#10-earn--defi-overview)
  - [11. Staking Detail](#11-staking-detail)
  - [12. Settings](#12-settings)
  - [13. Account Manager / Wallet Selector](#13-account-manager--wallet-selector)
  - [14. Onboarding (Create / Import Wallet)](#14-onboarding-create--import-wallet)
  - [15. DApp Connection Approval](#15-dapp-connection-approval)
  - [16. Transaction History](#16-transaction-history)
- [Current Threshold Baselines](#current-threshold-baselines)
- [Metric Template (For Adding New Pages)](#metric-template-for-adding-new-pages)
- [Running the System](#running-the-system)
  - [Automated (Scheduled)](#automated-scheduled)
  - [Manual (Ad-hoc)](#manual-ad-hoc)
  - [Dashboard & CLI Analysis](#dashboard--cli-analysis)
- [Appendix: perfMark Naming Convention](#appendix-perfmark-naming-convention)
- [References](#references)

---

## System Architecture

### Design Philosophy

Performance regression prevention (also known as "performance degradation guard" / 性能防劣化) is a **proactive defense** system. Instead of waiting for users to report slowness, it continuously measures app performance on dedicated test machines and catches regressions **before they reach production**.

Core principles:

1. **Scheduled automation** — No human intervention required for routine checks
2. **Statistical rigor** — Run each scenario multiple times (default: 3), use median to reduce noise
3. **Baseline comparison** — Alert only when metrics exceed established thresholds (baseline + tolerance)
4. **Multi-dimensional** — Track timing (marks), throughput (function calls), frame rate (FPS), memory, and main-thread blocking (JS blocks) simultaneously
5. **Platform parity** — Same test scenarios across iOS / Android / Extension / Web / Desktop
6. **Fast feedback** — Slack alerts on regression; job reports preserved for debugging

### Overall Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Perf Regression Prevention System                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐   │
│  │  Scheduler   │     │  Detox E2E Test  │     │  Performance Server   │   │
│  │  (launchd /  │────▶│  (3 runs per job)│────▶│  (WebSocket :9527)    │   │
│  │   daemon)    │     │                  │     │                       │   │
│  └─────────────┘     └──────────────────┘     └───────────┬───────────┘   │
│                                                           │               │
│                              ┌─────────────────────────────┘               │
│                              ▼                                             │
│                    ┌──────────────────┐                                    │
│                    │  Session Storage  │                                   │
│                    │  ~/perf-sessions/ │                                   │
│                    │  (JSONL files)    │                                   │
│                    └────────┬─────────┘                                    │
│                             │                                              │
│              ┌──────────────┼──────────────┐                               │
│              ▼              ▼              ▼                               │
│    ┌──────────────┐ ┌────────────┐ ┌────────────────┐                     │
│    │ derive-session│ │ Threshold  │ │ Slack Webhook  │                     │
│    │ (CLI analyze) │ │  Compare   │ │  (alert on     │                     │
│    └──────────────┘ │ (median vs │ │   regression)  │                     │
│                     │  baseline) │ └────────────────┘                     │
│                     └────────────┘                                        │
│                                                                            │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │  Web Dashboard (http://localhost:9527)                           │    │
│    │  - Timeline flame chart    - Slow functions table                │    │
│    │  - FPS sparkline           - Repeated calls analysis            │    │
│    │  - Memory sparkline        - Key marks timeline                 │    │
│    │  - Low FPS hotspots        - Home refresh analysis              │    │
│    │  - JS block events         - Speedscope export                  │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Collection Pipeline

Each job run follows this exact sequence:

```
1. Cache cleanup (Metro caches, watchman)
       │
2. Performance server health check (auto-start if needed)
       │
3. Detox build (compile app for simulator/emulator)
       │
4. Detox test loop (N = 3 runs by default):
       │
       ├── Run 1: Launch app → wait for mark → collect session → close app
       ├── Run 2: Launch app → wait for mark → collect session → close app
       └── Run 3: Launch app → wait for mark → collect session → close app
       │
5. For each session: derive-session.js → compute derived metrics
       │
6. Aggregate: median(tokensStartMs), median(tokensSpanMs), median(functionCallCount)
       │
7. Compare aggregated values against thresholds
       │
8. Generate report.json + job-result.json
       │
9. If regression: post Slack webhook notification
```

**What each session captures:**

| Event Type | File | Content |
|------------|------|---------|
| Function calls | `function_call.log` | Every function invocation: name, file, line, duration, module, stack |
| Performance marks | `mark.log` | Named checkpoints: `app:start`, `Home:refresh:*`, `AllNet:*`, etc. |
| FPS samples | `fps.log` | Frame rate measured every 100ms via requestAnimationFrame |
| Memory samples | `memory.log` | JS heap (heapUsed, heapTotal, RSS) sampled periodically |
| Module loads | `module_load.log` | Module load events with timing |
| JS blocks | Embedded in `mark.log` | Main thread blocking events (`jsblock:*`) detected via 50ms interval timer |
| All events | `all.log` | Combined stream of all event types |
| Session metadata | `meta.json` | Platform, start time, event counts, key marks |

### Automated Scheduling

The system supports three scheduling modes:

#### Mode 1: launchd (macOS, recommended for dedicated test machines)

Pre-configured plist templates in `development/perf-ci/launchd/`:

- **`perf-server.plist`** — Keeps performance server running permanently (`KeepAlive: true`, `RunAtLoad: true`)
- **`ios-perf-job.plist`** — Runs perf job at **09:00, 14:00, 19:00** daily

```bash
# Install (one-time setup)
cp development/perf-ci/launchd/perf-server.plist \
  "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
cp development/perf-ci/launchd/ios-perf-job.plist \
  "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"

# Edit: replace __REPO_ROOT__ and __HOME_DIR__ in both files

# Load
UID="$(id -u)"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
```

#### Mode 2: Daemon process (cross-platform)

Runs continuously, executing jobs at a fixed interval (default: 6 hours):

```bash
# iOS release, every 5 hours
yarn perf:ios:release:daemon --interval-minutes 300

# Android release, every 6 hours (default)
yarn perf:android:release:daemon
```

The daemon:
- Runs in headless mode (no simulator UI)
- Manages perf-server lifecycle automatically
- Survives individual job failures (continues to next interval)
- Responds to SIGINT/SIGTERM for graceful shutdown

#### Mode 3: CI/CD pipeline integration (future)

Can be integrated into GitHub Actions or other CI systems:

```bash
# In CI workflow
yarn perf:ios:release
# Exit code: 0 = ok, 3 = regression detected, 2 = error
```

### Baseline & Threshold Management

Thresholds are stored as JSON files in `development/perf-ci/thresholds/`:

| File | Platform | Build Mode |
|------|----------|------------|
| `ios.release.json` | iOS Simulator | Release (no Metro) |
| `ios.debug.json` | iOS Simulator | Debug (with Metro) |
| `android.release.json` | Android Emulator | Release |
| `android.debug.json` | Android Emulator | Debug |

**Threshold structure:**

```json
{
  "_comment": "Description of what the thresholds represent",
  "_baseline_note": "Source sessions + tolerance applied",
  "tokensStartMs": 3948,
  "tokensSpanMs": 2550,
  "functionCallCount": 671,
  "strategy": "median"
}
```

**How to establish a new baseline:**

1. Run 3+ perf jobs on the stable branch (e.g. `x`)
2. Collect the median of each metric
3. Apply +10% tolerance buffer
4. Write to the corresponding threshold file
5. Commit to the repo

**When to update baselines:**

- After intentional performance improvements (lower the thresholds)
- After expected performance changes (e.g. adding a new feature that legitimately adds function calls)
- Periodically recalibrate if the test machine hardware changes

### Regression Detection Strategy

Two strategies are supported:

#### Strategy: `median` (default)

```
For each metric:
  if median(run1, run2, run3) > threshold → REGRESSION
```

Best for stable environments. Median naturally filters outliers (1 bad run out of 3 is ignored).

#### Strategy: `two_of_three`

```
For each metric:
  if count(runs where value > threshold) >= 2 → REGRESSION
```

More sensitive — flags regression if 2 out of 3 runs exceed the threshold. Useful when you want earlier detection at the cost of occasional false positives.

**Why multiple runs matter:**

| Approach | Pros | Cons |
|----------|------|------|
| Single run | Fast | Noisy: GC pauses, background processes can cause false positives |
| 3 runs + median | Balanced | Standard approach, proven in industry (used by Callstack Reassure, Meta) |
| 5+ runs + p95 | Most accurate | Slow, resource-intensive |

### Alert & Notification

When a regression is detected, the system sends a Slack message:

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

Alert routing:
- **Regression detected** → Slack alert sent
- **Job failure** (Detox crash, server down, etc.) → Slack alert sent
- **Normal (no regression)** → No alert (quiet success)

---

## Industry Best Practices & References

Our system design draws from proven approaches at major tech companies. Below is a summary of industry practices that inform our design decisions.

### The Performance Regression Prevention Pyramid

```
                    ┌─────────────────┐
                    │   Production    │  ← Sentry, APM, real user monitoring
                    │   Monitoring    │     (last line of defense)
                    ├─────────────────┤
                    │   Scheduled     │  ← THIS SYSTEM
                    │   Regression    │     Detox + perf-server + thresholds
                    │   Guard         │     (catch before release)
                    ├─────────────────┤
                    │   PR/CI         │  ← Per-PR perf check
                    │   Performance   │     (catch before merge)
                    │   Check         │
                    ├─────────────────┤
                    │   Developer     │  ← Perf dashboard, profiling
                    │   Tools         │     (catch during development)
                    └─────────────────┘
```

### Key Principles from Industry

**1. Baseline + Tolerance model (used by Meta, ByteDance, Meituan)**

Establish baseline metrics from stable builds, then alert when new builds deviate beyond a tolerance threshold. ByteDance's Douyin team applies this for startup time, FPS, memory, and ANR rate. Meituan's Hertz system monitors FPS, CPU, memory, lag, and page load times across development/testing/production stages.

**2. Statistical aggregation to reduce noise (used by Callstack Reassure)**

Reassure, the open-source React Native performance testing companion from Callstack, runs scenarios multiple times and applies statistical analysis to determine if changes are significant. They recommend checking machine stability first — random variations should be below 5%, with 10%+ indicating the test environment is too noisy.

**3. Multi-run median strategy**

Running 3 times and taking the median is a proven technique to filter out GC pauses, background process interference, and other transient noise. This is more reliable than single-run measurements while being practical for CI time budgets.

**4. Trace Diff for root cause analysis**

ByteDance developed a Trace Diff approach for HarmonyOS that correlates static code changes with dynamic performance trace differences, pinpointing regressions to specific function-level changes. Our `derive-session.js` provides similar function-level hotspot analysis.

**5. Hierarchical monitoring (used by Meituan Hertz)**

Meituan's mobile performance monitoring covers three phases:
- **Development phase**: Offline detection tool integrated into the app, showing FPS/CPU/memory as a floating overlay
- **Testing phase**: Combined with test tools to generate performance reports
- **Production phase**: Monitoring platform for real user data reporting

Our system covers the first two phases, with Sentry serving as the production monitoring layer.

**6. Dynamic baselines (Apache SkyWalking)**

Advanced systems use dynamic baselines that auto-adjust based on historical data trends, rather than static thresholds. This reduces false positives from seasonal patterns. Our system currently uses static thresholds with manual recalibration, but could evolve to dynamic baselines.

**7. Shopify's React Native Performance Profiler**

Shopify contributed `react-native-performance` for measuring render times across different app flows, plus specific libraries for navigation and list performance measurement. This aligns with our function-call-level instrumentation approach.

### How We Compare

| Capability | Our System | Reassure | Meta (internal) | ByteDance (Douyin) |
|------------|:---:|:---:|:---:|:---:|
| Automated scheduled runs | Yes (launchd/daemon) | CI only | CI + scheduled | CI + scheduled |
| E2E testing (real app) | Yes (Detox) | No (component-level) | Yes | Yes |
| Function-level profiling | Yes (Babel plugin) | No | Yes | Yes |
| FPS monitoring | Yes (rAF) | No | Yes | Yes |
| Memory monitoring | Yes | No | Yes | Yes |
| JS block detection | Yes | No | N/A | Yes |
| Mark-based timing | Yes | No | Yes | Yes |
| Multi-run aggregation | Yes (3 runs, median) | Yes (configurable) | Yes | Yes |
| Slack/webhook alerts | Yes | GitHub PR comment | Internal | Internal |
| Web dashboard | Yes | Markdown report | Internal | Internal |
| Speedscope export | Yes | No | Internal | Internal |

---

## Global Metrics (All Pages)

These metrics apply to every page and should be checked on every test session:

| Metric | Description | Collect Via | Regression Threshold |
|--------|-------------|-------------|---------------------|
| **FPS** | Frames per second during page interaction | `fps.log` (100ms sample interval) | Any window where FPS < 30 for > 500ms |
| **Scroll FPS** | Frame rate specifically during list/content scrolling | `fps.log` correlated with scroll marks | See [Scroll FPS Monitoring](#scroll-fps-monitoring) |
| **JS Block** | Main thread blocking events | `jsblock:*` marks (50ms check interval, 200ms report threshold) | Any block > 200ms |
| **Memory (Heap)** | JS heap usage | `memory.log` | Heap growing > 20% vs baseline after same operation |
| **Function Call Count** | Total function invocations | `function_call.log` line count | > 15% increase vs baseline for same scenario |
| **Slow Functions (p95)** | Functions with p95 duration > 16ms (one frame budget) | `/api/sessions/:id/slow-functions` | New function in top-50, or existing p95 > 25% increase |
| **Repeated Rapid Calls** | Same function called within 100ms window | `/api/sessions/:id/repeated-calls?mode=rapid` | New repeated call pattern appearing |
| **Storage I/O** | AsyncStorage read/write operations | `storage:*` marks | Total duration > 30% increase |
| **SimpleDB I/O** | SimpleDB CRUD operations | `simpledb:*` marks | Total duration > 30% increase |
| **Navigation Transition FPS** | FPS during any page navigation animation (250ms modal) | FPS samples during transition | Drop below 40 fps |
| **Dialog Animation FPS** | FPS during any dialog open/close animation (300ms) | FPS samples during animation | Drop below 40 fps |
| **Toast Appearance** | Time from trigger to toast visible on screen | Interaction timing | > 200ms |
| **Image Load (Cached)** | Time from render to cached image visible | Interaction timing | > 100ms |
| **Clipboard Copy → Toast** | Time from copy action to confirmation toast | Interaction timing | > 500ms |

---

## Scroll FPS Monitoring

Scroll performance is one of the most user-perceptible performance indicators. A janky scroll directly impacts user experience and perceived app quality.

### FPS Collection Mechanism

The FPS collector (`packages/shared/src/performance/collectors/fpsCollector.ts`) uses `requestAnimationFrame` to measure frame rate:

- **Sample interval**: Every 100ms, the collector reports current FPS
- **Calculation**: `fps = Math.round((frameCount * 1000) / elapsed)`
- **Target frame rate**: 60 FPS (16.67ms per frame budget)
- **Max cap**: 240 FPS (filters out unreliable measurements)
- **Dropped frames**: `dropped = max(0, 60 - fps)`

**How FPS data flows:**

```
requestAnimationFrame loop (100ms intervals)
    │
    ▼
__perfReportFPS({ fps, dropped })
    │
    ▼
WebSocket → Performance Server
    │
    ▼
fps.log (JSONL, per session)
    │
    ▼
Dashboard sparkline + Low FPS Hotspot analysis
```

### Scrollable Components Inventory

All pages that contain scrollable elements and their underlying scroll component:

| Page | Scrollable Element | Component | Library |
|------|-------------------|-----------|---------|
| **Home (Token List)** | Token/asset list | `Tabs.FlatList` via `TokenListView` → `ListView` | FlashList (native) / FlatList (web) |
| **Home (NFT Grid)** | NFT grid | `Tabs.FlatList` via `NFTListView` | FlashList, multi-column |
| **Home (History)** | Transaction history | `Tabs.SectionList` via `TxHistoryListView` | SectionList with date headers |
| **Home (Approvals)** | Approval list | `Tabs.FlatList` | FlashList |
| **Home (Container)** | Collapsible header + tabs | `Tabs.Container` | react-native-collapsible-tab-view |
| **Token Detail** | Detail tabs (history/holders) | `Tabs` (CollapsibleTabView) | react-native-collapsible-tab-view |
| **Market Overview** | Token price list | `FlatList` via `MobileMarketTokenFlatList` | FlatList with pagination (20/page) |
| **Market Detail** | Detail content | ScrollView + Chart | TradingView + ScrollView |
| **Swap Token Selector** | Token list with search | `ListView` | FlashList |
| **Discovery DApp List** | DApp directory | `ListView` | FlashList |
| **Discovery Browser** | WebView content | WebView internal scroll | Platform WebView |
| **Earn Protocol List** | Protocol cards | `ListView` | FlashList |
| **Staking Detail** | Protocol info | ScrollView | ScrollView |
| **Settings** | Settings list | `ListView` | FlashList |
| **Account Selector** | Account/wallet list | `SortableSectionList` | react-beautiful-dnd / react-native-draggable-flatlist |
| **Chain Selector** | Chain list | `SectionList` with `useFlashList` | FlashList |
| **Address Book** | Address list | `SectionList` | SectionList |
| **Notifications** | Notification list | `ListView` | FlashList |
| **Swap History** | Swap tx history | `ListView` | FlashList |
| **Universal Search** | Search results | `ListView` | FlashList |

### Per-Page Scroll FPS Requirements

**Mobile (React Native) targets:**

| Scroll Scenario | Minimum FPS | Dropped Frame Threshold | Notes |
|-----------------|:-----------:|:----------------------:|-------|
| Token list fast scroll | >= 50 fps | <= 10 dropped/s | FlashList with `windowSize=5` |
| Token list slow scroll | >= 55 fps | <= 5 dropped/s | Normal browsing speed |
| NFT grid scroll | >= 45 fps | <= 15 dropped/s | Multi-column grid is heavier |
| Transaction history scroll | >= 50 fps | <= 10 dropped/s | SectionList with date headers |
| Market token list scroll | >= 50 fps | <= 10 dropped/s | FlatList with sparkline charts |
| Collapsible header collapse/expand | >= 50 fps | <= 10 dropped/s | Animated header transition |
| Account selector scroll | >= 55 fps | <= 5 dropped/s | Lightweight list items |
| Chain selector scroll | >= 55 fps | <= 5 dropped/s | Simple icon + text items |
| Swap token selector scroll | >= 50 fps | <= 10 dropped/s | Token items with balance |
| Settings list scroll | >= 58 fps | <= 2 dropped/s | Static items, should be near-perfect |
| WebView (DApp) scroll | >= 45 fps | <= 15 dropped/s | Depends on DApp content |

**Desktop / Web / Extension targets:**

| Scroll Scenario | Minimum FPS | Notes |
|-----------------|:-----------:|-------|
| Any virtualized list scroll | >= 55 fps | Larger viewport = more items visible |
| Any non-virtualized scroll | >= 58 fps | Static content should be smooth |
| Chart interaction (pan/zoom) | >= 50 fps | TradingView rendering |

**Regression detection for scroll FPS:**

```
For each scrollable scenario:
  1. Record FPS samples during automated scroll action
  2. Compute: avg FPS, min FPS, p5 FPS, dropped frame count
  3. Compare with baseline:
     - avg FPS drop > 10% → WARNING
     - avg FPS drop > 20% → REGRESSION
     - min FPS < 20 (new occurrence) → REGRESSION
     - Any sustained window (>500ms) below 30 FPS → REGRESSION
```

### Recommended perfMark Instrumentation for Scroll FPS

To correlate FPS drops with scroll actions, add marks around scroll interactions:

```typescript
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

// Before triggering automated scroll
perfMark('scroll:start:TokenList');
// ... scroll action ...
perfMark('scroll:end:TokenList');

// The perf server can then correlate fps.log data within this time window
```

---

## Platform Legend

| Abbr | Platform | Notes |
|------|----------|-------|
| **M** | Mobile (iOS / Android) | React Native, Hermes engine, FlashList for lists |
| **E** | Extension (Chrome / Firefox) | Popup (550x600) + Side Panel + Full Page modes |
| **W** | Web | Standard browser tab, react-virtualized for tab lists |
| **D** | Desktop | Electron app, same rendering engine as web |

---

## Pages & Metrics

### 1. App Cold Start

**Platforms**: M / E / W / D

**Description**: From process launch to the first interactive frame of the Home page. This is the single most critical flow for user-perceived performance and the primary target of our automated regression guard.

**perfMark checkpoints**:
- `app:start` — JS execution begins
- `Home:overview:mount` — Home component mounts
- `Home:refresh:start:tokens` — Token data fetch begins
- `Home:refresh:done:tokens` — Token data fetch & render complete

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Time to Interactive (TTI)** | `app:start` → `Home:overview:mount` | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | > 20% increase |
| **Tokens Start (tokensStartMs)** | Timestamp of `Home:refresh:start:tokens` since session start | iOS release: < 3948ms, Android release: < 3101ms | Median > threshold |
| **Tokens Span (tokensSpanMs)** | `Home:refresh:start:tokens` → `Home:refresh:done:tokens` | iOS release: < 2550ms, Android release: < 4898ms | Median > threshold |
| **Function Call Count** | Total lines in `function_call.log` | iOS release: < 671, Android release: < 899 | Median > threshold |
| **Module Load Count** | `module_load.log` count | Baseline ± 5% | > 10% increase |
| **Module Load Total Duration** | Sum of all module_load durations | Baseline ± 10% | > 20% increase |
| **JS Block Events** | `jsblock:*` marks during startup | 0 blocks > 300ms | Any new block > 300ms |
| **Memory at Idle** | Heap after Home is fully loaded and idle (5s) | M: < 150MB, D/W/E: < 200MB | > 20% increase |

| **Deep Link → Target Page** | URL scheme/universal link → target page visible | M: < 3000ms, D/W/E: < 2000ms | > 25% increase |
| **Deep Link Parse** | Receive URL → parsed and route determined | < 50ms all platforms | > 100ms |

**Platform-specific notes**:
- **Mobile**: Also measure native splash screen dismiss → `app:start` gap if instrumented. Deep links add ~200ms overhead for route parsing.
- **Extension**: Measure popup open time separately (popup has its own cold start)
- **Desktop**: Measure Electron main process ready → renderer `app:start`

#### Per-Platform Cold Start Constraints

Below are detailed cold start phase constraints broken down by platform. Each platform has a different startup flow, so the phases and target values differ accordingly.

##### iOS (Mobile)

| Phase | Measurement | Release Target | Debug Target | Regression Threshold |
|-------|------------|---------------|-------------|---------------------|
| **Native Launch → JS Execution** | Splash dismiss → `app:start` | < 500ms | < 1500ms | > 30% increase |
| **JS Bundle Load** | Hermes bytecode load time | < 300ms | < 800ms (with Metro) | > 25% increase |
| **JS Execution → Home Mount** | `app:start` → `Home:overview:mount` | < 2000ms | < 5000ms | > 20% increase |
| **Tokens Start Time** | `Home:refresh:start:tokens` since session start | < 3948ms | < 10858ms | Median > threshold |
| **Tokens Load Duration** | `start:tokens` → `done:tokens` | < 2550ms | < 3403ms | Median > threshold |
| **End-to-End TTI** | Process launch → Home interactive | < 4000ms | < 12000ms | > 20% increase |
| **Function Call Count** | `function_call.log` line count | < 671 | < 942 | Median > threshold |
| **JS Blocks During Startup** | `jsblock:*` marks (> 300ms) | 0 | 0 | Any new block |
| **Idle Memory** | Heap after Home loaded and idle 5s | < 150MB | < 200MB | > 20% increase |

##### Android (Mobile)

| Phase | Measurement | Release Target | Debug Target | Regression Threshold |
|-------|------------|---------------|-------------|---------------------|
| **Native Launch → JS Execution** | Activity creation → `app:start` | < 600ms | < 2000ms | > 30% increase |
| **JS Bundle Load** | Hermes bytecode load time | < 400ms | < 1200ms (with Metro) | > 25% increase |
| **JS Execution → Home Mount** | `app:start` → `Home:overview:mount` | < 2000ms | < 6000ms | > 20% increase |
| **Tokens Start Time** | `Home:refresh:start:tokens` since session start | < 3101ms | < 14965ms | Median > threshold |
| **Tokens Load Duration** | `start:tokens` → `done:tokens` | < 4898ms | < 8467ms | Median > threshold |
| **End-to-End TTI** | Process launch → Home interactive | < 5000ms | < 16000ms | > 20% increase |
| **Function Call Count** | `function_call.log` line count | < 899 | < 1784 | Median > threshold |
| **JS Blocks During Startup** | `jsblock:*` marks (> 300ms) | 0 | 0 | Any new block |
| **Idle Memory** | Heap after Home loaded and idle 5s | < 180MB | < 250MB | > 20% increase |

> **Note**: Android Debug thresholds are significantly higher than Release due to Metro + Babel instrumentation overhead. Optimization efforts should be benchmarked against Release builds.

##### Browser Extension

The extension has two cold start scenarios: **Popup open** and **Side Panel / Full Page open**.

| Phase | Measurement | Popup Target | Side Panel / Full Page Target | Regression Threshold |
|-------|------------|-------------|-------------------------------|---------------------|
| **Service Worker Activation** | SW registration → `app:start` | < 200ms | < 200ms | > 50% increase |
| **JS Bundle Parse & Execute** | Script load → framework ready | < 400ms | < 500ms | > 25% increase |
| **JS Execution → Home Mount** | `app:start` → `Home:overview:mount` | < 1500ms | < 1500ms | > 20% increase |
| **Tokens Load Duration** | `start:tokens` → `done:tokens` | < 1500ms | < 1500ms | > 15% increase |
| **End-to-End TTI** | User clicks icon → Home interactive | < 2000ms | < 2500ms | > 20% increase |
| **Function Call Count** | `function_call.log` line count | < 500 | < 600 | > 15% increase |
| **JS Blocks During Startup** | `jsblock:*` marks (> 200ms) | 0 | 0 | Any new block |
| **Idle Memory** | Heap after Home loaded and idle 5s | < 100MB | < 150MB | > 20% increase |
| **Popup First Paint** | Click icon → first frame rendered | < 500ms | — | > 800ms |

> **Note**: Popup runs in a constrained 550×600 viewport — first paint speed is especially important as users expect instant responsiveness. MV3 Service Workers may need to wake from dormancy, adding cold start latency.

##### Web

| Phase | Measurement | Target | Regression Threshold |
|-------|------------|--------|---------------------|
| **HTML Document Load** | `navigationStart` → `DOMContentLoaded` | < 500ms | > 25% increase |
| **JS Bundle Parse & Execute** | Main bundle script load → framework ready | < 600ms | > 25% increase |
| **JS Execution → Home Mount** | `app:start` → `Home:overview:mount` | < 1200ms | > 20% increase |
| **Tokens Load Duration** | `start:tokens` → `done:tokens` | < 1200ms | > 15% increase |
| **End-to-End TTI** | `navigationStart` → Home interactive | < 2500ms | > 20% increase |
| **First Contentful Paint (FCP)** | `performance.getEntriesByName('first-contentful-paint')` | < 800ms | > 1200ms |
| **Largest Contentful Paint (LCP)** | `PerformanceObserver` LCP | < 1500ms | > 2000ms |
| **Cumulative Layout Shift (CLS)** | `PerformanceObserver` CLS | < 0.1 | > 0.25 |
| **First Input Delay (FID)** | `PerformanceObserver` FID | < 100ms | > 200ms |
| **Function Call Count** | `function_call.log` line count | < 500 | > 15% increase |
| **JS Blocks During Startup** | Long Tasks API (> 300ms) | 0 | Any new block |
| **Idle Memory** | Heap after Home loaded and idle 5s | < 150MB | > 20% increase |
| **JS Bundle Size** | Main bundle gzipped | < 2MB | > 10% increase |

> **Note**: Web includes Core Web Vitals (FCP, LCP, CLS, FID) as supplementary metrics. These can be collected via the browser's native Performance API without additional instrumentation. Bundle size directly impacts JS parse time and should be continuously monitored.

##### Desktop (Electron)

| Phase | Measurement | Target | Regression Threshold |
|-------|------------|--------|---------------------|
| **Electron Main Process Startup** | Process launch → main process `ready` event | < 800ms | > 25% increase |
| **Main → Renderer Ready** | `ready` → renderer `app:start` | < 500ms | > 25% increase |
| **JS Execution → Home Mount** | `app:start` → `Home:overview:mount` | < 1500ms | > 20% increase |
| **Tokens Load Duration** | `start:tokens` → `done:tokens` | < 1500ms | > 15% increase |
| **End-to-End TTI** | Process launch → Home interactive | < 3000ms | > 20% increase |
| **Window First Frame** | Process launch → `BrowserWindow` first frame visible | < 1500ms | > 2000ms |
| **Function Call Count** | `function_call.log` line count | < 600 | > 15% increase |
| **JS Blocks During Startup** | `jsblock:*` marks (> 300ms) | 0 | Any new block |
| **Idle Memory (Renderer)** | Heap after Home loaded and idle 5s | < 200MB | > 20% increase |
| **Idle Memory (Main Process)** | Heap after Home loaded and idle 5s | < 80MB | > 25% increase |
| **IPC Latency** | Main ↔ Renderer IPC round-trip | < 10ms | > 30ms |

> **Note**: Desktop requires monitoring both main and renderer process resources. The Electron main process handles window management and hardware wallet communication; the renderer process handles UI. Excessive IPC latency will cause perceptible UI jank.

##### Cross-Platform Cold Start Summary

| Metric | iOS Release | Android Release | Extension (Popup) | Web | Desktop |
|--------|:----------:|:--------------:|:-----------------:|:---:|:-------:|
| **End-to-End TTI** | < 4000ms | < 5000ms | < 2000ms | < 2500ms | < 3000ms |
| **JS → Home Mount** | < 2000ms | < 2000ms | < 1500ms | < 1200ms | < 1500ms |
| **Tokens Load** | < 2550ms | < 4898ms | < 1500ms | < 1200ms | < 1500ms |
| **Function Call Budget** | < 671 | < 899 | < 500 | < 500 | < 600 |
| **Idle Memory** | < 150MB | < 180MB | < 100MB | < 150MB | < 200MB |
| **JS Blocks (> 300ms)** | 0 | 0 | 0 | 0 | 0 |

---

### 2. Home / Wallet Overview

**Platforms**: M / E / W / D

**Route**: `ETabRoutes.Home` → `TabHome`

**Description**: The main wallet dashboard showing account balances, token list, and recent activity. Uses `Tabs.Container` (react-native-collapsible-tab-view) with multiple tabs: Portfolio (token list), NFTs (grid), History (section list), Approvals.

**perfMark checkpoints**:
- `Home:overview:mount` / `Home:overview:unmount`
- `Home:refresh:start:tokens` / `Home:refresh:done:tokens`
- `Home:done:tokens`
- `AllNet:useAllNetworkRequests:start`
- `AllNet:getAllNetworkAccounts:start` / `AllNet:getAllNetworkAccounts:done`

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Token Refresh Duration** | `Home:refresh:start:tokens` → `Home:refresh:done:tokens` | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | > 15% increase |
| **All-Network Accounts Fetch** | `AllNet:getAllNetworkAccounts:start` → `done` | < 3000ms all platforms | > 20% increase |
| **Token List Scroll FPS** | FPS during token list (FlashList) scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 30 fps for > 500ms |
| **NFT Grid Scroll FPS** | FPS during NFT grid scroll | M: >= 45 fps, D/W/E: >= 55 fps | Drop below 30 fps for > 500ms |
| **History List Scroll FPS** | FPS during tx history (SectionList) scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 30 fps for > 500ms |
| **Collapsible Header FPS** | FPS during header collapse/expand | M: >= 50 fps | Drop below 40 fps |
| **Function Calls During Refresh** | function_call count in refresh window | Baseline ± 10% | > 15% increase |
| **Top Slow Functions in Refresh** | `/api/sessions/:id/home-refresh` topFunctions | No function > 50ms p95 | New function > 50ms or existing > 25% increase |
| **Storage Operations** | `storage:*` marks during refresh | Total < 500ms | > 30% increase |
| **SimpleDB Operations** | `simpledb:*` marks during refresh | Total < 300ms | > 30% increase |
| **Background Calls** | `bgcall:*` marks during refresh | Total < 1000ms | > 25% increase |
| **Pull-to-Refresh Total** | User pulls → all data refreshed | M: < 3000ms | > 20% increase |
| **Pull-to-Refresh FPS** | FPS during pull gesture + animation (1200ms spinner) | M: >= 55 fps | Drop below 45 fps |
| **Tab Switch (Portfolio ↔ NFTs ↔ History)** | Tap tab → new content visible (100ms callback delay) | < 200ms all platforms | > 300ms |
| **Tab Switch FPS** | FPS during tab content transition | >= 50 fps all platforms | Drop below 40 fps |
| **Keyboard Open FPS (Search)** | FPS when keyboard appears for search | M: >= 45 fps | Drop below 35 fps |

**Platform-specific notes**:
- **Mobile**: Test with 50+ tokens, 5+ networks to stress token list rendering. The collapsible tab header animation is a common FPS bottleneck. Pull-to-refresh has a fixed 1200ms animation — measure total cycle including data refresh.
- **Extension Popup**: Token list in a smaller viewport — test scroll performance in 550x600 popup size
- **Web/Desktop**: Test with large screen showing all tokens without scroll; also test with virtualized scrolling via react-virtualized

---

### 3. Token Detail

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.MainModal` → `TokenDetails`

**Description**: Detail view for a single token including price chart, balance, and transaction history. Uses `Tabs` (CollapsibleTabView) with history/holders/portfolio tabs.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open (TTI)** | Navigation start → content interactive | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | > 20% increase |
| **Price Chart Render** | Chart data loaded → chart painted | < 1000ms all platforms | > 25% increase |
| **Transaction History Load** | First batch of transactions rendered | < 1500ms all platforms | > 20% increase |
| **History Scroll FPS** | FPS during transaction history SectionList scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 30 fps for > 500ms |
| **Tab Switch Latency** | Tap tab → new tab content visible (100ms callback) | < 200ms all platforms | > 300ms |
| **Tab Switch FPS** | FPS during tab switch animation | >= 50 fps all platforms | Drop below 40 fps |
| **Chart Interaction FPS** | FPS during chart pinch/zoom/pan (25ms throttle) | M: >= 45 fps, D/W/E: >= 50 fps | Drop below 30 fps |
| **Chart Crosshair Response** | Cursor/finger move → crosshair + tooltip update | < 25ms (throttled) | > 50ms |
| **Navigation Transition FPS** | FPS during modal open animation (250ms) | >= 50 fps all platforms | Drop below 40 fps |
| **Back Navigation** | Back press → Home page visible | < 300ms all platforms | > 400ms |
| **Memory Delta** | Heap increase from Home → Token Detail | < 30MB | > 50% increase |

---

### 4. Send Transaction Flow

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.SendModal` → `SendDataInput` → `SendConfirm` → `SendFeedback`

**Description**: Full send flow from entering recipient to transaction broadcast confirmation.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Send Page Open** | Navigation → SendDataInput interactive | M: < 600ms, E: < 500ms, W: < 400ms, D: < 500ms | > 20% increase |
| **Address Validation** | Input complete → validation result | < 500ms all platforms | > 30% increase |
| **Fee Estimation** | Request → fee options displayed | < 2000ms all platforms | > 25% increase |
| **Token Selector Open** | Tap → token list rendered | < 500ms all platforms | > 30% increase |
| **Token Selector Scroll FPS** | FPS during token list scroll in selector | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **Confirm Page Load** | SendDataInput submit → SendConfirm interactive | < 800ms all platforms | > 20% increase |
| **Transaction Sign & Broadcast** | Confirm → SendFeedback (success/fail) | < 3000ms (excl. hardware) | > 25% increase |
| **FPS During Input** | FPS while typing address/amount | >= 55 fps all platforms | Drop below 45 fps |
| **Keyboard Open FPS** | FPS when keyboard appears for address/amount input | M: >= 45 fps | Drop below 35 fps |
| **Keyboard Close FPS** | FPS when keyboard dismisses | M: >= 45 fps | Drop below 35 fps |
| **Navigation Transition (→ Confirm)** | Send form submit → confirm page animation complete (250ms) | < 400ms all platforms | > 500ms |
| **Send Button Response** | Confirm button tap → action initiated | < 100ms all platforms | > 200ms |
| **Clipboard Paste → Address Fill** | Paste address → field populated + validated | < 300ms all platforms | > 500ms |
| **Confirmation Dialog FPS** | FPS during send confirmation dialog animation (300ms) | >= 50 fps | Drop below 40 fps |

**Platform-specific notes**:
- **Mobile**: Test keyboard open/close impact on FPS — address/amount inputs trigger layout reflow
- **Extension Popup**: Form layout in compact viewport
- **All**: Hardware wallet signing is excluded from broadcast timing — measure software wallet only

---

### 5. Receive Page

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.ReceiveModal` → `ReceiveToken`

**Description**: Display receive address with QR code.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open** | Navigation → QR code visible | M: < 500ms, E: < 400ms, W: < 300ms, D: < 400ms | > 25% increase |
| **QR Code Render** | Address ready → QR drawn | < 200ms all platforms | > 50% increase |
| **Address Derivation** | For HD wallets, time to derive address | < 1000ms all platforms | > 30% increase |
| **Copy Address (Clipboard)** | Tap copy → address in clipboard + toast visible | < 300ms all platforms | > 500ms |
| **Navigation Transition FPS** | FPS during modal open animation (250ms) | >= 50 fps all platforms | Drop below 40 fps |

---

### 6. Swap

**Platforms**: M / E / W / D

**Route**: `ETabRoutes.Swap` → `TabSwap`, `EModalRoutes.SwapModal` → `SwapMainLand`

**Description**: Token swap interface with quote fetching, provider selection, and transaction execution.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open** | Navigation → swap form interactive | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | > 20% increase |
| **Quote Fetch** | Amount entered → first quote displayed | < 3000ms all platforms | > 20% increase |
| **Token Selector Open** | Tap → token list rendered with balances | < 600ms all platforms | > 30% increase |
| **Token Selector Scroll FPS** | FPS during token selector list scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **Token Search** | Keystroke → filtered results (50ms debounce) | < 200ms all platforms | > 50% increase |
| **Provider Comparison Load** | Quote done → provider list rendered | < 1000ms all platforms | > 25% increase |
| **Provider List Scroll FPS** | FPS during provider list scroll | >= 55 fps all platforms | Drop below 45 fps |
| **Swap Confirm Page** | Submit → confirm page interactive | < 500ms all platforms | > 25% increase |
| **History List Scroll FPS** | FPS during swap history list scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **FPS During Interaction** | FPS while interacting with swap form | >= 55 fps all platforms | Drop below 45 fps |
| **Swap Confirm Button Response** | Confirm tap → transaction initiated | < 100ms all platforms | > 200ms |
| **Keyboard Open FPS (Amount Input)** | FPS when keyboard appears for amount entry | M: >= 45 fps | Drop below 35 fps |
| **Navigation Transition FPS** | FPS during modal push/pop animations (250ms) | >= 50 fps all platforms | Drop below 40 fps |

---

### 7. Market Overview

**Platforms**: D / W / E (hidden on Mobile tab, accessible via Discovery)

**Route**: `ETabRoutes.Market` → `TabMarket`

**Description**: Crypto market overview with sortable token list and price sparklines. Uses `FlatList` with pagination (20 items/page) on mobile.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open (TTI)** | Tab switch → first token list rendered | D: < 1000ms, W: < 800ms, E: < 1000ms | > 20% increase |
| **Full List Render** | All visible rows rendered | < 2000ms all platforms | > 20% increase |
| **Token List Scroll FPS** | FPS during market token list scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps for > 500ms |
| **Scroll with Sparklines FPS** | FPS during scroll (sparkline charts rendering) | M: >= 45 fps, D/W/E: >= 50 fps | Drop below 35 fps |
| **Sort Operation** | Column header tap → list re-sorted | < 300ms all platforms | > 50% increase |
| **Search** | Keystroke → filtered results (50ms debounce) | < 200ms all platforms | > 50% increase |
| **Sort Tap Response** | Column header tap → visual feedback | < 50ms all platforms | > 100ms |
| **Pagination Load** | Scroll to bottom → next 20 items loaded | < 500ms all platforms | > 30% increase |
| **Image Load (Token Icons)** | Token icon cache hit → visible | < 50ms (cached), < 500ms (network) | > 30% increase |
| **Memory Footprint** | Heap after loading 500+ tokens | < 80MB (incremental over baseline) | > 30% increase |

**Platform-specific notes**:
- **Extension Popup**: Market is limited view — test in full-page mode for full list
- **Web/Desktop**: Test with large lists (500+ tokens) to stress virtualization

---

### 8. Market Detail

**Platforms**: M / D / W / E

**Route**: `EModalRoutes.MarketModal` → `MarketDetailV2`

**Description**: Token detail with TradingView chart, stats, and trading info.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open** | Navigation → basic info visible | M: < 800ms, E: < 700ms, W: < 600ms, D: < 700ms | > 20% increase |
| **Chart Load** | Page open → TradingView chart interactive | < 2000ms all platforms | > 25% increase |
| **Chart Timeframe Switch** | Tap timeframe → chart redrawn | < 1000ms all platforms | > 30% increase |
| **Chart Pan/Zoom FPS** | FPS during chart pinch/zoom/pan (25ms hover throttle) | M: >= 45 fps, D/W/E: >= 50 fps | Drop below 30 fps |
| **Chart Crosshair Response** | Move → crosshair + tooltip update (25ms throttle) | < 25ms | > 50ms |
| **Chart Data Update** | New data → chart re-render (30ms debounce) | < 100ms all platforms | > 200ms |
| **Content Scroll FPS** | FPS during page content scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **Memory Delta** | Heap increase from Market → Market Detail | < 50MB | > 40% increase |

---

### 9. Discovery / DApp Browser

**Platforms**: M / E / W / D

**Route**: `ETabRoutes.Discovery` → `TabDiscovery`

**Description**: DApp browser with search, bookmarks, and embedded WebView.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Discovery Page Open** | Tab switch → DApp list rendered | M: < 800ms, E: < 600ms, W: < 500ms, D: < 600ms | > 20% increase |
| **DApp List Scroll FPS** | FPS scrolling DApp directory list | M: >= 55 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **DApp Search** | Keystroke → search results | < 300ms all platforms | > 50% increase |
| **WebView Load** | DApp selected → WebView content loaded | M: < 3000ms, D/W/E: < 2000ms | > 25% increase |
| **WebView Content Scroll FPS** | FPS scrolling within loaded DApp | M: >= 45 fps, D/W/E: >= 50 fps | Drop below 30 fps |
| **Tab Switch (Browser)** | Switch between open DApp tabs | < 500ms all platforms | > 30% increase |
| **Bookmark List Scroll FPS** | FPS scrolling bookmark list | >= 55 fps all platforms | Drop below 45 fps |
| **Memory Per Tab** | Heap increase per open DApp tab | M: < 50MB, D/W/E: < 80MB | > 40% increase |
| **DApp Injection Time** | Provider injection into WebView | < 500ms all platforms | > 50% increase |
| **Tab Switch (Browser Tabs)** | Switch between open DApp tabs | < 500ms all platforms | > 30% increase |
| **DApp Search Response** | Keystroke → search results (50ms debounce) | < 300ms all platforms | > 50% increase |

**Platform-specific notes**:
- **Mobile**: WebView is heavy — monitor memory carefully with multiple tabs
- **Extension**: DApp browser runs in full-page mode only
- **Desktop/Web**: Support multi-tab browser — test with 5+ tabs open

---

### 10. Earn / DeFi Overview

**Platforms**: D / W (on Mobile accessible via Discovery embed)

**Route**: `ETabRoutes.Earn` → `EarnHome`, `EarnProtocols`

**Description**: DeFi earning opportunities, staking protocols, and portfolio overview.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open (TTI)** | Tab switch → protocol list rendered | D: < 1200ms, W: < 1000ms | > 20% increase |
| **Protocol List Load** | API response → full list rendered | < 2000ms all platforms | > 20% increase |
| **Protocol List Scroll FPS** | FPS during protocol card list scroll | >= 55 fps | Drop below 40 fps |
| **Filter/Sort** | Apply filter → list updated | < 300ms | > 50% increase |
| **Filter Tap Response** | Tap filter → visual feedback | < 50ms | > 100ms |
| **Portfolio Data Load** | Page open → portfolio values displayed | < 2000ms | > 25% increase |
| **Protocol Card Tap → Detail** | Tap card → detail page navigation (250ms animation) | < 400ms | > 500ms |
| **Navigation Transition FPS** | FPS during detail page push animation | >= 50 fps | Drop below 40 fps |

---

### 11. Staking Detail

**Platforms**: M / D / W / E

**Route**: `EModalRoutes.StakingModal` → `ProtocolDetails`, `Stake`, `Withdraw`

**Description**: Staking protocol detail with position management, staking, and withdrawal flows.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Protocol Detail Open** | Navigation → protocol info rendered | < 800ms all platforms | > 20% increase |
| **APY / Stats Load** | Page open → yield data displayed | < 1500ms all platforms | > 25% increase |
| **Detail Content Scroll FPS** | FPS during protocol detail ScrollView scroll | M: >= 55 fps, D/W/E: >= 58 fps | Drop below 45 fps |
| **Stake Form Open** | Tap Stake → form interactive | < 500ms all platforms | > 30% increase |
| **Stake Preview Calculation** | Amount input → expected reward shown | < 1000ms all platforms | > 30% increase |
| **Withdraw Form Open** | Tap Withdraw → form interactive | < 500ms all platforms | > 30% increase |
| **Stake Button Response** | Confirm stake tap → transaction initiated | < 100ms all platforms | > 200ms |
| **Navigation Transition FPS** | FPS during modal push/pop animations (250ms) | >= 50 fps all platforms | Drop below 40 fps |
| **Keyboard Open FPS (Amount Input)** | FPS when keyboard appears for stake/withdraw amount | M: >= 45 fps | Drop below 35 fps |

---

### 12. Settings

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.SettingModal` → `SettingListModal`

**Description**: App settings list with various configuration options.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open** | Navigation → settings list rendered | < 400ms all platforms | > 30% increase |
| **Settings List Scroll FPS** | FPS during settings list scroll | >= 58 fps all platforms | Drop below 50 fps |
| **Sub-page Navigation** | Tap item → sub-page rendered | < 300ms all platforms | > 30% increase |
| **Clear Cache Operation** | Tap clear → operation complete | < 3000ms all platforms | > 30% increase |
| **Custom RPC Save** | Save RPC URL → validated and saved | < 1000ms all platforms | > 30% increase |
| **Biometric Prompt Appear** | Tap biometric setting → native dialog visible | < 200ms (native OS) | > 400ms |
| **Biometric → Unlock** | Successful scan → action authorized | < 100ms (post-scan) | > 300ms |
| **Navigation Transition FPS** | FPS during settings sub-page navigation (250ms) | >= 50 fps all platforms | Drop below 40 fps |

---

### 13. Account Manager / Wallet Selector

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.AccountManagerStacks` → `AccountSelectorStack`

**Description**: Account and wallet selection overlay, including multi-account management. Uses `SortableSectionList` (drag-and-drop enabled).

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Selector Open** | Tap account → selector sheet visible | M: < 500ms, E: < 400ms, W: < 300ms, D: < 400ms | > 25% increase |
| **Account List Render** | Selector open → all accounts rendered | < 800ms (with 20+ accounts) | > 20% increase |
| **Account List Scroll FPS** | FPS scrolling account/wallet list | >= 55 fps all platforms | Drop below 40 fps |
| **Drag Reorder FPS** | FPS during drag-and-drop reorder | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 40 fps |
| **Account Switch** | Tap account → Home refreshed with new data | < 2000ms all platforms | > 20% increase |
| **Batch Account Creation** | Submit → accounts created | < 5000ms for 10 accounts | > 25% increase |
| **Selector Open Animation FPS** | FPS during bottom sheet open animation (300ms) | >= 50 fps all platforms | Drop below 40 fps |
| **Drag Start Response** | Long press → drag handle active | < 200ms all platforms | > 300ms |

---

### 14. Onboarding (Create / Import Wallet)

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.OnboardingV2` → `GetStarted` → `CreateOrImportWallet` → ...

**Description**: New user wallet creation and import flows.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Onboarding Start** | App first launch → GetStarted visible | M: < 2000ms, E: < 1500ms, W: < 1200ms, D: < 1500ms | > 20% increase |
| **Recovery Phrase Generation** | Tap Create → phrase displayed | < 1000ms all platforms | > 30% increase |
| **Phrase Verification** | All words selected → verified | < 500ms all platforms | > 30% increase |
| **Import from Mnemonic** | Paste phrase → wallet restored | < 3000ms all platforms | > 25% increase |
| **Import Account Discovery** | Phrase accepted → accounts discovered | < 5000ms all platforms | > 25% increase |
| **Hardware Connect** | Tap Connect → device recognized | < 5000ms (excl. user action) | > 30% increase |
| **Mnemonic Paste (Clipboard)** | Paste phrase → all words populated | < 200ms all platforms | > 400ms |
| **Keyboard Open FPS** | FPS when keyboard appears for mnemonic/password input | M: >= 45 fps | Drop below 35 fps |
| **Navigation Transition FPS** | FPS during onboarding step transitions (250ms) | >= 50 fps all platforms | Drop below 40 fps |
| **Password Dialog FPS** | FPS during password setup dialog animation (300ms) | >= 50 fps all platforms | Drop below 40 fps |

---

### 15. DApp Connection Approval

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.DAppConnectionModal`

**Description**: DApp requesting wallet connection approval.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Approval Sheet Open** | DApp request → approval UI visible | < 500ms all platforms | > 30% increase |
| **Account List in Approval** | Sheet open → accounts rendered | < 300ms all platforms | > 30% increase |
| **Account List Scroll FPS** | FPS scrolling accounts in approval sheet | >= 55 fps all platforms | Drop below 45 fps |
| **Approval Confirm** | User confirms → DApp receives response | < 500ms all platforms | > 30% increase |
| **Approve Button Response** | Tap approve → action initiated | < 100ms all platforms | > 200ms |
| **Signature Confirm Load** | Sign request → confirm page rendered | < 600ms all platforms | > 25% increase |
| **WalletConnect Pairing** | Scan QR → WC pairing established | < 3000ms M | > 5000ms |
| **WC Session Proposal → UI** | Session proposal received → approval UI visible | < 500ms all platforms | > 800ms |
| **Approval Sheet Animation FPS** | FPS during bottom sheet open animation (300ms) | >= 50 fps all platforms | Drop below 40 fps |

**Platform-specific notes**:
- **Extension**: This is the most frequent modal in extension — popup must open fast
- **Mobile**: WalletConnect deep link → approval sheet timing. WC pairing should complete within 3s, session proposal → UI within 500ms.

---

### 16. Transaction History

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.MainModal` → `HistoryDetails`

**Description**: Per-account or per-token transaction history list and detail view. Uses `SectionList` with date-grouped headers.

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **History List Load** | Page open → first batch rendered | < 1000ms all platforms | > 20% increase |
| **History List Scroll FPS** | FPS during history SectionList scroll | M: >= 50 fps, D/W/E: >= 55 fps | Drop below 30 fps for > 500ms |
| **Section Header Sticky FPS** | FPS when sticky section headers transition | M: >= 50 fps | Drop below 40 fps |
| **History Detail Open** | Tap transaction → detail rendered (250ms nav animation) | < 400ms all platforms | > 30% increase |
| **History Detail Navigation FPS** | FPS during detail modal open animation | >= 50 fps all platforms | Drop below 40 fps |
| **Copy TxHash (Clipboard)** | Tap copy → hash in clipboard + toast visible | < 300ms all platforms | > 500ms |
| **Pagination / Load More** | Scroll to bottom → next batch appended | < 800ms all platforms | > 25% increase |
| **Memory Growth** | Heap increase per 100 items loaded | < 10MB | > 40% increase |

---

## Current Threshold Baselines

These are the current automated regression guard thresholds (from `development/perf-ci/thresholds/`):

### iOS

| Metric | Debug | Release |
|--------|------:|--------:|
| **tokensStartMs** | 10,858 ms | 3,948 ms |
| **tokensSpanMs** | 3,403 ms | 2,550 ms |
| **functionCallCount** | 942 | 671 |
| **Strategy** | median | median |

### Android

| Metric | Debug | Release |
|--------|------:|--------:|
| **tokensStartMs** | 14,965 ms | 3,101 ms |
| **tokensSpanMs** | 8,467 ms | 4,898 ms |
| **functionCallCount** | 1,784 | 899 |
| **Strategy** | median | median |

> Note: Debug builds include Metro overhead and Babel instrumentation, hence significantly higher values.

---

## Metric Template (For Adding New Pages)

When adding a new page to regression testing, use this template:

```markdown
### N. Page Name

**Platforms**: M / E / W / D

**Route**: `EModalRoutes.XXX` → `PageName`

**Description**: Brief description of the page and its key interactions.

**Scrollable elements**:
- Element name → Component used (e.g. FlashList, SectionList, ScrollView)

**perfMark checkpoints** (add to code):
- `PageName:mount` — Component mounts
- `PageName:data:start` — Data fetch begins
- `PageName:data:done` — Data fetch & render complete
- `PageName:interactive` — Page fully interactive

| Metric | Mark / Source | Target | Regression Threshold |
|--------|--------------|--------|---------------------|
| **Page Open (TTI)** | Navigation → interactive | < Xms | > Y% increase |
| **Navigation Transition FPS** | FPS during modal open animation (250ms) | >= 50 fps | Drop below 40 fps |
| **Data Load** | data:start → data:done | < Xms | > Y% increase |
| **List Scroll FPS** | FPS during list scroll | M: >= X fps, D/W/E: >= Y fps | Drop below Z fps for > 500ms |
| **Tab Switch** | Tab tap → new content visible (if tabs present) | < 200ms | > 300ms |
| **Button Response** | Primary action button tap → action initiated | < 100ms | > 200ms |
| **Keyboard Open FPS** | FPS during keyboard appearance (if inputs present) | M: >= 45 fps | Drop below 35 fps |
| **Dialog Animation FPS** | FPS during dialog open/close (if dialogs present) | >= 50 fps | Drop below 40 fps |
| **Search Response** | Keystroke → filtered results (if search present) | < 200ms | > 300ms |
| **Clipboard Copy** | Tap copy → toast visible (if copy actions present) | < 300ms | > 500ms |
| **Memory Delta** | Heap increase entering page | < XMB | > Y% increase |
```

### Adding perfMark to Code

```typescript
import { perfMark } from '@onekeyhq/shared/src/performance/mark';

// In component
useEffect(() => {
  perfMark('PageName:mount');
  return () => perfMark('PageName:unmount');
}, []);

// Around data fetch
perfMark('PageName:data:start');
const data = await fetchData();
perfMark('PageName:data:done');

// Around scroll interaction (for FPS correlation)
perfMark('PageName:scroll:start');
// ... scroll action ...
perfMark('PageName:scroll:end');
```

---

## Running the System

### Automated (Scheduled)

#### Option A: launchd (recommended for macOS test machines)

```bash
# One-time setup
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/perf-logs" "$HOME/perf-sessions"

# Copy and edit plists (replace __REPO_ROOT__ and __HOME_DIR__)
cp development/perf-ci/launchd/perf-server.plist \
  "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
cp development/perf-ci/launchd/ios-perf-job.plist \
  "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"

# Load services
UID="$(id -u)"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
```

Jobs run at **09:00, 14:00, 19:00** daily. The perf-server runs permanently with `KeepAlive: true`.

#### Option B: Daemon process

```bash
# iOS release, every 5 hours, headless
yarn perf:ios:release:daemon --interval-minutes 300

# Android release, every 6 hours (default), headless
yarn perf:android:release:daemon --interval-minutes 360
```

### Manual (Ad-hoc)

```bash
# Single iOS release run
yarn perf:ios:release

# Single Android debug run
yarn perf:android:debug

# With specific simulator
DETOX_DEVICE_UDID="218B05AF-8053-44EE-9D6C-7F4F48630591" yarn perf:ios:release

# With Slack notification
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." yarn perf:ios:release
```

### Dashboard & CLI Analysis

#### Web Dashboard

```bash
# Start perf server (if not running as service)
cd development/performance-server && yarn start

# Open dashboard
open http://localhost:9527
```

Dashboard features:
- **Timeline flame chart** with function call bars colored by module
- **FPS sparkline** — identify low-FPS windows at a glance
- **Memory sparkline** — track heap usage over session lifetime
- **Key Marks timeline** — see all perfMark checkpoints with timing
- **Home Refresh Analysis** — detailed breakdown of token refresh hotspots
- **Slow Functions table** — sortable by p95/max/avg, filterable by module
- **Repeated Calls table** — detect redundant re-invocations (rapid mode: <100ms)
- **Low FPS Windows** — correlate FPS drops with function calls and marks
- **JS Block Events** — identify main thread blocking with root cause
- **Speedscope export** — open session in speedscope.app for flame graph analysis

#### CLI Analysis

```bash
# Full session analysis
node cli/derive-session.js <sessionId> --pretty --output report.json

# Key marks timing
curl http://localhost:9527/api/sessions/<sessionId>/key-marks | jq .

# Home refresh hotspots
curl http://localhost:9527/api/sessions/<sessionId>/home-refresh | jq .

# Slow functions (top 100, threshold 10ms)
curl "http://localhost:9527/api/sessions/<sessionId>/slow-functions?pageSize=100&thresholdMs=10" | jq .

# Low FPS windows (threshold 30fps)
curl "http://localhost:9527/api/sessions/<sessionId>/low-fps?threshold=30" | jq .

# JS block events (min 100ms)
curl "http://localhost:9527/api/sessions/<sessionId>/jsblock?minDrift=100" | jq .

# Repeated rapid calls
curl "http://localhost:9527/api/sessions/<sessionId>/repeated-calls?mode=rapid&minCount=3" | jq .
```

#### Compare Sessions

```bash
# Export baseline and test sessions
node cli/derive-session.js <baseline-id> --output baseline.json
node cli/derive-session.js <test-id> --output test.json

# Compare key marks
jq '.keyMarks.marks["Home:refresh:done:tokens"].first.sinceSessionStartMs' baseline.json test.json
```

### Per-Platform Test Matrix

| Test Scenario | iOS | Android | Extension | Web | Desktop |
|---------------|:---:|:---:|:---:|:---:|:---:|
| Cold start → Home loaded | ✅ | ✅ | ✅ | ✅ | ✅ |
| Home token refresh (pull-to-refresh) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Home token list scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Home NFT grid scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Home history scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token detail open + chart | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token detail history scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send flow (input → confirm) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Send token selector scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Receive QR display | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swap quote fetch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Swap token selector scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Market list scroll FPS | — | — | ✅ | ✅ | ✅ |
| Market detail chart interaction FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Discovery DApp list scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Discovery WebView scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Earn protocol list scroll FPS | — | — | — | ✅ | ✅ |
| Staking detail scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings list scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Account selector scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| Account switch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Onboarding create wallet | ✅ | ✅ | ✅ | ✅ | ✅ |
| DApp connection approve | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transaction history scroll FPS | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Interaction Metrics** | | | | | |
| Navigation transition FPS (250ms modal) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Button tap → action response | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tab switch latency (Home tabs) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dialog open/close animation FPS (300ms) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pull-to-refresh cycle (1200ms anim) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search/filter response time | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyboard open/close FPS | ✅ | ✅ | — | — | — |
| Chart interaction FPS (pan/zoom) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clipboard copy → toast | ✅ | ✅ | ✅ | ✅ | ✅ |
| Biometric auth timing | ✅ | ✅ | — | — | ✅ |
| QR scanner open + decode | ✅ | ✅ | — | — | — |
| WalletConnect pairing + session | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deep link → target page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Image loading (token icons, NFTs) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Toast appearance timing | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Appendix: perfMark Naming Convention

```
{PageOrModule}:{phase}:{detail}
```

### Existing Marks

| Mark Name | Location | Description |
|-----------|----------|-------------|
| `app:start` | `performance/init.ts` | JS execution begins |
| `Home:overview:mount` | `HomeOverviewContainer.tsx` | Home component mounted |
| `Home:overview:unmount` | `HomeOverviewContainer.tsx` | Home component unmounted |
| `Home:refresh:start:tokens` | `HomeOverviewContainer.tsx` | Token refresh started |
| `Home:refresh:done:tokens` | `HomeOverviewContainer.tsx` | Token refresh completed |
| `Home:done:tokens` | `HomeOverviewContainer.tsx` | Token processing done |
| `AllNet:useAllNetworkRequests:start` | `useAllNetwork.ts` | All-network request hook started |
| `AllNet:getAllNetworkAccounts:start` | `useAllNetwork.ts` | All-network account fetch started |
| `AllNet:getAllNetworkAccounts:done` | `useAllNetwork.ts` | All-network account fetch done |
| `jsblock:main` | `jsBlockCollector.ts` | Main thread JS block detected |
| `bgcall:*` | Various | Background API calls |
| `storage:*` | Various | Storage read/write operations |
| `simpledb:*` | Various | SimpleDB operations |

### Recommended New Marks (To Instrument)

| Mark Name | Where to Add | Purpose |
|-----------|-------------|---------|
| `TokenDetail:mount` | Token detail page | Page open timing |
| `TokenDetail:chart:done` | Chart component | Chart render complete |
| `TokenDetail:scroll:start/end` | History tab scroll | Scroll FPS correlation |
| `Send:mount` | Send page | Send flow start |
| `Send:confirm:mount` | Confirm page | Confirm page timing |
| `Send:broadcast:done` | After broadcast | Transaction complete |
| `Swap:mount` | Swap page | Swap page open |
| `Swap:quote:start` / `Swap:quote:done` | Quote logic | Quote timing |
| `Swap:tokenSelect:scroll:start/end` | Token selector scroll | Scroll FPS correlation |
| `Market:mount` | Market page | Market page open |
| `Market:list:done` | After list render | List render timing |
| `Market:scroll:start/end` | Token list scroll | Scroll FPS correlation |
| `MarketDetail:mount` | Market detail | Detail page open |
| `MarketDetail:chart:done` | Chart component | Chart render complete |
| `Discovery:mount` | Discovery page | Discovery page open |
| `Discovery:webview:loaded` | WebView | DApp loaded |
| `Discovery:scroll:start/end` | DApp list scroll | Scroll FPS correlation |
| `Earn:mount` | Earn page | Earn page open |
| `Earn:protocols:done` | After protocol list | Protocol list rendered |
| `Earn:scroll:start/end` | Protocol list scroll | Scroll FPS correlation |
| `Settings:mount` | Settings page | Settings page open |
| `Settings:scroll:start/end` | Settings list scroll | Scroll FPS correlation |
| `AccountSelector:mount` | Account selector | Selector open |
| `AccountSelector:switch:done` | After switch | Account switch complete |
| `AccountSelector:scroll:start/end` | Account list scroll | Scroll FPS correlation |
| `Onboarding:mount` | Onboarding start | Onboarding begin |
| `Onboarding:wallet:created` | After creation | Wallet creation complete |
| `DAppConnect:mount` | Connection approval | Approval sheet open |
| `History:mount` | History page | History page open |
| `History:list:done` | After list render | List render complete |
| `History:scroll:start/end` | History list scroll | Scroll FPS correlation |
| `Nav:push:start` / `Nav:push:animated` / `Nav:push:interactive` | Navigation system | Page transition timing |
| `Tab:switch:start` / `Tab:switch:visible` | Tabs container | Tab switch latency |
| `Dialog:open` / `Dialog:ready` / `Dialog:close` | Dialog component | Dialog animation timing |
| `PullRefresh:start` / `PullRefresh:complete` | Pull-to-refresh | Refresh cycle timing |
| `Search:start` / `Search:results` | Search hooks | Search response timing |
| `Clipboard:copy` / `Clipboard:toast` | useClipboard | Clipboard operation timing |
| `Button:press` / `Button:complete` | Button component | Button response timing |
| `WC:pairing:start` / `WC:pairing:done` | WalletConnect | WC session timing |
| `DeepLink:receive` / `DeepLink:navigate` | Deep link handler | Deep link handling timing |
| `Biometric:prompt` / `Biometric:done` | Auth flow | Biometric auth timing |
| `Scanner:open` / `Scanner:decode` | QR scanner | QR scanning timing |

---

## References

### Tools & Libraries

- [Callstack Reassure](https://github.com/callstack/reassure) — Performance testing companion for React and React Native, using statistical comparison of render duration/count
- [Shopify react-native-performance](https://github.com/oblador/react-native-performance) — Measure render times for different flows, navigation, and list performance
- [React Native Performance Docs](https://reactnative.dev/docs/performance) — Official React Native performance overview
- [Sentry for React Native](https://sentry.io/for/react-native/) — Production error and performance monitoring

### Industry Practices

- [Meituan Hertz](https://tech.meituan.com/2016/12/19/hertz.html) — Meituan's mobile performance monitoring solution covering FPS, CPU, memory, lag, page load, and network across dev/test/prod phases
- [Apache SkyWalking Dynamic Baselines](https://skywalking.apache.org/blog/2025-02-24-improving-alert-accuracy-with-dynamic-baselines/) — Using Prophet-based forecasting instead of static thresholds for more accurate alerting
- [Callstack Blog: Performance Regression Testing](https://www.callstack.com/blog/performance-regression-testing-react-native) — Methodology for automated React Native performance regression testing in CI

### General Testing Practices

- [Regression Testing Best Practices](https://www.testdevlab.com/blog/regression-testing-for-mobile-apps) — Comprehensive guide for mobile app regression testing
- [Baseline Testing](https://www.virtuosoqa.com/post/baseline-testing) — Setting appropriate thresholds based on historical data and SLOs
- [Mobile App Performance Testing](https://abstracta.us/blog/performance-testing/mobile-app-performance-testing/) — Guide to automating and scaling mobile performance tests
