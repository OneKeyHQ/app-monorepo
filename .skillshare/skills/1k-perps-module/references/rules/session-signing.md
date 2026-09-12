# Trading Enablement, Sessions and Signing

Use when enable-trading, lock/unlock, agent credentials or signing behavior changes. A label/style edit in a trading guard does not by itself require a credential audit.

## Locate the affected layer

| Layer | Starting owners |
| --- | --- |
| UI guard and deposit fallback | `packages/kit/src/views/Perp/components/TradingGuardWrapper.tsx`; `packages/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback.ts` (`useEnsureTradingEnabled`); `packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.ts` |
| Account readiness and status | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`; `packages/kit-bg/src/states/jotai/atoms/perps.ts` |
| Credential info, replacement and cleanup | `packages/kit-bg/src/services/ServiceAccount/ServiceAccount.ts` |
| Screen-lock event and focused-page refresh | `packages/kit/src/views/Perp/components/PerpsGlobalEffects.tsx` (`useHyperliquidScreenLockHandler`) |
| Password/lock session | `packages/kit-bg/src/services/ServicePassword/index.ts` |
| Signing client | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidWallet.ts`; `packages/kit-bg/src/services/ServiceHyperLiquid/hyperLiquidApiClients.ts` |
| Persisted secret and session access | `packages/kit-bg/src/dbs/local/LocalDbBase.ts`; `packages/kit-bg/src/dbs/local/hyperLiquidAgentSecret.ts` |

Trace the current guard's call path; status also includes approval/account requirements beyond the agent credential. A changed enable-trading button is not enough to conclude that a key was lost.

## Status reads and signing have different outcomes

`ServiceAccount.getHyperLiquidAgentCredentialInfo` returns public metadata, but its internal `localDb.getHyperLiquidAgentCredential` read can decrypt a stored secret. It catches a read failure and returns `undefined` for status consumers. Do not describe it as a guaranteed non-decrypting read or infer that status metadata proves signing is ready.

The actual `WalletHyperliquidProxy` signing path independently retrieves the credential. Missing credentials or a key whose address differs from the proxy's expected agent address reject signing. Do not copy the status-read fallback into signing or bypass account binding to suppress an enablement prompt.

Raw key material and the signing wallet are scoped to the signing call; the long-lived proxy retains identity rather than a decrypted key. Follow credential replacement/reapproval and account or wallet removal cleanup when that lifecycle is changed.

## Investigate the relevant transition

- For enable-trading/deposit fallback, trace the actual guard result and deferred action. Revalidate the account/intent after asynchronous enablement; do not execute a stale action for another account.
- For lock/unlock, trace `ServicePassword`'s lock cleanup and session readiness/recovery, then the next account-status read and signing attempt separately. Restoring a UI flag is not proof that credential access is ready.
- For storage or session changes, state the target platform and resource ownership using [the runtime map](code-map.md). Desktop/web app main/background share one JS runtime; native/extension main/background do not. Native storage/session ownership still needs its own implementation evidence.
- For persistence changes, use the existing local DB/security workflow. Do not introduce another credential store or retain decrypted material merely to avoid a status retry.

Use error category, account scope and transition timing for diagnostics. Keep credentials, passwords, signatures and sensitive payloads out of logs. This guide adds no approval step to ordinary implementation or mocked validation.

## Select validation

Candidates include `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidWallet.test.ts`, `packages/kit-bg/src/services/ServiceAccount/ServiceAccount.hyperLiquidAgentCredential.test.ts`, tests beside `LocalDbBase`/`hyperLiquidAgentSecret`, `packages/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback.test.ts`, and `packages/kit/src/views/Perp/utils/perpsOrderPanelEnableTrading.test.ts`.

For the changed behavior, distinguish status-read failure, unavailable session, missing/rotated credentials, address mismatch, and successful recovery. Use test credentials and mock signing; live orders are not required to prove these boundaries. Add a lock/unlock or account-switch runtime check when the fix depends on that ordering.
