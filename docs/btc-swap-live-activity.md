# OK-60951 App / server Live Activity contract

Status: App-local implementation and mock transport; all HTTP routes and payloads below are **unapproved proposals**, not deployed endpoints or a contract to implement without service-owner review. The example includes fields that must be minimized after server-side order resolution is verified. No synthetic order or token is sent to production. Scope: native Bitcoin mainnet BTC outflow through Swap/Bridge, iOS only. Figma governs presentation; Jira governs remaining business rules.

## Existing capabilities and boundaries

| Capability | Existing source | Reuse / gap |
|---|---|---|
| Successful deposit broadcast | useSwapBuiltTx → swapBroadcastSuccess → generateSwapHistoryItemForContext → ServiceSwap.addSwapHistoryItem | Reused. Signed-but-not-broadcast and broadcast failure never start a card. |
| Authoritative order state | ServiceSwap.fetchTxState → POST /swap/v1/state-tx | Reused while the App runs. Request: txId, networkId, provider, protocol, orderId, ctx, toTokenAddress, receivedAddress. `swapInfo.orderId` is the service order identity; `txInfo.orderId` can be a provider identity. |
| ETA | build result `estTime` minutes or `estimatedTime` seconds | Persist seconds in swap history. Freeze startedAtMs + estimatedEndAtMs in native attributes. Nonpositive/missing estimate becomes 600 seconds. |
| Activity target / signing | Imported PR #14021 and App target configuration | Widget target, App Group and extension embedding are present. The iOS release workflow is intentionally identical to x and does not explicitly prepare the Live Activity profile or sync its version. Simulator builds do not prove signed release packaging. |
| Push token binding | JPush iOS 5.9.0 supports `registerLiveActivity(activity.id,pushToken,completion,seq)` | App-only activities do not request or register a push token. Enabling the remote path requires an agreed subscription and single-writer handoff. |
| Server tracking + notification subscription | Not verified in current server APIs | Replaceable `ILiveActivitySubscriptionTransport`. Real path returns `awaitingServer`; mock returns `mocked`. Neither claims production registration. |
| Closed/suspended App | JS polling cannot supply dependable updates | Server must track the order and send ActivityKit update/end pushes through configured JPush/APNs. Native local tasks are best-effort only. |
| macOS | Apple system mirroring | No custom Electron notification code. Simulator evidence does not prove physical iPhone-to-Mac mirroring. |

Current App implementation entry points:
- `packages/shared/types/liveActivity.ts`: versioned DTOs, subscription transport, full push content.
- `packages/shared/src/utils/liveActivityUtils.ts`: eligibility, state mapping, stable identity, time projection, push-content builder.
- `packages/kit-bg/src/services/ServiceLiveActivity`: lifecycle, replaceable transport and dev-only mock scenarios.
- `apps/mobile/ios/LiveActivity`: ActivityAttributes, actual WidgetKit four surfaces and bundled Figma artwork.
- `apps/mobile/ios/OneKeyWallet/LiveActivityDemoModule.swift`: serialized native state mutations, native dedupe/tokens/artwork cache.

## Identity and immutable fields

`orderKey` is a local, stable operation identity: persisted `swapInfo.liveActivityOrderKey`, otherwise `swap:<serviceOrderId>`, otherwise `<networkId>:<initialDepositTxId>`. It is saved before replacement transactions can change txId. Late service-order discovery must not change an existing key. `activityId` is the opaque ActivityKit instance ID; it is not an order ID or push token.

Native attributes freeze order start/end, original deposit txId, tokens and identity. `tracking.currentDepositTxId` carries the current replacement deposit to the subscription upsert. A backend must use an authoritative order record when available; otherwise explicitly resolve the supplied provider/state-tx context. Never guess by token ticker, amount or latest order.

Order timestamps and ContentState timestamps use epoch **milliseconds**; APNs `aps.timestamp`, `stale-date`, `dismissal-date` use epoch **seconds**. All numeric revisions must be safe nonnegative integers and monotonically increasing for an activity. Native accepts newer legal states, preserves done/refunded/canceled, and permits failed → refunding/refunded. A refunding coarse FAILED state continues through the existing App poller, including restart, for at most eight hours. Whether a plain FAILED can later become refunding has not been established; existing polling does not guarantee that transition will be detected.

## Existing request identity and authentication

The production adapter should reuse `ServiceBase.getClient(EServiceEndpointEnum.Notification)` and the existing request interceptors. Recognized OneKey endpoints carry `x-onekey-instance-id` from `settingsPersistAtom.instanceId`, plus platform/version/build/bundle, locale, currency, asset-visibility and request metadata. The instance ID is a locally generated, resettable UUID; none of these fields is an authentication credential or proof of order ownership.

Existing `/notification/v1/account/register` registration sends `client.jpushId` and, when available, `client.socketId`. The JPush registration ID comes from `JPush.getRegistrationID()` and is distinct from ActivityKit's activity ID and per-activity push token. The server owner must confirm the association and authorization between installation, JPush client, activity binding and authoritative order. This deployed-server association has not been verified.

Ordinary notification requests use the plain client without requiring OneKey ID login. `X-Onekey-Request-Token` belongs to the dedicated OneKey ID client or explicitly requested optional auth headers. `x-onekey-keyless-sync-signature` belongs to Keyless cloud-sync registration and cannot be reused as general anonymous-wallet authentication. Preserve support for anonymous wallets. Possession of an instance ID, activity ID or order ID alone must never authorize subscription changes.

Source: `packages/shared/src/request/Interceptor.ts`, `packages/kit-bg/src/services/ServiceBase.ts`, `packages/kit-bg/src/services/ServiceNotification/ServiceNotification.ts`.

HTTP test/production endpoint selection and development overrides are independent of APNs environment. Source currently initializes `PushProviderJPush` with `production: true` (forwarded as `apsForProduction`), while checked-in App entitlements declare development. This does not establish the effective signed-build environment or working push routing. Verify final signed entitlements, JPush application/environment and acknowledged activity binding before enabling subscriptions; do not change production configuration on this source-only evidence.

## Proposed subscription HTTP API

`POST /notification/v1/live-activities/subscriptions` is a proposed idempotent upsert. Its authorization mechanism must be agreed with the notification owner; the existing request metadata alone does not authenticate an installation or prove order ownership. Header `Idempotency-Key: live-activity:<activityId>`. Exact body is `ILiveActivitySubscriptionRequest`:

```json
{
  "schemaVersion": 1,
  "activityId": "activitykit-instance-id",
  "order": {
    "schemaVersion": 1,
    "orderKey": "swap:service-order-id",
    "serviceOrderId": "service-order-id",
    "depositTxId": "original-deposit-txid",
    "networkId": "btc--0",
    "provider": "provider-code",
    "fromToken": {"symbol": "BTC", "iconUrl": "https://asset-host/btc.png", "networkName": "Bitcoin"},
    "toToken": {"symbol": "USDC", "iconUrl": "https://asset-host/usdc.png", "networkName": "Ethereum"},
    "startedAtMs": 1800000000000,
    "estimatedEndAtMs": 1800000600000,
    "expiresAtMs": 1800028800000,
    "isMock": false
  },
  "tracking": {
    "currentDepositTxId": "latest-deposit-txid",
    "protocol": "Swap",
    "toTokenAddress": "destination-token-contract",
    "receivedAddress": "same-value-as-state-tx-request",
    "ctx": {"providerSpecific": "opaque existing build context"}
  }
}
```

App mock requests omit tracking and are consumed in memory. Production rejects isMock=true. Never trust client status, ownership, provider context, fixed dates or addresses without resolving/verifying the corresponding server order. Do not include wallet IDs, seeds, keys or token bytes in logs. Context/addresses are transport-only and are not native widget attributes.

Success HTTP 200/201:

```json
{"status":"registered","subscriptionId":"opaque-subscription-id","revision":1}
```

The production HTTP adapter must only return registered after server acknowledgement. Current missing-server adapter returns `{"status":"awaitingServer","revision":0}` locally. Mock returns `{"status":"mocked","subscriptionId":"mock:<activityId>","revision":1}` locally.

Repeat same activity/order is idempotent. Same activity with a different order returns 409; a replacement deposit for the same stable order updates tracking while preserving start/end and identity. App upserts again when currentDepositTxId changes. Server must tolerate subscription arriving before JPush token binding: retain pending binding, reconcile without creating a second order, and publish latest authoritative snapshot once ready.

`DELETE /notification/v1/live-activities/subscriptions/<activityId>` is idempotent, body `{orderKey,reason}` with reason dismissed|terminal|expired. 204 for already absent. Current App reconciles missing native activities on the next lifecycle/status read and clears local mock timers/subscriptions. When future remote registration is enabled, native unbinding and server-side invalid-token cleanup must be implemented and verified. Server must independently handle TTL; App callbacks are not guaranteed after termination.

Suggested errors: 400 schema/unsupported native-BTC scope; 401 existing auth invalid; 403 ownership; 404 authoritative order missing; 409 identity conflict; 422 unresolvable provider context; 429 retry-after; 5xx retriable. Retry upsert with bounded exponential backoff/jitter and same idempotency key; fail silently to the trade. Stop on hard validation/ownership errors, user dismissal, invalid token or expiresAt. Never start/resurrect an Activity from server push in this version.

## Complete ActivityKit push ContentState

RN start/update accepts only `ILiveActivityContent` (status, updatedAtMs, revision). Native derives presentation values. **APNs must send `ILiveActivityPushContent`, not the minimal RN payload.** Swift ContentState requires displayPhase, etaMinutes and almostDone too. imageRevision and progressStoppedAtMs are optional. For refunding, preserve progressStoppedAtMs at the first failure/refund transition. It freezes the red progress fill while tracking continues; do not replace it with cosmetic follow-up send time.

```json
{
  "aps": {
    "timestamp": 1800000120,
    "event": "update",
    "stale-date": 1800000590,
    "content-state": {
      "status": "swapping",
      "updatedAtMs": 1800000120000,
      "revision": 1800000120000,
      "displayPhase": "eta",
      "etaMinutes": 8,
      "almostDone": false,
      "imageRevision": 1
    }
  }
}
```

For frozen refund progress, `progressStoppedAtMs` is epoch milliseconds from the first failure/refund transition. Preserve it on every later refund tracking or cosmetic update. The red fill is `clamp((progressStoppedAtMs-startedAtMs)/(estimatedEndAtMs-startedAtMs), 0, 0.95)`; terminal states render a full bar. Missing stop time falls back to `updatedAtMs`, so repeated old-server updates could incorrectly advance the red fill.

The native RN path preserves the prior stop time. Direct APNs bypasses that merge, so the server must persist it independently. `buildLiveActivityPushContent()` is stateless and initially derives it from the supplied refund content's updatedAtMs; server adapters must replace that value with the previously recorded first stop time.

Example refund update (30% stop, immutable startedAtMs=1800000000000 and estimatedEndAtMs=1800000600000):

```json
{
  "aps": {
    "timestamp": 1800000300,
    "event": "update",
    "content-state": {
      "status": "refunding",
      "updatedAtMs": 1800000300000,
      "revision": 1800000300000,
      "displayPhase": "ring",
      "etaMinutes": 5,
      "almostDone": false,
      "imageRevision": 1,
      "progressStoppedAtMs": 1800000180000
    }
  }
}
```

For direct APNs, use `apns-push-type: liveactivity`, app topic `so.onekey.wallet.push-type.liveactivity` (the containing App bundle, not Widget bundle) and the per-activity push token. For JPush, target `live_activity_id=activityId` and map these APS fields through its Live Activity API; verify final wire mapping with the notification owner before integration. The App does not store a provider secret or APNs signing key. Widget bundle is `so.onekey.wallet.LiveActivity`, App Group `group.so.onekey.wallet`.

Status enum: confirming, swapping, receiving, refunding, done, failed, refunded, canceled. Refunding is nonterminal even if the legacy state is FAILED; refunded overrides provider coarse SUCCESS/FAILED. CANCELING + confirmed cancellation reconciles to canceled. FROM_SUCCESS/BRIDGE_PENDING/BRIDGE_SUCCESS → swapping; TO_PENDING → receiving; authoritative SUCCESS/TO_SUCCESS → done. Unknown/partial-fill never invents success. Preserve terminal truth over countdown.

`etaMinutes = ceil(max(0, estimatedEndAtMs-nowMs)/60000)`; `almostDone` when nonterminal and remaining <10000ms; `stale-date` is based on the last trusted update, not the estimated completion time. ETA never resets per step. App utility `buildLiveActivityPushContent` produces the initial ETA shape. For a presentation-only follow-up, the server adapter must replace displayPhase with ring, recompute ETA/Almost done at send time and allocate a newer revision, without inventing a business transition; preserve native imageRevision on remote updates when known. `displayPhase=eta` for a changed business state; ring for follow-up snapshots. Native local ETA→ring three-second work is not guaranteed when suspended. APNs delivery and system execution are discretionary; a cosmetic push cannot guarantee exact timing. Prefer authoritative business changes over cosmetic pushes.

Proposed terminal policy for confirmed done/refunded/canceled: publish the terminal state as an update immediately, keep it on the island for 30 seconds, then send end with 180 seconds of further lock-screen retention. Plain failure is not treated as a confirmed final state until provider behavior is agreed. The native App uses the same policy best-effort while executable; the server owns dependable scheduling when suspended/terminated. Both paths must preserve the first terminal timestamp so replayed updates do not extend the window.

At terminalTimeSeconds+30, send `event:end`, final content-state and `dismissal-date=terminalTimeSeconds+210`. Add alert title/body/sound only for the agreed meaningful transition, avoid repeated alerts for replayed revisions. Treat refund initiation as update, not end. Coalesce same-second provider changes to latest truth and set an accurate increasing APNs timestamp; verify behavior for rapid changes and stale pushes. Server must end or expire tracking at eight hours even if the App never returns.

## Mock and acceptance handoff

Developer Settings → BTC Swap Live Activity runs deterministic success, refund, failed, canceled, Almost done and long ticker scenarios. Automatic steps are ten seconds apart while the App runtime can run; manual controls produce the same native start/update payloads. Mock does not request an APNs token, write swap history, call a production provider or simulate production registration acknowledgement. A native system card is genuine; its data source is synthetic. Only mock detail resolution requires a development build. A real-card deep link would resolve a local order after unlock; exact matching depends on the unverified order-key uniqueness contract, and real-card creation is currently disabled. Compact/Minimal tap opens the App, and long press expands the card; the user explicitly accepted this system behavior instead of Figma tap-to-toggle.

Before production: notification owner implements/approves endpoint and JPush wire mapping, verifies token binding and rotation on a signed physical build, tests App suspended/terminated, refunds and replacement deposits, validates ownership/anonymous-installation scope, invalid-token cleanup, eight-hour deadline, explicit unsubscription and terminal retention. Confirm on-device minute rounding and the OS-governed Compact gesture/animation constraints. Native simulator success is not APNs delivery or release certification.

Apple references: [ActivityKit push schema](https://developer.apple.com/documentation/ActivityKit/starting-and-updating-live-activities-with-activitykit-push-notifications), [Widget interaction](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities), [Dynamic Island URL behavior](https://developer.apple.com/documentation/widgetkit/dynamicisland).

`etaMinutes` is a preformatted snapshot. The native minute-boundary task runs only while iOS grants the App execution time. After suspension or termination, changing the minute label requires server presentation updates. `stale-date` marks that the last trusted snapshot may be outdated; it does not advance the minute countdown or prove the transaction is almost complete. Expanded is adapted to the OS maximum height of 160pt; the 182pt Figma frame cannot be enforced as an ActivityKit expanded island height.

## Integration decisions that remain external

The DTO and App transport are implementable proposals; these server deployment decisions are not claimed as verified existing capabilities:

- Authentication and installation ownership: notification owner must approve installation authorization and server ownership lookup; the existing resettable x-onekey-instance-id header is identification metadata, not authentication. The activityId alone is not proof of ownership; do not use OneKey ID login as an assumed requirement because anonymous wallets are supported. The App adapter must reuse the approved request client rather than adding an invented auth credential.
- APNs environment: bind each subscription to the signed build environment (sandbox for development, production for distribution) and the JPush application/environment that acknowledged this activity token. Never infer the environment from orderKey or trust a client-supplied arbitrary topic. Exact JPush wire API/configuration remains an owner integration check.
- Provider fallback: tracking.protocol, currentDepositTxId, order networkId/provider, destination contract/receiver and opaque ctx match the existing state-tx inputs. The server must confirm it can resolve that context when serviceOrderId is absent; otherwise return 422 and the App keeps foreground-only tracking.
- Continuous arrows/ring animations remain constrained by WidgetKit rendering/update budgets; the current card has state-change transitions and a static indeterminate arc. This does not prove continuous Figma motion parity.

Figma source: live local MCP export on 2026-10-22, formal node 26563:99086. Bundled artwork and ring paths come from those exported SVGs; Compact ETA is 13pt Heavy / 11pt Regular, 22pt status ring, and Minimal is a 30pt orange ring around the 18pt source token. Expanded uses a 160pt system adaptation; continuous indeterminate animation is not yet proven.

## Server contract follow-up (source checked 2026-11-03)

The app cannot determine from coarse `FAILED` alone whether a provider can later
report a refund. Before changing failed-activity lifetime or polling, the Swap
owner should confirm each supported provider's status transitions and the
production version. At server-service-swap commit
`c00b5e31199cbe9c2bf9e41b1154d565257312b6`, LI.FI can report
`FAILED` together with `REFUNDING`, while SWFT reports pending with
`REFUNDING`. HIFI preserves refund-wait details without mapping those states to
`REFUNDING`. The source does not establish whether a provider can first report
plain failure and only later initiate a refund. Thor/NEAR map both partial and
full refund outcomes to `REFUNDED`; that status alone does not prove a full
refund. The `/state-tx` path queries the provider again; the `order-detail`
path can return a stored terminal state. Production deployment and provider
behavior need separate confirmation.

The notification owner should implement and test a dedicated JPush Live Activity
sender. The existing JPush channel at server-service-notification commit
`2e911a7b5774be46ebf15ea2cfe1909adb0fbd7e` sends ordinary notification payloads
using registration IDs, not the Live Activity `live_activity_id` audience and
payload. Confirm P8 token authentication, app and extension signing profiles,
APNs sandbox/production routing, activity token registration and rotation,
subscription authorization, tracking TTL, retry, invalid-token cleanup, and
update/end delivery with a signed physical device. Neither the client-side SDK
binding nor source inspection proves that the service is deployed or that an
APNs update was delivered.

## Ownership and rollout boundary

The current production transport is a placeholder, not an authorization or
subscription implementation. Real order creation is disabled until remote
tracking, authorization and the writer handoff are implemented and verified;
the developer mock remains available. App-local ActivityKit updates are best effort and
can become stale when iOS suspends the app. Do not advertise the App-only path
as reliable background tracking. Mock cards demonstrate presentation only.

For the proposed remote phase, agree on a single authoritative writer and an
explicit handoff before enabling token registration. Local app history polling
may continue for the in-app screen, but it must not race remote ActivityKit
updates. A client-side `revision` does not by itself order APNs updates, which
bypass the local merge. Confirm timestamp semantics, token rotation and the
actual JPush-to-APNs wire payload before claiming an ordering guarantee.

The Swap service currently has order records and provider state queries; its
existing hourly Houdini scan is not a general BTC activity tracker. Confirm
that each target provider can be queried from recoverable server-side order
context. Add bounded, deduplicated tracking, RBF identity reconciliation,
provider-specific refund and terminal rules, expiry, retry and monitoring. Use
a verified provider event where available, with reconciliation for missed or
duplicate events. One activity per device can subscribe to the same tracked
order without creating one provider polling loop per activity.

An installation identifier, order identifier, activity identifier and JPush
registration ID are identifiers, not proof of authorization. The server owners
must design and validate anonymous-wallet order authorization and revocation.
Limit persisted and transmitted data to the fields proven necessary; avoid
logging addresses, provider context and push tokens.

The notification owner should verify JPush ActivityKit support, Apple P8
credentials, signed entitlements and development/production environment
routing; bind and rotate per-activity tokens; send update/end payloads and
handle invalid tokens and delivery failures. JPush acceptance, APNs acceptance
and a device showing the update are separate observations. A signed physical
iPhone and test server are required for end-to-end acceptance.

ActivityKit cards created with `pushType: nil` cannot be assumed to gain a
push token later. Before enabling the remote feature, define how to handle
existing local-only cards and migration while respecting user dismissal.

The optional `content-state.strings` object carries display strings formatted in
the App-selected language. If supplied, all fields in `ILiveActivityStrings`
are required; omit the whole object for legacy decoding, never send a partial
object. A future server sender must agree how to receive and update the current
App language, include any required strings within the ActivityKit payload limit,
and verify ordering across a locale change. The App's current local refresh is
not an implementation of server-side localization.

Legacy version-1 activities do not contain a reliable wallet ID. The App marks
all such existing activities as `ownershipStatus: needsConfirmation` when
reading system status; this classification is reconstructed after restart from
the version-1 schema, so an unknown card is not guessed to belong to a deleted
wallet. It is an internal status, not a user-facing confirmation workflow.
Precise ownership, selective end on deletion and interrupted-deletion recovery
still require a durable ownership model across all wallet and account deletion
paths before enabling real orders.

Before opening the real-order gate, verify the uniqueness and scope of service
order IDs and quote-ID fallbacks across providers, accounts and repeated orders.
The current key must not be assumed globally unique. A new local identifier
must be created or reused inside the same durable history mutation, before
presenting a card; simply generating a UUID at every broadcast callback can
split duplicate callbacks from the persisted order and break deep links.

## iOS release packaging when the x workflow is retained

The iOS release workflow is intentionally unchanged from x. It does not
explicitly prepare the LiveActivity extension provisioning profile or inject
the extension's EAS local credentials mapping. The extension is still embedded,
and its Info.plist version is not synchronized by that workflow. The release
owner must verify the actual credentials and profile, App Group, signing, and
matching App/extension versions in signed internal and App Store builds before
release. Secret names alone and simulator builds do not establish readiness.
