# Perps Review Checklist

Use this for PR review, risk assessment, and pre-release checks.

## Intake

- Identify issue source: Jira/Slack/Figma/attachment/PR description/user report.
- Confirm platform: desktop, web, extension, iOS, Android, or all.
- Confirm surface: trade panel, orderbook, chart, positions/orders, deposit, session/account, token selector, or BG service.
- Confirm asset type and account/dex scope.

## Correctness

- Does the change modify the owner of truth rather than a display symptom?
- Are order contracts respected for market/limit/trigger/scale/TWAP?
- Are scale child legs individually valid?
- Is TWAP state/cancel/history handled through TWAP-specific paths?
- Are account/dex/asset switches clearing stale data safely?
- Are subscription create/destroy races handled?
- Are chart readiness and iframe readiness distinguished?
- Is Relay/deposit status scoped by the active tx/request (`fromTxId` now, `requestId` when available) instead of deposit address alone?

## Performance

- Does any websocket tick write a broad atom?
- Does any large component subscribe to high-frequency data it does not need?
- Are orderbook/token selector transforms memoized at the right level?
- Did debug logging enter a hot path?
- Did the change add cross-platform render cost unintentionally?

## Security and safety

- No secrets, signatures, private keys, mnemonics, or raw sensitive payloads in logs.
- No bypass of enable-trading, account bind, signing, or risk checks.
- No unsafe fallback to ambiguous Relay fields.
- No transaction/order payload mutation outside existing validation paths.

## Tests and runtime proof

- Targeted unit tests added/updated for changed pure logic.
- Existing relevant tests run.
- Runtime path verified for user-visible behavior.
- If runtime validation is impossible, note exact blocker and next-best evidence.

## Release risk gates

Escalate before approval if:

- Order submit/cancel payload changed without runtime/API proof.
- Subscription lifecycle changed without rapid-switch/reconnect validation.
- K-line recovery changed without native WebView consideration.
- Relay deposit status changed without requestId/stale quote cases.
- A volatile business/API assumption is encoded as permanent behavior.
