# OK-52357: Perps Abstraction Modes Implementation Plan (v3.1 - Full Release)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support all 4 Hyperliquid account abstraction modes, correctly calculate account value per mode, replace deprecated `agentEnableDexAbstraction` with `agentSetAbstraction`.

**Architecture:** Dual-source mode detection (HTTP `userAbstraction` on init + WS `WebData3.userState.abstraction` for real-time). Computed atom derives account value from mode + spot balances + clearinghouse data — zero writes to existing atoms, zero race conditions. New `spotState` WS subscription for spot balance data.

**Tech Stack:** TypeScript, @nktkas/hyperliquid SDK 0.32.2, Jotai atoms (globalAtom + globalAtomComputedR), BigNumber.js

**Data Model (verified from live API):**
- HTTP `allMids` API = flat dict: `{ "BTC": "66294", "@1": "12.134" }` — but WS event wraps it as `{ mids: {...}, dex?: string }`
- `hyperLiquidCache.allMids` = WS event shape (`IWsAllMids`), access prices via `.mids["@{tokenIndex}"]`
- `spotClearinghouseState.balances[]` = `{ coin: "JEFF", token: 5, total: "4668.5" }` — coin=name, token=index
- Spot price lookup: `cache.allMids.mids["@" + balance.token]` (USDC token=0 not in mids, 1:1 USD)
- `userAbstraction` returns: `"default"` | `"disabled"` | `"unifiedAccount"` | `"portfolioMargin"` | `"dexAbstraction"`

**Review History:**
- v1: Initial plan
- v2: 3-agent roundtable — computed atom, HTTP fallback, SimpleDb dual-write, account change cleanup
- v3: Codex cross-review — 7 bugs fixed
- v3.1: Codex 2nd review — 3 bugs fixed
- v3.2: Codex 3rd review — 3 final fixes (see below)

**v3 Fixes (from Codex 1st review):**
1. Computed atom now adds spot balance for disabled/dexAbstraction mode (was missing)
2. `fetchUserAbstraction` catch returns `undefined` not `"default"` (prevents accidental mode override)
3. All atom writes check active-account alignment (prevents stale request overwriting)
4. Dual-write only sets `dexAbstractionEnabledUsers=true` for `"dexAbstraction"` mode (was semantically wrong)
5. `setAbstraction` has in-flight dedup lock (prevents repeated WS-triggered calls)
6. Task 0 includes `spotState.ignorePortfolioMargin` parameter verification
7. Frontend consumer list is complete (10 files, not 3)

**v3.1 Fixes (from Codex 2nd review):**
8. allMids cache is `{ mids: Record<string, string> }` (WS event shape), NOT flat dict — access via `.mids[key]`
9. `fetchUserAbstraction` catch/cache fallback branch now also checks account alignment
10. Auto-set unified lock widened to cover entire detect→set→confirm chain (not just `setAbstraction` call)

**v3.2 Fixes (from Codex 3rd review):**
11. `fetchUserAbstraction` catch branch: added post-async alignment check AFTER `getUserAbstractionMode()` await
12. Removed contradictory "flat dict" references in notes and Task 9 — all now consistently say `.mids[key]`
13. Lock comment softened: prevents duplicate `setAbstraction` calls, but one redundant HTTP check possible (acceptable)
14. `spotTotalUsd` explicitly excludes `evmEscrows[]` (locked assets, not available balance)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/types/hyperliquid/types.ts` | Modify | Add `SPOT_STATE` enum, `EHyperLiquidAbstractionMode` enum |
| `packages/shared/types/hyperliquid/sdk.ts` | Modify | Add spot WS types, userAbstraction response type, subscription params |
| `packages/kit-bg/src/states/jotai/atomNames.ts` | Modify | Add new atom names |
| `packages/kit-bg/src/states/jotai/atoms/perps.ts` | Modify | Add abstraction mode atom, spot balances atom, computed account value atom |
| `packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityPerp.ts` | Modify | Add `abstractionModeUsers` + runtime migration + dual-write |
| `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts` | Modify | Replace `enableDexAbstraction()` with `setAbstraction()`, add in-flight lock |
| `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts` | Modify | Add `fetchUserAbstraction()`, `updateSpotBalances()`, modify account change cleanup |
| `packages/kit-bg/src/services/ServiceHyperLiquid/utils/SubscriptionConfig.ts` | Modify | Add SPOT_STATE subscription |
| `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts` | Modify | Rewrite WEB_DATA3 handler, add SPOT_STATE handler, remove skip logic |

---

### Task 0: Testnet Verification (Day 0)

**Before writing any code**, verify on Hyperliquid testnet:

- [ ] **Step 1: Verify clearinghouseState per mode**
  - `disabled`: clearinghouseState.marginSummary.accountValue = perps only? (expect yes)
  - `unifiedAccount`: clearinghouseState "not meaningful"? (expect yes, per HL docs)
  - `portfolioMargin`: same as unified? (expect yes)

- [ ] **Step 2: Verify `spotState` `ignorePortfolioMargin` parameter**
  - Subscribe to `spotState` with `ignorePortfolioMargin: true` vs `false` (or omit)
  - Check if the returned balances differ for portfolioMargin accounts
  - **Decision**: should we pass this param? Document which value to use.

- [ ] **Step 3: Verify `allMids` covers spot tokens**
  - Confirmed from live API: `allMids` includes `@{N}` keys for 306 spot tokens
  - Verify on testnet: `allMids["@5"]` matches the spot price for token index 5

- [ ] **Step 4: Document results and confirm formulas**

Expected formulas (per Kahn's spec):
```
disabled / dexAbstraction:
  accountValue = spotTotalUsd + clearinghouseState.marginSummary.accountValue

unifiedAccount / portfolioMargin:
  accountValue = spotTotalUsd (clearinghouseState not meaningful)

spotTotalUsd = USDC.total + Σ(other.total × allMids["@" + other.token])
```

---

### Task 1: Types & SDK Adapter Layer

**Files:**
- Modify: `packages/shared/types/hyperliquid/types.ts`
- Modify: `packages/shared/types/hyperliquid/sdk.ts`

- [ ] **Step 1: Add SPOT_STATE to ESubscriptionType and add abstraction mode enum**

In `types.ts`, add to `ESubscriptionType` enum:
```typescript
SPOT_STATE = 'spotState',
```

Add new enum:
```typescript
export enum EHyperLiquidAbstractionMode {
  DISABLED = 'disabled',
  UNIFIED_ACCOUNT = 'unifiedAccount',
  PORTFOLIO_MARGIN = 'portfolioMargin',
  DEX_ABSTRACTION = 'dexAbstraction',
  DEFAULT = 'default',
}
```

- [ ] **Step 2: Add SDK types in sdk.ts**

```typescript
// Spot state types
export type IWsSpotState = HL.SpotStateWsEvent;
export type ISpotBalance = IWsSpotState['spotState']['balances'][number];
export type IEventSpotStateParameters = HL.SpotStateWsParameters;

// Abstraction query types
export type IUserAbstractionResponse = HL.UserAbstractionResponse;
```

Add to `IPerpsSubscriptionParams`:
```typescript
[ESubscriptionType.SPOT_STATE]: IEventSpotStateParameters;
```

- [ ] **Step 3: Commit**
```
feat(perps): add abstraction mode enum and spot state types
```

---

### Task 2: Atom Definitions (including computed account value)

**Files:**
- Modify: `packages/kit-bg/src/states/jotai/atomNames.ts`
- Modify: `packages/kit-bg/src/states/jotai/atoms/perps.ts`

- [ ] **Step 1: Add atom names**

```typescript
perpsAbstractionModeAtom = 'perpsAbstractionModeAtom',
perpsSpotBalancesAtom = 'perpsSpotBalancesAtom',
```

- [ ] **Step 2: Add abstraction mode and spot balance atoms**

```typescript
// #region Abstraction Mode
export const {
  target: perpsAbstractionModeAtom,
  use: usePerpsAbstractionModeAtom,
} = globalAtom<{
  accountAddress: IHex | undefined;
  mode: EHyperLiquidAbstractionMode | undefined;
} | undefined>({
  name: EAtomNames.perpsAbstractionModeAtom,
  initialValue: undefined,
});
// #endregion

// #region Spot Balances
export interface ISpotBalanceItem {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}
export const {
  target: perpsSpotBalancesAtom,
  use: usePerpsSpotBalancesAtom,
} = globalAtom<{
  accountAddress: IHex | undefined;
  balances: ISpotBalanceItem[];
  spotTotalUsd: string | undefined;
} | undefined>({
  name: EAtomNames.perpsSpotBalancesAtom,
  initialValue: undefined,
});
// #endregion
```

- [ ] **Step 3: Add computed account value atom**

Core architectural improvement — derives account value from mode + spot + clearinghouse. **No writes to `perpsActiveAccountSummaryAtom`**.

```typescript
export const {
  target: perpsComputedAccountValueAtom,
  use: usePerpsComputedAccountValueAtom,
} = globalAtomComputedR<{
  accountValue: string | undefined;
  isLoading: boolean;
}>({
  read: (get) => {
    const modeData = get(perpsAbstractionModeAtom.atom());
    const summary = get(perpsActiveAccountSummaryAtom.atom());
    const spotData = get(perpsSpotBalancesAtom.atom());

    const mode = modeData?.mode;

    // Mode unknown → use existing clearinghouse value as fallback, mark loading
    if (!mode) {
      return { accountValue: summary?.accountValue, isLoading: true };
    }

    const isUnified =
      mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
      mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;

    if (isUnified) {
      // Unified/portfolio: account value = spot balance only
      if (!spotData?.spotTotalUsd) {
        return { accountValue: undefined, isLoading: true };
      }
      return { accountValue: spotData.spotTotalUsd, isLoading: false };
    }

    // disabled / dexAbstraction: account value = spot + perps clearinghouse
    const perpsValue = new BigNumber(summary?.accountValue || '0');
    const spotValue = new BigNumber(spotData?.spotTotalUsd || '0');
    return {
      accountValue: spotValue.plus(perpsValue).toFixed(),
      isLoading: !spotData?.spotTotalUsd,
    };
  },
});
```

Import `BigNumber` and `EHyperLiquidAbstractionMode` at the top of the file.

- [ ] **Step 4: Commit**
```
feat(perps): add computed account value atom with mode-aware derivation
```

---

### Task 3: SimpleDb - Abstraction Mode Storage with Migration

**Files:**
- Modify: `packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityPerp.ts`

- [ ] **Step 1: Add field to ISimpleDbPerpData**

```typescript
abstractionModeUsers?: Record<string, string>; // user address -> EHyperLiquidAbstractionMode
```

Keep `dexAbstractionEnabledUsers` — do NOT remove.

- [ ] **Step 2: Add getter with runtime migration fallback**

```typescript
@backgroundMethod()
async getUserAbstractionMode(userAddress: string): Promise<string | undefined> {
  const config = await this.getPerpData();
  const addr = userAddress.toLowerCase();
  // New field takes priority
  const mode = config.abstractionModeUsers?.[addr];
  if (mode) return mode;
  // Runtime migration: legacy boolean → dexAbstraction mode
  if (config.dexAbstractionEnabledUsers?.[addr] === true) {
    return 'dexAbstraction';
  }
  return undefined;
}
```

- [ ] **Step 3: Add setter with dual-write (corrected semantics)**

Only set `dexAbstractionEnabledUsers=true` for actual `dexAbstraction` mode. Other modes (unified, portfolio) should NOT be written as dex-abstraction-enabled.

```typescript
@backgroundMethod()
async setUserAbstractionMode(userAddress: string, mode: string) {
  await this.setPerpData(
    (prev): ISimpleDbPerpData => ({
      ...prev,
      abstractionModeUsers: {
        ...prev?.abstractionModeUsers,
        [userAddress.toLowerCase()]: mode,
      },
      // Dual-write: only dexAbstraction maps to legacy true
      dexAbstractionEnabledUsers: {
        ...prev?.dexAbstractionEnabledUsers,
        [userAddress.toLowerCase()]: mode === 'dexAbstraction',
      },
    }),
  );
}
```

- [ ] **Step 4: Commit**
```
feat(perps): add abstraction mode storage with runtime migration and dual-write
```

---

### Task 4: Exchange Service - Replace enableDexAbstraction

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts`

- [ ] **Step 1: Add setAbstraction method**

```typescript
@backgroundMethod()
async setAbstraction(
  mode: 'i' | 'u' | 'p',
): Promise<{ status: 'ok' } | undefined> {
  await this.checkAccountCanTrade();
  const response = await convertHyperLiquidResponse(() =>
    this.exchangeClient.agentSetAbstraction({ abstraction: mode }),
  );
  return response;
}

/** @deprecated Use setAbstraction() instead */
@backgroundMethod()
async enableDexAbstraction(): Promise<{ status: 'ok' } | undefined> {
  return this.setAbstraction('u');
}
```

- [ ] **Step 2: Commit**
```
feat(perps): replace agentEnableDexAbstraction with agentSetAbstraction
```

---

### Task 5: Subscription Config - Add SPOT_STATE

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceHyperLiquid/utils/SubscriptionConfig.ts`

- [ ] **Step 1: Add to SUBSCRIPTION_TYPE_INFO**

```typescript
[ESubscriptionType.SPOT_STATE]: {
  eventType: EPerpsSubscriptionCategory.ACCOUNT,
  priority: 2,
},
```

- [ ] **Step 2: Add spotState subscription in user data section**

In `calculateRequiredSubscriptions`, inside `if (state.currentUser)`, after WEB_DATA3 push:

```typescript
specs.push(
  buildSubscriptionSpec({
    type: ESubscriptionType.SPOT_STATE,
    params: {
      user: state.currentUser,
    },
  }),
);
```

Note: `ignorePortfolioMargin` parameter intentionally omitted (defaults to undefined). Verify correct behavior in Task 0 Step 2.

- [ ] **Step 3: Commit**
```
feat(perps): add spotState WebSocket subscription
```

---

### Task 6: Service Layer - fetchUserAbstraction + updateSpotBalances

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`

- [ ] **Step 1: Add fetchUserAbstraction (HTTP, for initialization)**

Error case returns `undefined` (NOT `"default"`) to distinguish network failure from actual default mode:

```typescript
async fetchUserAbstraction(userAddress: IHex): Promise<string | undefined> {
  // Active-account alignment check
  const activeAccount = await perpsActiveAccountAtom.get();
  if (activeAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()) {
    return undefined;
  }

  const { infoClient } = hyperLiquidApiClients;
  try {
    const mode = await infoClient.userAbstraction({ user: userAddress });

    // Re-check alignment after async call
    const currentAccount = await perpsActiveAccountAtom.get();
    if (currentAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      return undefined;
    }

    await this.backgroundApi.simpleDb.perp.setUserAbstractionMode(userAddress, mode);
    await perpsAbstractionModeAtom.set({
      accountAddress: userAddress.toLowerCase() as IHex,
      mode: mode as EHyperLiquidAbstractionMode,
    });
    return mode;
  } catch {
    // Fallback to SimpleDb cached value — need alignment checks around every await
    const preDbAccount = await perpsActiveAccountAtom.get();
    if (preDbAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      return undefined;
    }
    const cached = await this.backgroundApi.simpleDb.perp.getUserAbstractionMode(userAddress);
    // Post-async alignment: user could have switched during SimpleDb read
    const postDbAccount = await perpsActiveAccountAtom.get();
    if (postDbAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      return undefined;
    }
    if (cached) {
      await perpsAbstractionModeAtom.set({
        accountAddress: userAddress.toLowerCase() as IHex,
        mode: cached as EHyperLiquidAbstractionMode,
      });
      return cached;
    }
    return undefined; // NOT "default" — unknown is unknown
  }
}
```

- [ ] **Step 2: Add updateSpotBalances with account alignment check**

Price lookup uses `@{token_index}` format for allMids, USDC (token=0) is 1:1:

```typescript
async updateSpotBalances(spotStateData: IWsSpotState) {
  const activeAccount = await perpsActiveAccountAtom.get();
  const activeAddress = activeAccount?.accountAddress?.toLowerCase();
  const dataUser = spotStateData?.user?.toLowerCase();

  // Active-account alignment: only process data for current account
  if (!activeAddress || activeAddress !== dataUser) return;

  const balances = spotStateData.spotState?.balances || [];

  // Calculate total USD value from spot balances
  // Price lookup: USDC (token=0) → 1:1, others → allMids.mids["@{token}"]
  // Note: hyperLiquidCache.allMids is IWsAllMids = { mids: Record<string, string> }
  let totalUsd = new BigNumber(0);
  const mids = hyperLiquidCache.allMids?.mids;
  for (const balance of balances) {
    const amount = new BigNumber(balance.total);
    if (amount.isZero()) continue;
    if (balance.token === 0) {
      // USDC — quote currency, not in allMids, 1:1 USD
      totalUsd = totalUsd.plus(amount);
    } else {
      const midKey = `@${balance.token}`;
      const midPrice = mids?.[midKey];
      if (midPrice) {
        totalUsd = totalUsd.plus(amount.multipliedBy(midPrice));
      }
    }
  }

  await perpsSpotBalancesAtom.set({
    accountAddress: activeAddress as IHex,
    balances: balances.map((b) => ({
      coin: b.coin, token: b.token,
      total: b.total, hold: b.hold, entryNtl: b.entryNtl,
    })),
    spotTotalUsd: totalUsd.toFixed(),
  });
}
```

Note: `hyperLiquidCache.allMids` is `IWsAllMids` = `{ mids: Record<string, string> }`. Access prices via `.mids[key]`.
Note: `spotTotalUsd` only includes `balances[]`, not `evmEscrows[]`. Escrow assets are locked and not part of available balance.

- [ ] **Step 3: Trigger fetchUserAbstraction on account init**

In `checkPerpsAccountStatus`, after the account is confirmed activated:

```typescript
// Fetch abstraction mode for the active account
void this.fetchUserAbstraction(accountAddress);
```

- [ ] **Step 4: Add cleanup to clearActiveAccountData flow**

In `changeActivePerpsAccount`, alongside existing atom clears:

```typescript
await perpsAbstractionModeAtom.set(undefined);
await perpsSpotBalancesAtom.set(undefined);
```

- [ ] **Step 5: Commit**
```
feat(perps): add fetchUserAbstraction, updateSpotBalances, account cleanup
```

---

### Task 7: Subscription Handler - Rewrite WEB_DATA3 + Add SPOT_STATE

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts`

- [ ] **Step 1: Rewrite WEB_DATA3 handler**

Replace lines ~1019-1051. Key changes:
- Read `userState.abstraction` (new optional field in SDK 0.32.2)
- Account alignment check before writing atoms
- Auto-set unified only when HTTP confirms `"default"` (not on WS undefined)
- In-flight lock via exchange service prevents duplicate calls

```typescript
if (subscriptionType === ESubscriptionType.WEB_DATA3) {
  const webData3 = data as IWsWebData3;
  const { userState } = webData3;
  const userAddress = userState?.user;

  if (userAddress) {
    // Read abstraction mode from WS (real-time update)
    const wsAbstraction = (userState as any)?.abstraction as string | undefined;

    // Account alignment check
    const activeAccount = await perpsActiveAccountAtom.get();
    if (activeAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()) {
      return;
    }

    if (wsAbstraction) {
      // WS provided a definite mode — update directly
      await this.backgroundApi.simpleDb.perp.setUserAbstractionMode(
        userAddress, wsAbstraction,
      );
      await perpsAbstractionModeAtom.set({
        accountAddress: userAddress.toLowerCase() as IHex,
        mode: wsAbstraction as EHyperLiquidAbstractionMode,
      });
    } else if (!this._abstractionSetupInFlight) {
      // WS abstraction is undefined — use HTTP to get ground truth
      // Lock covers entire detect→set→confirm chain to prevent serial retries
      this._abstractionSetupInFlight = true;
      void (async () => {
        try {
          const httpMode = await this.backgroundApi.serviceHyperliquid
            .fetchUserAbstraction(userAddress);
          // Only auto-set unified if HTTP confirms "default" (NOT on undefined/error)
          if (httpMode === 'default') {
            const accountStatus = await perpsActiveAccountStatusAtom.get();
            if (accountStatus?.canTrade) {
              await this.backgroundApi.serviceHyperliquidExchange.setAbstraction('u');
              // Re-fetch to confirm new mode
              await this.backgroundApi.serviceHyperliquid
                .fetchUserAbstraction(userAddress);
            }
          }
        } catch {
          // Silently retry on next WEB_DATA3 update
        } finally {
          this._abstractionSetupInFlight = false;
        }
      })();
    }
  }
  return;
}
```

- [ ] **Step 2: Add SPOT_STATE handler**

Before the ACTIVE_ASSET_CTX handler:

```typescript
if (subscriptionType === ESubscriptionType.SPOT_STATE) {
  void this.backgroundApi.serviceHyperliquid.updateSpotBalances(
    data as IWsSpotState,
  );
  this._emitHyperliquidDataUpdate(subscriptionType, data);
  return;
}
```

Import `IWsSpotState` from `@onekeyhq/shared/types/hyperliquid/sdk`.

Note: Add `private _abstractionSetupInFlight = false;` property to the subscription service class. This lock prevents concurrent execution of the detect→set→confirm chain. After the chain completes, a stale WEB_DATA3 could trigger one extra HTTP check, but since `setAbstraction` already succeeded, HTTP will return `"unifiedAccount"` (not `"default"`), so no duplicate mode change occurs — only one redundant HTTP call at worst.

- [ ] **Step 3: Remove WEB_DATA3 skip logic**

In `buildRequiredSubscriptionsMap` (lines ~187-200), delete the block:

```typescript
// DELETE entire block:
// Skip WEB_DATA3 subscription if user already has DEX abstraction enabled
if (activeAccount?.accountAddress) {
  const isDexAbstractionEnabled = ...
  if (isDexAbstractionEnabled) {
    Object.keys(requiredSubSpecsMap).forEach((key) => {
      if (requiredSubSpecsMap[key]?.type === ESubscriptionType.WEB_DATA3) {
        delete requiredSubSpecsMap[key];
      }
    });
  }
}
```

WEB_DATA3 stays subscribed to monitor mode changes.

- [ ] **Step 4: Commit**
```
feat(perps): rewrite WEB_DATA3 for abstraction modes, add spotState handler
```

---

### Task 8: Frontend - Wire Up Computed Account Value

**Files (complete list — 10 files):**
- `packages/kit/src/views/Perp/components/TradingPanel/components/PerpsHeaderRight.tsx`
- `packages/kit/src/views/Perp/components/TradingPanel/components/PerpsAccountNumberValue.tsx`
- `packages/kit/src/views/Perp/components/TradingPanel/panels/PerpAccountPanel.tsx`
- `packages/kit/src/views/Perp/components/TradingPanel/PerpTradingPanel.tsx`
- `packages/kit/src/views/Perp/components/TradingPanel/modals/DepositWithdrawModal.tsx`
- `packages/kit/src/views/Perp/components/Portfolio/usePerpPortfolioData.ts`
- `packages/kit/src/views/Perp/components/Portfolio/PerpPortfolioContent.tsx`
- `packages/kit/src/views/Perp/components/TickerBar/PerpTickerBarMobile.tsx`
- `packages/kit/src/views/Perp/components/OrderInfoPanel/AdjustPositionMarginModal.tsx`
- `packages/kit/src/views/Perp/hooks/useLiquidationPrice.ts`

- [ ] **Step 1: Identify which reads need replacement**

Not all `usePerpsActiveAccountSummaryAtom` reads need to change. Only those accessing `.accountValue` should use the computed atom. Other fields (margins, PnL, withdrawable) still come from the existing atom.

```bash
grep -rn "accountSummary.*accountValue\|\.accountValue" packages/kit/src/views/Perp/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Add computed atom import and replace accountValue reads**

Pattern: keep `usePerpsActiveAccountSummaryAtom` for other fields, add `usePerpsComputedAccountValueAtom` for accountValue:

```typescript
// Before:
const [accountSummary] = usePerpsActiveAccountSummaryAtom();
const accountValue = accountSummary?.accountValue;

// After:
const [accountSummary] = usePerpsActiveAccountSummaryAtom();
const [{ accountValue }] = usePerpsComputedAccountValueAtom();
```

Apply to each of the 10 files, only where `.accountValue` is accessed.

- [ ] **Step 3: Update test mock**

In `packages/kit/src/views/Perp/hooks/useLiquidationPrice.test.ts`, add mock for the new atom:

```typescript
usePerpsComputedAccountValueAtom: () => [{ accountValue: '10000', isLoading: false }],
```

- [ ] **Step 4: Commit**
```
feat(perps): use computed account value atom in all UI consumers
```

---

### Task 9: Verification & Cleanup

- [ ] **Step 1: TypeScript compilation**
```bash
npx tsc --noEmit -p packages/kit-bg/tsconfig.json 2>&1 | grep -i "hyperliquid\|perps\|abstraction\|spot"
npx tsc --noEmit -p packages/kit/tsconfig.json 2>&1 | grep -i "hyperliquid\|perps\|abstraction\|spot"
```

- [ ] **Step 2: Lint**
```bash
yarn lint:staged
```

- [ ] **Step 3: Verify no circular imports**
- `ServiceHyperliquid` accesses `ServiceHyperliquidSubscription` only via `backgroundApi`
- Atoms only import from `shared`
- `ServiceHyperliquidExchange` does not import from `ServiceHyperliquid`

- [ ] **Step 4: Verify allMids cache format**

Confirm `hyperLiquidCache.allMids` is `IWsAllMids` = `{ mids: Record<string, string> }`. All price lookups in `updateSpotBalances` must go through `.mids[key]`. Read `hyperLiquidCache.ts` to verify.

- [ ] **Step 5: Final commit**
```
fix(perps): resolve type errors and lint for abstraction mode support
```

---

## Testing Checklist

| Scenario | Expected |
|----------|----------|
| New account (never traded) | HTTP returns `"default"` → auto-set to `unifiedAccount` |
| Existing dexAbstraction user | Mode read from SimpleDb migration → account value = spot + perps |
| Existing unifiedAccount user | Account value = spot balance only |
| portfolioMargin user | Account value = spot balance only (verify no double count!) |
| disabled user | Account value = spot + perps clearinghouse |
| Watch-only account | Mode readable via HTTP, NO `agentSetAbstraction` call |
| Account switch | Old atoms cleared, new mode + spot fetched for new account |
| `abstraction` undefined in WS | HTTP fallback triggered, correct mode resolved |
| HTTP request fails | Falls back to SimpleDb cache, does NOT return "default" |
| Rapid WS updates | `setAbstraction` in-flight lock prevents duplicate calls |
| Stale async response | Account alignment check prevents writing to wrong account |
| No repeated agentEnableDexAbstraction | Old loop removed, no rate limiting errors |
| Spot balance real-time update | Account value reflects changes within seconds |
| USDC-only account | USDC balance used directly (1:1), no allMids lookup |
| Non-USDC spot tokens | Price from `allMids["@{token}"]`, missing tokens skipped |
