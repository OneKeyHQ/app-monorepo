# Prime free-trial attempts (OK-65046 / OK-65108)

## Contract

The five free-trial features are `BulkCopyAddresses`, `BulkSend`, `BulkRevoke`,
`AddressRiskCheck`, and `DAppTranslate` (the shared feature-ID list).

The client emits two distinct events through the existing decorated Prime logger:

| Event | Fields | Meaning |
| --- | --- | --- |
| `primeFreeTrialAttempt` | `featureId`, random `attemptId`, `stage`, `source: client` | An access attempt, actual execution, or retry of an already consumed usage |
| `primeFreeTrialResult` | Same correlation fields, `result`, optional `rejectionSource: client/server`, optional `previousResult` | The corresponding access or business outcome |

Stages are `access`, `execution`, and `retry`. Count attempts/results within a
stage and deduplicate by `attemptId`; do not sum stages as unique users or unique tool invocations. If a late broadcast upgrades an unsettled bulk failure to success, the correction explicitly includes `previousResult`. Use the latest result for that attempt, not two completions. Even if an earlier failed finish was already accepted for accounting, a real late broadcast corrects analytics only; the accepted bill and quota remain unchanged. The separate analytics outcome is persisted to deduplicate repeated broadcasts. A successful
access gate reports `granted`, never `success`. A stale Prime projection that
becomes unlimited reports `unlimited`. Login cancellation, login failure, changed
context, and extension hand-off remain distinguishable.

Client events deliberately have different names from the server's reservation,
usage, release, and `primeFreeTrialDenied` events. Existing `primeEntryClick`,
`primeFreeTrialLoginResult`, `primeFreeTrialQuotaExhausted`,
`primeFreeTrialUsageSuccess`, `addressRiskCheckSuccess`, and
`dappTranslateSuccess` retain their meanings. The Slack thread also describes
server-side `primeAddressRiskCheck` and `DappBrowserTranslate` events; their
backend schemas are outside this repository. Do not add these client events to
server consumption counts. No additional metering API is sent for analytics.

Only bounded feature/stage/result enums and random correlation IDs are added.
No address, account ID, page body, translation text, URL, key, or raw error is
included. Analytics failures cannot prevent business execution or settlement.

## Entry and completion coverage

| Feature | Access entry points | Execution attempt | Real result |
| --- | --- | --- | --- |
| Bulk copy addresses | Wallet actions / More menu, wallet edit, extension saved-action continuation | Both account and range generation paths via `usePrimeFreeTrialUsage.startUsage` | Durable result after nonempty addresses are generated, generation failure, or cancellation; opening the export page alone is not success |
| Bulk send | Home wallet action, More menu, Send form, address-input Next; page-mount login is not another user attempt | Review starts the existing usage before signing; result-page retries either start a new usage or reuse a consumed one | `ServiceSend` marks success at a real broadcast; no-broadcast failures/cancellation settle the usage |
| Bulk revoke | Approval management's bulk-revoke action | Start button before the revoke loop; result-page retry | Real broadcast, or no-broadcast failure/cancellation |
| Address risk check | More menu / history navigation (login only), then manual input, recent/history rows, Send address input | Deduplicated `executeAddressRiskCheck`, including cached server results | Actual request success, server rejection, or failure, before any local-history fallback; viewing history is not a successful new check |
| DApp translate | Desktop address bar and native toolbar, Translate / Retranslate | New translation session, including settings/sticky-navigation restarts | First completed request group: success only if a batch was actually billed; otherwise server rejection or failure. A session stopped before any request is cancelled |

A reused bulk retry carries a new analytics ID through the existing broadcast
metadata and route parameters. It does not reserve or charge another use. Its
first real broadcast wins over later failure/cancellation, and multiple
broadcasts produce one retry result. A retry with no broadcast reports its real
failure/cancellation even though the original usage already succeeded.

Translation tracks in-flight analytics separately from the active WebView. A
restore, navigation, or tab close does not claim that an already-sent request was
cancelled. A late billed response reports success for its original attempt ID;
late responses cannot restore, stop, or report UI success on a replacement page.
Concurrent responses are aggregated before the request group is settled. If a later request group delivers billed translations after an earlier failure,
the same attempt receives an explicit success correction. A
later quota pause in an already successful streaming session retains the
existing exhausted-feedback event; it is not a second completion event.

## Scenario matrix

| Scenario | Bulk copy | Bulk send | Bulk revoke | Risk check | Translation |
| --- | --- | --- | --- | --- | --- |
| Local quota available / unknown | Access granted; actual start decides | Same | Same | Actual check decides | Actual metered request decides |
| Local quota exhausted / not open | Access rejection; no extra start | Same | Same | Rejection for new manual/Send check; history remains viewable | Rejection; page stays in place |
| Server exhausted / not open | Execution result + existing feedback | Same | Same | Execution rejection, including before history fallback | Execution rejection, no whole-request quota retry |
| Success | Generated nonempty address data | Real broadcast | Real broadcast | Actual result, including cached result | Actual billed translation batch |
| Failure | Generation error / empty data | No broadcast | No broadcast | Rejected non-trial request | Retries exhausted / original-text fallback / unavailable AI |
| User cancellation / page close | Existing reservation settles cancelled | Existing signing/loop cleanup | Existing loop cleanup | Sent request keeps its actual outcome | Before request: cancelled; in flight: await actual result |
| Repeat click | Existing entry/button guards + one in-flight start | Same | Same | Same request is shared | Pending access presses are ignored; per-session result is emitted once |
| Retry | New start / new attempt | New usage after failure; new retry analytics ID when reusing consumed usage | Same | Failed promise removed; new request gets new ID | New session gets new ID; internal HTTP retries remain one attempt |

## Reproduction and verification

OK-65046 regression: open the translation popover as a logged-in non-Prime user,
enter settings, switch to Custom, open the language list, then let the quota
snapshot refresh/change the translation callback. The previous inline
`renderContent` function became a new component type, remounting the settings
and closing the list. Both native and desktop now pass a stable element and
obtain the close action from Popover context. The component regression fails
before the fix and passes after it.

Automated verification uses targeted Jest suites for access gating, usage hooks,
durable settlement, ServiceSend broadcast semantics, risk checks/history,
translation sessions, injected scripts, and shared quota decisions. Network,
wallet, native, navigation, and analytics transport boundaries are mocked. The
new event assertions check actual call sites and failure/cancellation/retry
paths, not only the logger schema.

Remaining manual QA: physical iOS/Android and isolated Desktop with logged-out,
non-Prime (available/exhausted), and Prime accounts; settings list remains open
through a real quota response, selection persists, closing/reopening resets the
settings view as before, and real analytics transport delivers the new schema.
No real transaction, payment, refund, entitlement deletion, deployment, or merge
is part of automated verification. The Jira attachment was not viewed.
