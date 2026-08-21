# iOS Install Attribution Handoff Runbook

更新时间：2026-08-21

## 1. 目标与推进原则

目标是在保留现有 OneKey Short Link 能力的前提下，分阶段补齐 iOS 安装归因，并把 Apple Ads、Google、Meta、TikTok、Snap、X 等平台的差异收敛到稳定的内部模型，避免每增加一个投放平台都修改客户端业务代码。

本任务按以下规则推进：

1. 每次只允许一个阶段处于 `IN_PROGRESS`。
2. 当前阶段的验收项全部通过后，才进入下一阶段。
3. 每个仓库使用独立 worktree；App 从 `x` 开始，服务端与 Dashboard 从 `main` 开始。
4. 不在原始 checkout 中修改归因代码。
5. 每完成一个阶段，在本文档更新：状态、修改文件、验证命令、验证结果、剩余风险和对应 commit/PR。
6. 未完成 MMP、Conversion Writer 和 Postback Sink 所有权决策前，不实现 SKAN/AdAttributionKit conversion value 写入和 postback endpoint。

## 2. Worktree 台账

| 仓库 | Worktree | 分支 | 基线 | 初始 SHA |
| --- | --- | --- | --- | --- |
| `app-monorepo` | `/Volumes/T7 Shield/Project/app-monorepo-ios-install-attribution-analysis` | `codex/ios-install-attribution-analysis` | `origin/x` | `2b82b23c5e4f1b79d8ee32ecb2371625ed0d4e3e` |
| `server-service-dashboard` | `/Volumes/T7 Shield/Project/server-service-dashboard-ios-install-attribution` | `codex/ios-install-attribution` | `origin/main` | `142229b486c92b7ff3c2bdf7e5aefa958912eb13` |
| `server-service-utility` | `/Volumes/T7 Shield/Project/server-service-utility-ios-install-attribution` | `codex/ios-install-attribution` | `origin/main` | `a19dc77be5c67665efa8cdc2e763e27f6c3fbcc5` |
| `dashboard` | `/Volumes/T7 Shield/Project/dashboard-ios-install-attribution` | `codex/ios-install-attribution` | `origin/main` | `066b757bb454078488f846eefabae68fd3a8b07d` |

Dashboard 原仓库的实际位置是 `/Users/huhuanming/dashboard`；不存在 `/Users/huhuanming/Project/dashboard`。本任务统一使用上表中的移动硬盘 worktree。

## 3. 当前状态

| 阶段 | 状态 | 验收人/日期 | 说明 |
| --- | --- | --- | --- |
| Phase 0：worktree 与 handoff | `DONE` | 用户确认 / 2026-08-20 | 隔离环境和执行台账已验收 |
| Phase 1：App Store Campaign destination | `DONE` | 用户确认 / 2026-08-21 | 实现和自动化验证完成；测试后端尚未部署新枚举 |
| Phase 2：Apple Ads AdServices | `DONE` | 用户确认 / 2026-08-21 | App + Utility 已验收；真机/真实广告流量作为上线验证项保留 |
| Phase 3：MMP 与所有权决策 | `READY_FOR_ACCEPTANCE` | - | 推荐 AppsFlyer；MMP 统一持有 CV Writer 与 Apple postback sink |
| Phase 4：统一归因事件与 Conversion Writer | `BLOCKED_BY_PHASE_3` | - | 方案取决于 Phase 3 |
| Phase 5：Apple postback 数据面 | `BLOCKED_BY_PHASE_4` | - | 自建或 MMP 二选一 |
| Phase 6：广告平台适配与统一报表 | `BLOCKED_BY_PHASE_5` | - | Provider Adapter |

## 4. 已确认的现状

### 4.1 App

Android Google Play 安装归因已经形成可复用模式：

- `packages/kit/src/components/LastActivityTracker/installAttribution.android.ts` 只在 Google Play Android main runtime 执行。
- `packages/shared/src/modules/InstallAttribution/googlePlay.ts` 读取 Install Referrer、限制安装时间、做一次性上报。
- `packages/shared/src/logger/scopes/app/scenes/install.ts` 通过 `defaultLogger.app.install` 和 `LogToServer` 上报统一字段。

iOS 归因需要同样遵守 runtime 边界：

- 目标平台：iOS。
- JS runtime：只在 `main` 执行，`bg` 不重复初始化或上报。
- JS heap：iOS 的 `main`/`bg` 相互隔离，不能依赖另一个 runtime 的内存状态或初始化顺序。
- Native 资源：系统 AdServices、StoreKit、AdAttributionKit 由 iOS 进程/系统提供，但 JS 调用方必须明确唯一。
- iOS 最低版本为 15.5；AdAttributionKit 需要 availability guard。

当前仓库未发现 Firebase、Meta、TikTok、AppsFlyer、Adjust、Branch、Kochava、Singular、SKAN 或 AdAttributionKit 集成。不要在未完成 Phase 3 决策前添加这些依赖。

### 4.2 Short Link

当前 Short Link 已支持：

- `single` 和按 `ios/android/macos/windows/linux/default` 分流的 `os` strategy。
- `direct_query`。
- `google_play_referrer`。
- Utility 写入 `ShortLinkClickEvents`，Dashboard Server 读取同一 Mongo collection 导出。
- Server Dashboard 和 Utility 共享 URL fixture 作为契约测试。

相关代码入口：

| 仓库 | 入口 |
| --- | --- |
| Server Dashboard | `src/entity/short-link/short-link.type.ts`、`short-link-url.service.ts`、DTO/entity/service、`test/unit/short-link/`、`docs/features/short-link-service/` |
| Utility | `src/entity/short-link/short-link.type.ts`、`short-link-url.service.ts`、redirect service、`test/short-link/` |
| Dashboard | `src/apis/short-links.ts`、`src/pages/link/short-link/ShortLinkDrawer.tsx`、对应测试和中英文文案 |

## 5. 不可变架构约束

### 5.1 两个数据平面

```text
Attribution Fact Plane
├── Short Link click
├── App Store Campaign aggregate
├── Apple Ads AdServices
├── Apple SKAN/AdAttributionKit verified postback
└── OneKey first-party activation/retention

Optimization Signal Plane
├── Google Firebase/ODM/App Conversion API/MMP
├── Meta SDK/CAPI/MMP
├── TikTok SDK/Events API/MMP
└── Snap/X/MMP
```

事实面用于 OneKey 自有数据和对账；优化面用于广告平台学习。两者不能合并成一个未经标记的“安装数”。

### 5.2 一个 Conversion Writer

全局只能有一个逻辑写入方：

```ts
type ConversionOwner = 'internal' | 'mmp';

interface IConversionWriter {
  initialize(schema: ConversionSchema): Promise<void>;
  update(event: AttributionEvent): Promise<void>;
}
```

允许的实现只有一个生效：

- `InternalAppleConversionWriter`：内部同时协调 SKAN 和 AdAttributionKit API。
- `MmpConversionWriter`：由选定 MMP SDK 管理 Apple conversion value。

Google、Meta、TikTok 等 SDK 不得各自更新 conversion value。TikTok 官方也明确要求 SDK、MMP 或 App 自己三选一作为 CV 写入方。

### 5.3 一个 Postback Sink Owner

```ts
type PostbackSinkOwner = 'internal' | 'mmp';
```

iOS developer postback copy endpoint 是单一配置。Phase 3 必须选择：

- `internal`：Apple 直接发送到 OneKey，Utility 验签、去重、保存，再按明确支持情况转发/导出给 MMP。
- `mmp`：Apple 发送给 MMP，Utility 通过 MMP raw export、webhook 或 API 导入。

不得假设任意 MMP 都接受 OneKey 转发的 developer copy。

### 5.4 客户端事件只定义一次

初始外部广告优化事件保持粗粒度：

```ts
type AttributionEventName =
  | 'install_open'
  | 'onboarding_complete'
  | 'activation'
  | 'retained_d2'
  | 'retained_d7'
  | 'retained_d30';
```

客户端业务代码只产生 OneKey 事件，不直接调用 Google、Meta、TikTok 或 MMP 的业务事件 API。事件进入现有 `defaultLogger.app.install`/Utility 数据流后，由服务端 Provider Adapter 做平台映射。

禁止发送给广告平台或写入 attribution 日志：

- 助记词、私钥、密钥材料。
- 钱包地址。
- 资产、余额、币种和交易明细。
- 可直接推断个人财务行为的字段。
- AdServices attribution token 等临时凭证的明文日志。

## 6. 平台能力边界

| 平台 | Apple 归因公开支持 | 安装后优化通道 | Campaign 映射 | 对统一设计的影响 |
| --- | --- | --- | --- | --- |
| Apple Ads | AdServices + AAK/SKAN | Apple Ads 自身 | AdServices/Apple Ads 报表 | OneKey 可直接实现 |
| Google | 已确认 SKAN 4；AAK 需商务/供应商确认 | Firebase、ODM、App Conversion API、MMP | Google Ads API | 最佳 iOS 优化仍可能需要 Google ODM |
| Meta | SKAN 4；AEM 是独立体系；AAK 需确认 | Meta SDK、CAPI、MMP | Insights API/MMP | Apple source ID 不保证能自行映射到完整广告层级 |
| TikTok | SKAN 4；AAK 需确认 | TikTok SDK、Events API、MMP | Business API/MMP | 必须明确唯一 CV Writer |
| Snap | SKAN | 主要依赖 MMP | Marketing API/MMP | Conversion mapping 缺失会产生 Unknown event |
| X | SKAN via approved MMP | MMP | X/MMP | 官方要求认可 MMP，纯自研不能覆盖 |

因此“未来可能投任何平台”对应的目标方案应为：

```text
OneKey owns:
  Short Link + Campaign registry + AdServices + first-party events
  + canonical facts/reports

MMP owns:
  ad-network compatibility + network mapping + optional CV writer
  + postback enrichment/export

Apple owns:
  SKAN/AdAttributionKit verified attribution facts
```

这不等于用 MMP Link 替换 OneKey Short Link。自有渠道/KOL 继续使用 OneKey Short Link；MMP 只作为付费广告网络兼容层。

## 7. 统一服务端模型草案

### 7.1 Provider 与适配器

```ts
interface AttributionProvider {
  providerKey: string;
  displayName: string;
  providerType: 'apple_ads' | 'ad_network' | 'owned_media' | 'mmp';
  appleFrameworks: Array<'skan4' | 'aak'>;
  adNetworkIds: string[];
  conversionOwnerMode: 'internal' | 'mmp' | 'none';
  optimizationTransport: 'none' | 'sdk' | 's2s' | 'mmp';
  requiresMmp: boolean;
  sourceMappingMode: 'direct' | 'platform_api' | 'mmp' | 'opaque';
  postbackSinkOwner: 'internal' | 'mmp';
}

interface IAttributionProviderAdapter {
  validateConnection(): Promise<void>;
  syncCampaigns(cursor?: string): Promise<void>;
  syncDeliveryMetrics(range: DateRange): Promise<void>;
  syncAttributionMetrics(range: DateRange): Promise<void>;
  publishConversionSchema?(schema: ConversionSchema): Promise<void>;
  sendOptimizationEvents?(events: AttributionEvent[]): Promise<void>;
}
```

新增广告平台时，原则上只增加一个 Utility Adapter、账号密钥配置和 Dashboard 配置入口，不修改 App 业务事件和核心 collection schema。

### 7.2 Campaign 绑定

```ts
interface AttributionCampaignBinding {
  campaignKey: string;
  providerKey: string;
  accountId: string;
  externalCampaignId?: string;
  externalAdGroupId?: string;
  externalAdId?: string;
  appStoreCampaignToken?: string;
  appleAdsCampaignId?: string;
  adNetworkId?: string;
  sourceIdentifierRule?: string;
}
```

`sourceIdentifierRule` 必须支持层级前缀匹配，因为 Apple 可能只返回 2、3 或 4 位 source identifier。不能把完整 source identifier 当作永远可用的 campaign 主键。

### 7.3 建议 collection

```text
AttributionProviders
AttributionProviderAccounts
AttributionCampaigns
AttributionCampaignBindings
ConversionSchemas
AppleAttributionPostbacks
AttributionObservations
AttributionDailyMetrics
AttributionSyncCheckpoints
```

凭证只保存 secret reference，实际 secret 进入现有 secrets manager。现有 `ShortLinkClickEvents` 保留，不迁移、不重命名。

### 7.4 报表口径

```ts
type MeasurementMethod =
  | 'apple_verified'
  | 'platform_observed'
  | 'platform_modeled'
  | 'first_party'
  | 'app_store_aggregate';
```

每条 observation/metric 至少保留：

- `measurementMethod`、`isModeled`、`privacyWithheld`。
- `eventDate` 和 `receivedDate`。
- `providerKey`、内部 `campaignKey` 和可用的外部层级 ID。
- `schemaVersion`、`metricName`、`metricValue`。

权威来源：

| 指标 | 来源 |
| --- | --- |
| spend/impressions/clicks | 广告平台报表 API |
| Apple raw install/conversion | 已验签 Apple postback |
| Apple Ads 安装实例归因 | AdServices |
| KOL/App Store Campaign 下载 | App Store Connect campaign 报表 |
| activation/retention | OneKey 第一方事件 |
| modeled installs/conversions | 平台报表，必须明确标记 modeled |

## 8. 分阶段实施与验收

### Phase 0：worktree 与 handoff

范围：只修改本 handoff 文档。

验收条件：

- [x] 四个 worktree 都在 `/Volumes/T7 Shield/Project`。
- [x] App 基于最新 `origin/x`。
- [x] 其余三个仓库基于最新 `origin/main`。
- [x] 四个 worktree 均使用 `codex/` 分支且初始状态干净。
- [x] 本文档记录绝对路径、分支和基线 SHA。
- [x] 后续阶段具有明确仓库范围、验收条件和暂停点。
- [x] 用户确认 Phase 0，可以进入 Phase 1。

技术验收记录（2026-08-19）：

- 四个 worktree 的 `HEAD` 分别与表中 `origin/x` 或 `origin/main` SHA 完全一致。
- 四个 worktree 的 `git merge-base --is-ancestor <base> HEAD` 均通过。
- 四个 worktree 的 `git diff --check` 均通过。
- 除本 handoff 新文件外，没有归因任务产生的代码改动。

完成后状态更新为 `DONE`，Phase 1 更新为 `READY`。

### Phase 1：`app_store_campaign` destination type

允许修改：

- `server-service-dashboard`
- `server-service-utility`
- `dashboard`

不修改：`app-monorepo`。

预期行为：

1. 新增 `app_store_campaign`，并在 API/OpenAPI/类型/UI 中一致暴露。
2. 只接受受支持的 App Store HTTPS host；不把普通网页或 Google Play URL 当作 Campaign Link。
3. 明确说明 Apple 参数：`pt` 为 provider token，`ct` 为 campaign token，`mt` 为 media type。
4. Dashboard 对字段给出中英文 description 和示例。
5. `ct` 可按 KOL/素材粒度配置，但 App Store Connect 结果是聚合报表，不能恢复到用户或安装实例。
6. Short Link 服务端生成的 `click_id` 只保存在 `ShortLinkClickEvents` 用于点击侧分析，不宣称能穿透 App Store 关联安装用户。
7. Server Dashboard 与 Utility 保持同一 URL fixture，preview 输出一致。
8. 旧的 `direct_query`、`generic_query`、`google_play_referrer` 行为保持兼容。

已确认采用最小兼容设计：API 继续使用受约束的 `fixedParams` 保存 `pt/ct/mt`，Dashboard 提供显式字段；不增加新的数据库字段或 `appStoreCampaign` API 对象。服务端对 `app_store_campaign` 严格限定字段、URL 和重定向输出。

聚焦验证：

```bash
# server-service-dashboard
yarn test test/unit/short-link/short-link-url.service.test.ts
yarn test test/unit/short-link/short-link.service.test.ts
yarn lint
yarn typecheck

# server-service-utility
yarn test test/short-link/short-link-url.service.test.ts
yarn test test/short-link/short-link.service.test.ts
yarn lint
yarn build

# dashboard
yarn test --watchAll=false --runInBand src/pages/link/short-link/ShortLinkDrawer.test.tsx
yarn test --watchAll=false --runInBand src/apis/__tests__/short-links-preview.test.ts
yarn lint
yarn build
```

验收证据：

- 三仓 diff 范围。
- 单测/lint/typecheck/build 结果。
- Dashboard 表单和 preview 的实际截图。
- 三仓 contract fixture 内容一致性。

Phase 1 交接记录（2026-08-21）：

```text
Status: DONE
Completed at: 2026-08-21
Repositories changed:
  - server-service-dashboard
  - server-service-utility
  - dashboard
Files changed:
  - server-service-dashboard: 6 files
  - server-service-utility: 5 files
  - dashboard: 6 files
  - app-monorepo: this handoff document only
Commits/PRs:
  - app-monorepo handoff: 40cf345da7
  - server-service-dashboard: 6ae8384
  - server-service-utility: e5bca96
  - dashboard: 7167b22b
  - PRs: none
Validation results:
  - Server Dashboard: 29 suites / 327 tests passed; focused URL suite 50 tests passed; typecheck, build and lint passed (30 unrelated existing warnings, 0 errors).
  - Utility: Short Link 6 suites / 125 tests passed; focused URL suite 65 tests passed; typecheck, build and lint passed (112 unrelated existing warnings, 0 errors).
  - Dashboard: 3 focused suites / 8 tests passed; lint and build passed (only existing source-map warnings); 4,916 locale keys validated.
  - Contract: Server Dashboard and Utility URL fixtures are byte-identical; JSON parsing, diff-check and no-lockfile-change checks passed.
Manual evidence:
  - Local Dashboard at http://127.0.0.1:3000 used the real authenticated test Dashboard session in Chrome.
  - App Store campaign mode exposes only destination URL, pt, ct and optional mt configuration; mt defaults to 8 and copy explains aggregate campaign/KOL semantics versus individual-user attribution.
  - Numeric pt validation, ct whitespace/30-character validation and mode-switch value preservation passed.
  - Pasting a complete App Store Campaign URL populated pt/ct/mt fields correctly.
  - As a control, the same authenticated test preview endpoint succeeded immediately in the deployed direct_query mode; only app_store_campaign failed, confirming that the remaining end-to-end gap is backend deployment rather than localhost auth, CORS or preview connectivity.
  - Drawer was usable at an observed 1151 x 695 viewport; header Save control and bottom preview control remained reachable through drawer scrolling, with no clipping.
  - Save was not clicked; no Short Link record was created or modified during manual QA.
Known limitations:
  - The deployed test backend does not yet recognize app_store_campaign, so the real preview endpoint returns the UI fallback error. Redirect normalization and the exact expected final URL are covered by the identical Server Dashboard/Utility fixtures and focused service tests, but end-to-end preview must be repeated after backend deployment.
  - The temporary authenticated localhost browser state remains only in the user's local Chrome profile.
Decision required before next phase:
  - Accepted by the user on 2026-08-21; Phase 2 is authorized.
```

### Phase 2：Apple Ads AdServices

允许修改：

- `app-monorepo`
- `server-service-utility`

默认不修改 Dashboard 两仓；如果需要展示 AdServices 诊断数据，单独提出最小扩展并验收。

客户端约束：

1. 只在 iOS main runtime 调用。
2. 不请求 ATT；AdServices token 获取本身不应触发权限提示。
3. attribution token 不进入 `LogToLocal`、console、Sentry breadcrumb 或普通 analytics 参数。
4. 请求和上报具有幂等控制、明确重试边界和安装年龄边界。
5. 通过专用 Utility API 上传 token，由 Utility 调用 Apple AdServices API；不把 token 混入通用业务日志。
6. 非 iOS、iOS bg runtime、开发环境和不支持的系统版本具有聚焦测试或明确 guard。

Utility 约束：

1. 校验请求大小、格式、App 身份和重放边界。
2. token 只在内存中用于 Apple API 交换，禁止持久化或打印原 token。
3. 保存规范化结果和必要的 Apple 原始响应字段，但不保存无关用户敏感数据。
4. 使用幂等键避免同一安装实例重复写入。
5. Apple 返回 `attribution=false` 时也形成可诊断的结果，但不创建虚假 campaign 绑定。
6. 超时、Apple 4xx/5xx、无归因和重复请求分别测试。

验收条件：

- [x] iOS 原生模块完成编译和链接；模拟器/无归因路径由 runtime guard 和单测覆盖。
- [ ] 签名生产构建真机请求路径可观察，但日志中没有 token。
- [x] Utility mock Apple API 的成功、无归因、失败、重复场景测试通过。
- [x] App `yarn agent:check --profile commit` 通过。
- [x] Utility 聚焦测试、lint、typecheck、build 通过。

Phase 2 交接记录（2026-08-21）：

```text
Status: READY_FOR_ACCEPTANCE
Completed at: 2026-08-21
Repositories changed:
  - app-monorepo
  - server-service-utility
Files changed:
  - app-monorepo: 9 source/project files plus this handoff update
  - server-service-utility: 10 source/test files
Commits/PRs:
  - app-monorepo: 3d80793d75 (feat: add Apple Ads install attribution)
  - server-service-utility: c558a16 (feat: add Apple Ads install attribution)
  - PRs: none
Validation results:
  - App: 2 focused suites / 9 tests passed.
  - App: yarn agent:check --profile commit passed lint-worktree-ts, format-worktree, agent-context, lint-staged and tsc-staged.
  - Native: Xcode compiled OneKeyAdServicesAttribution.m, produced the arm64 simulator object, linked AAAttribution and AdServices.framework into OneKeyWallet.debug.dylib, and passed direct Clang syntax validation.
  - Utility: 4 focused suites / 32 tests passed; typecheck, build and lint passed (112 unrelated existing warnings, 0 errors).
  - Utility: HEAD c558a16 equals its remote upstream.
Implementation flow:
  1. LastActivityTracker resolves the stable instance ID and Utility endpoint in the iOS main JS runtime.
  2. Production App Store iOS main runtime continues; bg, E2E and non-store builds return before importing attribution code.
  3. A local marker prevents successful installs from reporting twice; installs older than seven days are marked handled without requesting a token.
  4. The native bridge calls AAAttribution.attributionToken() on a utility queue. No ATT request is made and the token is neither persisted nor logged by the App.
  5. App sends the opaque token and x-onekey-instance-id to POST /utility/v1/install-attribution/apple-ads.
  6. Utility validates input, exchanges the raw text/plain token directly with Apple, retries only 404/5xx up to three attempts with a five-second interval, and normalizes an allowlist of response fields.
  7. Utility persists one observation per installation ID, including attribution=false for diagnostics, but never persists the token. Endpoint-specific access-log redaction discards all request body fields and emits only a redacted marker.
Runtime topology:
  - Platform: iOS production App Store build.
  - JS runtime: main only. bg does not import, initialize or report AdServices attribution; main and bg initialization order is irrelevant.
  - JS heaps: main and bg remain isolated; the local completion marker is durable storage rather than shared JS memory.
  - Native resource: AdServices is an iOS system/process resource; OneKey intentionally exposes it only to the main-runtime call path.
Manual/native evidence:
  - The linked debug dylib contains OneKeyAdServicesAttribution class/method symbols, an AAAttribution reference and AdServices.framework load command.
  - Full xcodebuild passed native compilation and the main app dylib link, then stopped in the existing "Bundle React Native code and images" build phase because its shell command does not quote the worktree path /Volumes/T7 Shield/Project. This failure occurs after the attribution native link and is unrelated to the changed module.
Known limitations:
  - A real Apple Ads-attributed install cannot be reproduced with the simulator/debug guard. Final operational acceptance needs a signed production/TestFlight or App Store build plus real Apple Ads traffic.
  - The current x-onekey-instance-id is a stable idempotency key, not cryptographic app attestation. Apple validates the opaque token, while abuse protection still depends on ingress rate limiting and optionally validating expected Apple org/account fields after production values are confirmed.
  - The seven-day first-open cutoff mirrors the existing Android anti-replay behavior. Marketing must explicitly approve a larger window if delayed first opens need attribution.
  - Full Xcode build from the required external worktree path remains blocked by an existing unquoted path-with-space script. No unrelated build-script fix is included in this phase.
Decision required before next phase:
  - Accepted by the user on 2026-08-21 with the stated signed-device and real Apple Ads traffic checks retained as release validation items.
  - Phase 3 is authorized; it is research/ownership selection and does not add an MMP SDK.
```

### Phase 3：MMP 与所有权决策

这是强制决策门，不添加 SDK。

候选至少比较 AppsFlyer、Adjust、Branch，并记录：

- Google、Meta、TikTok、Snap、X 支持矩阵。
- SKAN 4 和 AdAttributionKit 支持。
- 是否允许 OneKey 禁用 MMP deep link，只保留现有 Short Link。
- SDK 体积、启动耗时、Privacy Manifest 和采集字段。
- Conversion Writer 控制权和是否允许禁用自动 CV 更新。
- Postback copy endpoint 所有权、raw export、webhook/API 完整性。
- 中国及主要市场网络可达性。
- 加密货币/金融服务业务政策。
- 数据驻留、保留、删除、DPA、SLA 和成本。

必须形成并验收以下结论：

```text
selectedMmp: none | appsflyer | adjust | branch | ...
conversionOwner: internal | mmp
postbackSinkOwner: internal | mmp
supportedPaidPlatforms: [...]
unsupportedOrDegradedPlatforms: [...]
```

若 `selectedMmp=none`，必须明确接受 X 无法完整支持、Snap 接入受限，以及 Google/Meta/TikTok 各自 Adapter 的维护成本。

#### Phase 3 决策结论

```text
selectedMmp: appsflyer
conversionOwner: mmp
postbackSinkOwner: mmp
supportedPaidPlatforms:
  - apple_ads (OneKey AdServices fact path remains authoritative)
  - google_ads
  - meta_ads
  - tiktok
  - snap
  - x_ads
  - other AppsFlyer integrated partners
unsupportedOrDegradedPlatforms:
  - google_ios_without_odm: SKAN and Google modeled reporting remain, but ICM/ODM coverage is degraded
  - meta_ios_without_att: aggregate/modeled measurement only; no promise of user-level campaign attribution
  - snap_view_through: log-level campaign dimensions are withheld by Snap
  - x_ads_without_mmp: unsupported by X
  - non_apple_aak: provider support is unverified unless the provider or AppsFlyer integration documentation explicitly confirms it
  - china: supported in product documentation, but production use remains gated by a mainland-network POC and contract terms
```

该选择是技术方案，不代表已经购买服务。进入 SDK 实现前仍必须完成本文的商业、法务和网络 POC gate；若 AppsFlyer 无法满足任一 hard gate，回退顺序是 `Adjust`，不是在 App 中同时接入两个 MMP。

#### 候选对比

| 维度 | AppsFlyer | Adjust | Branch | 结论 |
| --- | --- | --- | --- | --- |
| SKAN 4 / AAK | 官方文档把当前 SKAN solution 同时覆盖 SKAdNetwork 和 AdAttributionKit；可接收两种 Apple copy | 官方提供两种 copy endpoint，并允许关闭 SDK SKAN 写入 | 支持 SKAN/AAK 归因；公开 direct-postback 文档仍以 SKAN endpoint/export 为主 | AppsFlyer、Adjust 证据最完整 |
| Conversion Writer | SDK 可作为 writer，也能在初始化前 `disableSKAdNetwork` | SDK 默认写入，可在初始化前 `disableSkanAttribution` | SDK 默认写入，可 opt out | 三者都能满足唯一 writer；选择 AppsFlyer writer |
| Postback sink/export | Apple 直接发到 AppsFlyer；AppsFlyer 可用 Push API 把 copy 转发给 OneKey，Data Locker/Push API 提供 raw data | Apple 可直接发到 Adjust；raw callback/cloud export 能力和套餐需商务确认 | SKAN direct copy 可通过 Custom Exports API 导出；AAK raw copy 字段完整性需确认 | AppsFlyer 最符合 MMP-first、OneKey-copy 的数据面 |
| 现有 Short Link | OneLink 是独立产品；Google/Meta/X/Snap 等 SRN 不依赖 AppsFlyer click link，自有/KOL link 可继续由 OneKey 管理 | Deep Link 是可选能力；SAN 不需要 Adjust link | 产品和 SDK 明显围绕 Branch Link/Ad Link；迁移文档要求替换多类 MMP link | Branch 与现有能力重叠和耦合最大 |
| Google/Meta/TikTok/Snap/X | 五个平台均有正式集成；X 官方认可 | 五个平台均有正式集成；X 官方认可 | 五个平台均有正式集成；X 官方认可 | 网络覆盖本身不能区分三者 |
| 中国与数据驻留 | 价格/能力页声明支持中国国内；SDK manifest 包含中国域名；具体 region、SLA 和可达性需合同/POC | SDK 明确提供 `adjust.cn`/`adjust.world` 策略，数据驻留公开支持 US/EEA/Turkey | 本次官方资料未找到同等级的中国网络承诺 | Adjust 在公开的中国配置证据上更强，作为第一回退 |
| Privacy Manifest | 当前默认 SDK manifest 声明 Device ID、Product Interaction 和 tracking；另有去除 IDFA/AdSupport 的 Strict SDK | 当前 SDK manifest 声明 Device ID、Product Interaction 和 tracking，并提供 consent/URL strategy | 当前 manifest 声明 Device ID 和 tracking；支持 reduced/none 等隐私级别 | 三者均不能“无审查即接入” |
| SDK 大小/启动 | 官方没有可横向比较的 release-build 增量数字 | 官方没有可横向比较的 release-build 增量数字 | 官方给出约 220 KB、初始化中位数约 80-250 ms | 必须以 OneKey release IPA 和冷启动指标做同口径 POC |
| 价格与 raw data | Growth 公示为免费额度后每 conversion USD 0.07；raw API/Data Locker 属于 premium/套餐能力 | 公开文档以合同阈值和套餐为准 | 公开三档套餐但没有可比较单价；完整 partner 数量需要更高套餐 | 采购必须拿同一流量模型报价 |
| 数据保留/DPA | 公开 DPA；服务隐私政策默认终端用户数据最长 24 个月，客户/合同可进一步约束 | 可配置 consent expiry 和 retention，公开上限 25 个月；DPA/SLA 需采购核验 | 有 DPA、privacy controls；具体 retention/SLA 需采购核验 | OneKey 要求最小保留并以合同覆盖删除、导出和退出条款 |

不选择 `none`：X 官方要求使用认可 MMP；自行维护 Google、Meta、TikTok、Snap 的不同回传、账户授权、字段限制和 API 演进会持续产生客户端与服务端重复开发。

不首选 `Adjust`：它在中国 URL strategy 和数据驻留的公开说明更清楚，但本次公开证据无法像 AppsFlyer 一样确认“Apple SKAN/AAK copy -> MMP -> OneKey Push API”的完整转发链。若 AppsFlyer 的中国可达性、数据驻留或合同不通过，Adjust 是唯一预设回退。

不选择 `Branch`：其强项是 deep link/Ad Link，和 OneKey Short Link 的产品边界重叠最大；官方迁移材料也更倾向替换既有广告链接。选择 Branch 会增加链接迁移和双控制面的长期成本。

#### 平台差异与投放方式

| 场景 | 实际投放入口 | 归因/优化数据 | OneKey Short Link 的角色 | 不可消除的限制 |
| --- | --- | --- | --- | --- |
| 自有渠道/KOL | OneKey Short Link -> App Store Campaign URL (`pt/ct/mt`) | Short Link click + App Store Connect campaign aggregate | 主入口；`ct` 按 KOL/会话批次细分 | 无法把 App Store aggregate 反查到具体安装用户 |
| Apple Ads | Apple Ads 创建的 App Store 广告，不投普通 MMP link | Phase 2 AdServices 实例归因 + Apple SKAN/AAK/MMP 报表 | 不参与付费广告跳转 | AdServices 是 Apple Ads 专属，不覆盖其他平台 |
| Google App Campaign | Google Ads 内选择 App；SAN/AAP 账户连接，不需要 OneKey 点击链接 | Google modeled + SKAN；实现 ODM 后增加 ICM | 仅用于独立 owned campaign，不插入 Google SAN 链路 | ODM 仍需要 Firebase 或 standalone ODM；MMP 不能消除这项 Google 特例 |
| Meta App Ads | Meta Ads 内选择 App；通过 AppsFlyer partner integration 回传事件 | Meta AEM/aggregate + SKAN + AppsFlyer reporting | 不插入 SAN 链路 | 未获 ATT 时不得承诺 user-level；Meta 可能只向 MMP 提供 aggregate SKAN 数据 |
| TikTok App Ads | TikTok Ads Manager + AppsFlyer MMP connection | MMP events + SKAN | 不插入 SAN 链路 | 全 App 只能一个 CV writer；若以后加 TikTok SDK，必须关闭其 SKAN handling |
| Snap App Ads | Snap Ads Manager + AppsFlyer MMP connection | Snap privacy measurement + SKAN | 通常不插入 SAN 链路 | view-through 的 log-level campaign 字段会被平台删除 |
| X App Ads | X Ads + 认可 MMP | AppsFlyer/X integration + SKAN | 不插入 SAN 链路 | X 不提供无 MMP 的 Ads API 直接替代方案 |
| 其他 non-SAN | 广告平台认可的 AppsFlyer measurement URL/tracking template | AppsFlyer click/view + Apple postback | OneKey 仍管理 campaign registry；只有平台允许 redirect chain 时才把 MMP URL 作为 Short Link destination | 不能假设所有平台都接受短链嵌套或多次重定向 |

MMP 不会让所有平台变成相同协议。统一的是 OneKey 内部事件、campaign key、数据接入和报表口径；Google ODM、Meta AEM、Snap log-level 限制等仍作为 provider capability，而不是散落在 App 业务代码里的条件分支。

#### 唯一所有权和运行时设计

```text
iOS main runtime
  OneKey AttributionEventGateway
    -> OneKey fact event (existing logger/Utility)
    -> AppsFlyerAdapter (allowlisted event only)
         -> AppsFlyer SDK is the only SKAN/AAK conversion writer

Apple device
  SKAN endpoint + AAK endpoint
    -> AppsFlyer (single postback sink owner)
         -> AppsFlyer Push API / raw export
              -> Utility AppsFlyer ingestion adapter
                   -> AttributionObservations / DailyMetrics
```

App 约束：

1. AppsFlyer 只在 iOS production main runtime 初始化；bg 不导入、不初始化、不上报。原生 SDK singleton 属于进程资源，但调用所有权只给 main；不能依赖 main/bg 初始化顺序。
2. 初始版本不请求 ATT，不接 Meta/TikTok/Snap 独立 SDK，不向 AppsFlyer发送钱包地址、账户 ID、资产、余额、币种、交易或收入字段。
3. `install_open`、`onboarding_complete`、`activation`、`retained_d2/d7/d30` 只能从一个 `AttributionEventGateway` 进入；业务代码不知道 AppsFlyer event name。
4. AppsFlyer 保持唯一 CV writer；禁止任何内部代码、Firebase、Meta、TikTok 或其他 SDK 调 Apple conversion update API。
5. 保留 Phase 2 OneKey AdServices 路径，并在 AppsFlyer 设置 `disableAppleAdsAttribution=true` 关闭 AdServices 自动归因，避免同一个 Apple Ads install 产生两个未经标记的事实来源。不要使用已经只针对旧 iAd 的 `disableCollectASA` 代替它。
6. OneLink/deferred deep link 不初始化；OneKey Short Link 继续服务 owned/KOL。若某 non-SAN 强制使用 MMP link，只在服务端 campaign binding 记录，不向 App 暴露 provider 分支。
7. SDK 版本必须锁定；接入 PR 必须检查该版本的 Privacy Manifest、App Store privacy labels、release IPA 增量、main-thread 时间和首次网络请求字段。

Utility 约束：

1. 新增 `AppsFlyerProviderAdapter`，接收经过签名/共享密钥保护的 Push API 或拉取 Data Locker；不得让普通公网请求伪造 MMP observation。
2. 保存 provider record ID、Apple postback ID、schema version、received time、measurement method 和 raw-object reference，按 provider ID + postback ID 去重。
3. 只有拿到 Apple 原始 postback/JWS 且验证链完整的数据才标 `apple_verified`；MMP enrichment、platform aggregate 和 modeled data分别标记，不能合并成一个“安装”。
4. Apple privacy postback 不强行关联 `installationId` 或用户。只有 Phase 2 AdServices 和明确允许的 MMP device attribution可以形成安装实例 observation；SKAN/AAK 主要按 campaign/date 聚合对账。
5. Provider event mapping、campaign binding 和 sync checkpoint 由服务端配置；新增广告平台不得要求 App 新增业务事件调用。

#### 商业、隐私和 POC hard gates

在 Phase 4 添加 SDK 前，Owner 必须拿到并归档以下 AppsFlyer 书面结论：

- SKAN 4 与 AdAttributionKit 都由当前 iOS/RN SDK 的同一个 conversion schema/writer 管理，并说明关闭/迁移行为。
- Apple AAK Push API 样例包含 `postback-identifier`、JWS/签名或等价的可验证原始字段；否则不得标为 `apple_verified`。
- Growth/Enterprise 中 Push API、Data Locker、raw postback copy、API 限额、历史回补和退出导出的准确价格。
- 中国大陆 iOS SDK endpoint、DNS/TLS 可达性、fallback 行为、数据实际驻留位置及跨境条款。
- DPA、subprocessor、删除 SLA、备份删除、24 个月默认保留如何缩短，以及合同终止后的完整导出期限。
- OneKey 加密货币钱包业务允许接入；广告平台自身的加密货币投放准入由营销/法务另外处理，MMP 合同不能替代平台审批。
- SDK Strict/no-IDFA 方案是否仍完整支持所需的 SKAN/AAK、Google/Meta/TikTok/Snap/X 集成，以及对应 App Privacy disclosure。

同一 release 配置下做三组基线：无 MMP、AppsFlyer Strict、AppsFlyer standard-no-ATT。至少测量 IPA 增量、首次可交互时间、main-thread 阻塞、首次启动请求数/域名/字段和 main/bg 初始化次数。只有 AppsFlyer 通过 hard gate 才进入 Phase 4；失败时用相同脚本测 Adjust，不能同时打包两家 SDK。

#### Phase 3 交接记录（2026-08-21）

```text
Status: READY_FOR_ACCEPTANCE
Completed at: pending user acceptance
Repositories changed:
  - app-monorepo handoff document only
Code/SDK changes: none
Decision:
  - selectedMmp=appsflyer
  - conversionOwner=mmp
  - postbackSinkOwner=mmp
Validation results:
  - Apple, AppsFlyer, Adjust, Branch, Google, TikTok, Snap and X official documentation reviewed.
  - Current official iOS SDK privacy manifests inspected for AppsFlyer, Adjust and Branch.
  - Repository scan found no existing AppsFlyer/Adjust/Branch dependency and no existing SKAN/AAK conversion writer call.
  - Existing OneKey Short Link and Phase 2 AdServices ownership remain unchanged.
Known limitations:
  - Comparable AppsFlyer/Adjust SDK size and startup numbers are not publicly standardized; OneKey release-build POC is mandatory.
  - Commercial price, SLA, China route, data residency, crypto acceptance and AAK raw export completeness require vendor confirmation.
  - Google ODM is an explicit optional platform module even after selecting an MMP.
Decision required before next phase:
  - User accepts AppsFlyer as the conditional selected MMP and authorizes Phase 4 POC/implementation preparation.
  - Procurement/Legal accepts the listed hard gates before any production SDK release.
```

### Phase 4：统一归因事件与 Conversion Writer

范围取决于 Phase 3：

- `internal`：App 实现唯一 Apple Conversion Writer，同时调用受支持的 SKAN/AAK API。
- `mmp`：App 只集成一个选定的 MMP writer，关闭其他 SDK 的 CV 更新。

Conversion schema 必须版本化、发布后不可变，并覆盖 Apple 三个窗口：

```text
Window 1: day 0-2, fine + coarse
Window 2: day 3-7, coarse
Window 3: day 8-35, coarse
```

用户第一次启动时固定 schema version，至少保留完整解释能力到最后一个 postback 可能到达之后。旧版和新版 schema 必须并存，禁止原地修改已发布版本。

验收条件：

- 运行时只能观察到一个有效 writer。
- 重复、乱序、降级和跨窗口更新测试通过。
- iOS 15.5 至当前支持版本具有 availability guard。
- 事件不包含钱包和财务敏感字段。
- SDK/Writer 对冷启动耗时和包体积影响有前后基线。

### Phase 5：Apple postback 数据面

当 `postbackSinkOwner=internal`：

- Utility 提供 Apple endpoint。
- 验证 JWS 签名。
- 按 `postback-identifier` 去重。
- 原始载荷和规范化结果分层保存。
- 成功返回 200；对可重试失败保持正确状态码。
- 支持 source identifier 2/3/4 位和 privacy withheld 字段。
- 支持三个 postback sequence 和至少 41 天的迟到数据处理。

当 `postbackSinkOwner=mmp`：

- 不重复建设 Apple public endpoint。
- Utility 实现 MMP raw export/webhook/API 导入。
- 保存 MMP record ID、Apple postback ID 和导入游标，保证去重与可重放。
- 验证导入数据是否包含 Apple 原始签名/原始 postback；缺失项在报表中标记来源能力边界。

### Phase 6：广告平台适配与统一报表

Utility：

- Google、Meta、TikTok 或 MMP Provider Adapter。
- campaign、delivery metrics、attribution metrics 增量同步。
- first-party event 到平台标准事件的白名单映射。
- checkpoint、限流、重试、死信和连接诊断。

Server Dashboard：

- Provider/account/campaign/binding/schema 管理 API。
- 统一报表和 reconciliation API。
- 复用 Utility 写、Dashboard Server 读共享 Mongo collection 的现有模式。

Dashboard：

- Provider 和账号连接状态。
- Campaign binding 和批量导入。
- Schema draft/publish 和唯一 writer 状态。
- `apple_verified`、`platform_observed`、`platform_modeled`、`first_party`、`app_store_aggregate` 标签。
- raw/modelled 切换和 reconciliation gap，不显示虚假的唯一“总安装数”。

## 9. 每阶段交接模板

每完成一个阶段，在对应章节追加：

```text
Status: DONE | BLOCKED
Completed at:
Repositories changed:
Files changed:
Commits/PRs:
Validation commands:
Validation results:
Manual evidence:
Known limitations:
Decision required before next phase:
```

如果验证失败，不通过小改反复试探；先在本文档记录复现条件、根因和下一步，再继续修改。

## 10. 官方参考

Apple：

- AdAttributionKit 与 SKAdNetwork 互操作：<https://developer.apple.com/documentation/adattributionkit/adattributionkit-skadnetwork-interoperability>
- Postback 字段：<https://developer.apple.com/documentation/adattributionkit/identifying-the-parameters-in-a-postback>
- 多 conversion windows：<https://developer.apple.com/documentation/AdAttributionKit/receiving-postbacks-in-multiple-conversion-windows>
- Postback 验证：<https://developer.apple.com/documentation/adattributionkit/verifying-a-postback>
- Apple Ads AdServices API：<https://ads.apple.com/adsdam/us/en_us/documents/help/0028-apple-ads-attribution-api/2025-03-25/AdServices-API-v3.pdf>
- Apple Ads AdAttributionKit：<https://ads.apple.com/app-store/help/attribution/0093-adattributionkit-to-measure-performance>

Google：

- GA4 SKAN：<https://support.google.com/analytics/answer/13168376?hl=en>
- Google Ads conversion schema：<https://support.google.com/google-ads/answer/13286653?hl=en>
- iOS on-device measurement：<https://support.google.com/google-ads/answer/12119136?hl=en>
- App Conversion API：<https://developers.google.com/app-conversion-tracking/api/integrated-conversion-measurement>
- App Attribution Partners：<https://support.google.com/google-ads/answer/12961402?hl=en>
- iOS App campaign measurement methods：<https://support.google.com/google-ads/answer/16771743?hl=en>

Meta：

- SKAN 4 与 App campaign：<https://d3m889aznlr23d.cloudfront.net/img/events/458773316/assets/c973d989.maximize-your-customer-engagement--through-apps-with-advantage-app-campaigns--leave-behind_en_us.pdf>
- Conversions API：<https://www.facebook.com/business/help/AboutConversionsAPI>

TikTok：

- SKAN 4：<https://ads.tiktok.com/help/article/about-skan-4-0-and-tiktok?lang=en>
- App Events SDK integration：<https://ads.tiktok.com/help/article/how-to-integrate-tiktok-app-events-sdk/>
- Events API：<https://ads.tiktok.com/help/article/events-api?lang=en&redirected=2>

Snap 与 X：

- Snap SKAN：<https://businesshelp.snapchat.com/articles/en_US/Knowledge/skadnetwork>
- X mobile app measurement：<https://business.x.com/en/help/campaign-setup/create-an-app-installs-campaign/mobile-app-measurement-and-attribution>
- X 认可 MMP 列表：<https://business.x.com/en/resources/mobile-app-advertising-guide>

MMP：

- AppsFlyer SKAN Conversion Studio：<https://support.appsflyer.com/hc/en-us/articles/4403727223185-SKAN-Conversion-Studio>
- AppsFlyer iOS SDK、SKAN/AAK copy endpoint：<https://dev.appsflyer.com/hc/docs/integrate-ios-sdk>
- AppsFlyer Apple copy 转发：<https://support.appsflyer.com/hc/en-us/articles/4402320969617-Send-SKAN-and-AdAttributionKit-postback-copies-directly-to-AppsFlyer-iOS-15>
- AppsFlyer raw report：<https://support.appsflyer.com/hc/en-us/articles/360014261518-SKAN-raw-data-reports>
- AppsFlyer iOS API（writer、Apple Ads、IDFV 控制）：<https://dev.appsflyer.com/hc/docs/ios-sdk-reference-appsflyerlib>
- AppsFlyer Strict SDK：<https://dev.appsflyer.com/hc/docs/install-ios-sdk>
- AppsFlyer 价格：<https://www.appsflyer.com/pricing/full/>
- AppsFlyer 数据保留：<https://www.appsflyer.com/legal/services-privacy-policy/>
- AppsFlyer Privacy Manifest：<https://github.com/AppsFlyerSDK/AppsFlyerFramework/blob/master/Resources/PrivacyInfo.xcprivacy>
- Adjust SKAN/AdAttributionKit：<https://dev.adjust.com/en/sdk/ios/features/skad/>
- Adjust 中国 URL strategy：<https://dev.adjust.com/en/sdk/ios/features/privacy/>
- Adjust 数据驻留：<https://help.adjust.com/en/article/getting-started-with-adjust>
- Adjust Privacy Manifest：<https://github.com/adjust/ios_sdk/blob/master/Adjust/PrivacyInfo.xcprivacy>
- Branch iOS SDK 大小/启动/依赖：<https://help.branch.io/developer-hub/docs/ios-basic-integration>
- Branch SKAN writer opt out：<https://help.branch.io/developer-hub/docs/advanced-skadnetwork-sdk-configuration>
- Branch SAN 支持矩阵：<https://help.branch.io/marketer-hub/docs/self-attributing-networks-sans>
- Branch direct postback/export：<https://help.branch.io/marketer-hub/docs/skadnetwork-direct-postback>
- Branch Privacy Manifest：<https://github.com/BranchMetrics/ios-branch-deep-linking-attribution/blob/master/Sources/Resources/PrivacyInfo.xcprivacy>
