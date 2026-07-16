# OK-57861 v6.4.0 Displayed URL Compatibility QA Handoff

**Date:** 2026-07-16
**Status:** v6.4.0 displayed-URL audit complete; compatibility gaps fixed; automated route tests passing
**PR:** https://github.com/OneKeyHQ/app-monorepo/pull/12496
**Base:** `hotfix/v6.5.1`
**Branch:** `codex/fix-ok-57861`

## QA summary

This change preserves every URL that v6.4.0 was allowed to display from navigation state while keeping the Web cold-start router path-only and build-generated.

The audit found three compatibility gaps in the current cold-start projection:

1. Staking `ManagePosition` was displayed in v6.4.0 but was absent from the generated cold-start config.
2. `TxConfirmFromDApp` and `MessageConfirmFromDApp` were displayed in v6.4.0 on all targets, but the current static projection exposed them only to Extension.
3. Development-only `TestSimpleModal` was displayed in v6.4.0 but was absent from the development cold-start config.

All three gaps are fixed. The complete Signature Confirm or DApp Connection stacks were **not** exposed to Web; only the two historically displayed signature routes were restored.

## What “displayed URL” means

The v6.4.0 source of truth is `packages/shared/src/utils/routeUtils.ts` at tag `v6.4.0`. Its `showUrl` entries control navigation state to browser URL serialization. They do not define which screens render.

In v6.4.0, inbound URL parsing used the complete runtime router. Therefore, an inbound route could work even when it was not in the `showUrl` registry. `RewardCenter` is the important example: it was inbound-parseable at `/reward-center`, but v6.4.0 did not actively display that URL.

The current implementation is hybrid:

- `Main` tab routes continue to come from the complete dynamic `tabRouter` in `useRootRouter()`.
- non-`Main` cold-start routes come from the path-only JSON generated before build.
- route metadata remains declared beside the full router with `allowColdStart`; the generated JSON is never committed.

This is why the audit checks both directions:

1. v6.4.0 navigation state can still produce the same displayed URL and parameter policy;
2. the current cold-start parser can turn that URL back into the same route chain.

## v6.4.0 production displayed URL inventory

Use a normal path on Web and prefix the same path with `#` for Extension pages. Example:

```text
Web:       https://<host>/onboarding/get-started
Extension: chrome-extension://<id>/ui-expand-tab.html#/onboarding/get-started
```

`showParams=false` means navigation params must not be written into the visible URL. `showParams=true` allows eligible params to be serialized.

| # | v6.4.0 displayed URL | Expected route chain | Params | Before this patch | After this patch |
|---:|---|---|---|---|---|
| 1 | `/market/tokens/:token` | Main > Market > MarketDetail | shown | Compatible through dynamic Main router | Same |
| 2 | `/market/token/:network/:tokenAddress` | Main > Market > MarketDetailV2 | shown | Compatible through dynamic Main router | Same |
| 3 | `/market/token/:network` | Main > Market > MarketNativeDetail | shown | Compatible through dynamic Main router | Same |
| 4 | `/refer-friends` | Main > ReferFriends > TabReferAFriend | hidden | Compatible through dynamic Main router; non-Native only | Same |
| 5 | `/refer-friends/invite-reward` | Main > ReferFriends > TabInviteReward | hidden | Compatible through dynamic Main router; non-Native only | Same |
| 6 | `/defi` | Main > Earn | shown | Compatible through dynamic Main router | Same |
| 7 | `/market` | Main > Market | shown | Compatible through dynamic Main router | Same |
| 8 | `/defi/staking/:symbol/:provider` | Modal > StakingModal > ProtocolDetails | shown | Compatible through generated router | Same |
| 9 | `/defi/staking/v2/:symbol/:provider` | Modal > StakingModal > ProtocolDetailsV2 | shown | Compatible through generated router | Same |
| 10 | `/ManagePosition` | Modal > StakingModal > ManagePosition | shown | **Missing from generated router** | **Restored** |
| 11 | `/swap` | Main > Swap > TabSwap | shown | Compatible through dynamic Main router | Same |
| 12 | `/onboarding/get-started` | Onboarding > OnboardingV2 > GetStarted | shown | Compatible through generated router | Same |
| 13 | `/modal/ReferFriendsModal/ReferAFriend` | Modal > ReferFriendsModal > ReferAFriend | hidden | Compatible through generated router | Same |
| 14 | `/modal/SignatureConfirmModal/TxConfirmFromDApp` | Modal > SignatureConfirmModal > TxConfirmFromDApp | shown | **Extension-only in generated router** | **Restored for all targets** |
| 15 | `/modal/SignatureConfirmModal/MessageConfirmFromDApp` | Modal > SignatureConfirmModal > MessageConfirmFromDApp | shown | **Extension-only in generated router** | **Restored for all targets** |
| 16 | `/modal/update/preview` | Modal > AppUpdateModal > UpdatePreview | shown | Compatible through generated router | Same |
| 17 | `/bulk-send-addresses` | Main > Home > TabHomeBulkSendAddressesInput | hidden | Compatible through dynamic Main router | Same |
| 18 | `/bulk-send-amounts` | Main > Home > TabHomeBulkSendAmountsInput | hidden | Compatible through dynamic Main router | Same |
| 19 | `/redeem-bitcoin-voucher` | Main > Home > TabHomeRedeemBitcoinVoucher | shown | Compatible through dynamic Main router | Same |
| 20 | `/perps` | Main > Perp **or** Main > WebviewPerpTrade | shown | Compatible through dynamic Main router | Same |

The `/perps` destination follows the same v6.4.0 feature flags:

- `perpTabShowWeb=true`: `WebviewPerpTrade`;
- otherwise, `perpDisabled=false`: `Perp`;
- otherwise the URL is not displayed.

## Target-conditional displayed URLs

### Extension production

| URL | Expected route | v6.4.0 | Current |
|---|---|---|---|
| `/permission/web-device` | PermissionWebDevice | Displayed only in Extension | Compatible; frozen hash-parser test added |

Extension approval routes that are cold-startable today but were not in the v6.4.0 `showUrl` registry are outside this displayed-URL compatibility list. They remain Extension-only.

### Development builds

v6.4.0 additionally displayed:

- every `EGalleryRoutes` value under `Main > Developer`;
- `TabDeveloper`;
- `DevHome`;
- `DevHomeStack1`;
- `DevHomeStack2`;
- `Modal > TestModal > TestSimpleModal`.

The Developer and Gallery family remains compatible through the complete dynamic Main router. `TestSimpleModal` was the only development-only static gap and is now opted into the development generated config. Development-only routes remain absent from production output.

## Reward Center and Staking comparison

### Reward Center

| Version | Displayed by `showUrl` | Inbound `/reward-center` | Result |
|---|---|---|---|
| v6.4.0 | No | Yes, through the complete router | Baseline behavior |
| Before this PR’s fixes | No | Could be lost by the lightweight cold-start parser | Compatibility risk |
| Current | No | Yes, explicitly generated and tested | Preserves v6.4.0 semantics |

QA should verify that opening `/reward-center` enters `Modal > MainModal > RewardCenter`. It is expected that ordinary navigation does not necessarily rewrite the address bar to `/reward-center`, because that was not a v6.4.0 display rule.

### Staking

| URL | v6.4.0 displayed | Current cold start | Notes |
|---|---|---|---|
| `/defi/staking/:symbol/:provider` | Yes | Yes | Same rewrite and route chain |
| `/defi/staking/v2/:symbol/:provider` | Yes | Yes | Same rewrite and route chain |
| `/ManagePosition` | Yes | **Restored by this patch** | Exact root-level path; casing is intentional |
| `/defi/:network/:symbol/:provider` | No | Yes | `ProtocolDetailsV2Share`; current inbound capability, not a v6.4.0 display rule |

## Code changes

- `packages/kit/src/views/Staking/router/index.tsx`
  - opts `ManagePosition` into cold-start generation.
- `packages/kit/src/routes/Modal/router.tsx`
  - opts the normal `SignatureConfirmModal` parent into generation;
  - opts the development-only `TestModal` parent into development generation.
- `packages/kit/src/views/SignatureConfirm/router/index.tsx`
  - opts only `TxConfirmFromDApp` and `MessageConfirmFromDApp` into every target;
  - all other signature routes keep their existing Extension-only policy.
- `packages/kit/src/views/TestModal/router/index.ts`
  - opts `TestSimpleModal` into development generation.
- `packages/kit/src/routes/legacyDisplayedDeepLinks.v640.test.tsx`
  - freezes the v6.4.0 production compatibility contract.
- `packages/kit/src/routes/routerPathConfig.test.ts`
  - tests restored static paths, Extension permission, target isolation, and the development route.

## Automated test coverage

### Frozen v6.4.0 compatibility contract

`legacyDisplayedDeepLinks.v640.test.tsx` contains one test for every production displayed URL in the table above and a second `/perps` feature-flag variant: 21 cases total.

Each case executes the actual current `useRootRouter()` and verifies:

1. `getStateFromPath()` parses the legacy URL;
2. the focused route chain matches v6.4.0;
3. `buildAllowList()` still marks it `showUrl=true`;
4. `showParams` matches v6.4.0.

This is intentionally a frozen compatibility list. A future router refactor cannot update the test merely to match its new output; changing an entry requires an explicit public-URL migration decision.

### Generated/static parity

`routerPathConfig.parity.test.ts` independently executes the runtime route declarations for:

- Web;
- Web Embed;
- Extension;
- Desktop;
- iOS;
- Android;
- Native;
- production and development modes.

It compares the result with the generated path-only JSON and parses every generated parameterized path and query parameter. This catches drift between the full router metadata and build output without committing generated assets.

### Target isolation and regression cases

`routerPathConfig.test.ts` verifies:

- all approved Onboarding entry paths;
- all restored Staking and signature paths;
- Reward Center;
- App Update and Settings paths;
- Extension-only DApp approval routes remain unavailable on Web;
- the v6.4.0 Extension permission hash;
- the v6.4.0 development-only Test modal;
- internal runtime routes remain unavailable;
- development-only routes stay out of production.

Automated result:

```text
Test suites: 3 passed, 3 total
Tests:       83 passed, 83 total
```

Generation integrity result:

```text
Cold-start route config is up to date
Targets: web, web-embed, ext, desktop, ios, android, native
Generation time: 4.799 seconds
```

Local Web-budget execution on Windows is not recorded as passing: the repository
runner failed before building because it invokes `spawn yarn` and Windows could
not resolve it (`ENOENT`; `yarn.cmd` is available). A direct Rspack build was
started as a workaround but was interrupted before completion. CI or a Unix
development environment must run `yarn perf:web:cold`; do not waive this gate.

## Generated asset size and build policy

The generated route JSON is build output and remains ignored by Git. It must be regenerated before each applicable build through `yarn routes:generate`; CI can verify it with `yarn routes:check`.

Current uncompressed generated JSON sizes after the compatibility fixes:

| Target/mode | Route nodes | JSON bytes |
|---|---:|---:|
| Web production | 24 | 2,614 |
| Web development | 27 | 2,809 |
| Extension production | 85 | 7,084 |
| Extension development | 88 | 7,279 |

For comparison, before this compatibility patch Web production was 20 nodes / 2,271 bytes and Extension production was 84 nodes / 6,987 bytes. No budget threshold was changed or relaxed.

## QA test matrix

Run at least the following on a production Web build and a production Extension build.

| Area | Input URL | Expected result |
|---|---|---|
| Market | `/market/tokens/BTC` | MarketDetail opens for BTC |
| Market | `/market/token/evm--1/0x0000000000000000000000000000000000000000` | MarketDetailV2 opens; network and address are parsed |
| Market | `/market/token/evm--1` | MarketNativeDetail opens |
| Referral | `/refer-friends` | Refer-a-friend tab opens; unrelated navigation params are not displayed |
| Referral | `/refer-friends/invite-reward` | Invite Reward tab opens; unrelated navigation params are not displayed |
| Earn | `/defi` | Earn tab opens |
| Market root | `/market` | Market tab opens |
| Staking | `/defi/staking/ETH/lido` | ProtocolDetails opens with symbol/provider |
| Staking v2 | `/defi/staking/v2/ETH/lido` | ProtocolDetailsV2 opens with symbol/provider |
| Staking position | `/ManagePosition?accountId=<valid-account-id>` | ManagePosition opens; exact casing works |
| Swap | `/swap` | Swap opens |
| Onboarding | `/onboarding/get-started` | Get Started opens from a fresh process/tab |
| Referral modal | `/modal/ReferFriendsModal/ReferAFriend` | ReferAFriend modal opens |
| DApp transaction | `/modal/SignatureConfirmModal/TxConfirmFromDApp?query=<valid-payload>` | Parser enters TxConfirmFromDApp; invalid payload fails safely rather than changing route |
| DApp message | `/modal/SignatureConfirmModal/MessageConfirmFromDApp?query=<valid-payload>` | Parser enters MessageConfirmFromDApp; invalid payload fails safely rather than changing route |
| Update | `/modal/update/preview` | Update Preview opens |
| Bulk send | `/bulk-send-addresses` | Address input step opens |
| Bulk send | `/bulk-send-amounts` | Amount input step opens |
| BTC voucher | `/redeem-bitcoin-voucher` | Voucher page opens |
| Perps | `/perps` | Destination follows the current Perp feature flags |
| Reward Center | `/reward-center` | Reward Center opens although it is not a displayed-URL rule |
| Extension WebUSB | `#/permission/web-device?requestId=<id>` | PermissionWebDevice opens only in Extension |

Also verify these negative cases:

- `/modal/DAppConnectionModal/ConnectionModal` must not cold-start on ordinary Web.
- `/modal/ApprovalManagementModal/BulkRevoke` must not cold-start.
- `/fullScreenPush/ActionCenter/ActionCenter` must not cold-start.
- `/RootWebView/WebView/WebView` must not cold-start.
- a production build must not contain `/modal/TestModal/TestSimpleModal`.

For Extension cold-start validation, close the prior expanded page before each case so navigation state is reconstructed from the hash rather than reused from an already-running UI.

## Commands for developers and CI

```powershell
yarn routes:check
yarn jest packages/kit/src/routes/routerPathConfig.test.ts packages/kit/src/routes/legacyDisplayedDeepLinks.v640.test.tsx packages/kit/src/routes/routerPathConfig.parity.test.ts --runInBand
yarn perf:web:cold
```

The Web performance command must use the committed thresholds in `development/perf-ci/thresholds/web.cold.json`. This change does not authorize increasing them.

## Acceptance criteria

- every production URL in the v6.4.0 inventory parses into the same route chain;
- its `showUrl` and `showParams` behavior remains unchanged;
- Reward Center remains inbound-compatible without becoming a displayed URL;
- Extension-only approval routes do not become public Web cold-start routes;
- development-only routes do not enter production output;
- generated JSON is absent from the commit and reproduced by the build;
- route generation/parity tests and the configured Web cold-start budget pass.
