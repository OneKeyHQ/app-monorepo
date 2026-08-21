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
| Phase 2：Apple Ads AdServices | `IN_PROGRESS` | - | App + Utility |
| Phase 3：MMP 与所有权决策 | `BLOCKED_BY_PHASE_2` | - | 决策阶段，不接 SDK |
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
Commits/PRs: none
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

- iOS 模拟器/无归因环境不崩溃。
- 真机测试请求路径可观察，但日志中没有 token。
- Utility mock Apple API 的成功、无归因、失败、重复场景测试通过。
- App `yarn agent:check --profile commit` 通过。
- Utility 聚焦测试、lint、build 通过。

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

MMP：

- AppsFlyer SKAN Conversion Studio：<https://support.appsflyer.com/hc/en-us/articles/4403727223185-SKAN-Conversion-Studio>
- Adjust SKAN/AdAttributionKit：<https://dev.adjust.com/en/sdk/ios/features/skad/>
