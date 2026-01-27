# Earn Module Integration Guide

This guide covers integrating new staking/yield protocols into the Earn module.

## Architecture Overview

```
EarnHome
├── EarnProvider (Jotai-based state)
├── EarnMainTabs
│   ├── Assets Tab → ProtocolsTabContent → AvailableAssetsTabViewList
│   ├── Portfolio Tab → PortfolioTabContent
│   └── FAQs Tab → FAQContent
├── ManagePosition Modal
│   ├── Stake (deposit tab)
│   ├── Unstake (withdraw tab)
│   └── Claim
├── EarnProtocols (protocol list page)
└── EarnProtocolDetails (detail page with charts)
```

---

## Key Files

### Home Page

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Earn/EarnHome.tsx` | Main entry point, handles earn/borrow mode switching |
| `packages/kit/src/views/Earn/EarnProvider.tsx` | Jotai context provider |
| `packages/kit/src/views/Earn/components/EarnMainTabs.tsx` | Tab container (Assets, Portfolio, FAQs) |
| `packages/kit/src/views/Earn/components/Overview.tsx` | Summary card (total value, 24h earnings) |
| `packages/kit/src/views/Earn/components/PortfolioTabContent.tsx` | User's positions display |
| `packages/kit/src/views/Earn/components/ProtocolsTabContent.tsx` | Available protocols list |

### Operation Modals

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Staking/pages/ManagePosition/index.tsx` | Modal wrapper |
| `packages/kit/src/views/Staking/pages/ManagePosition/components/ManagePositionContent.tsx` | Content router |
| `packages/kit/src/views/Staking/components/UniversalStake/index.tsx` | Stake operation |
| `packages/kit/src/views/Staking/components/UniversalWithdraw/index.tsx` | Unstake operation |
| `packages/kit/src/views/Staking/components/UniversalClaim/index.tsx` | Claim operation |

### Detail Pages

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Earn/pages/EarnProtocols/index.tsx` | Protocol list page |
| `packages/kit/src/views/Earn/pages/EarnProtocolDetails/index.tsx` | Protocol detail page |
| `packages/kit/src/views/Staking/pages/ProtocolDetailsV2/index.tsx` | Alternative detail page |

### Hooks

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Earn/hooks/useEarnPortfolio.ts` | Fetch user's portfolio |
| `packages/kit/src/views/Earn/hooks/useStakingPendingTxs.ts` | Track pending transactions |
| `packages/kit/src/views/Earn/hooks/usePortfolioAction.ts` | Handle portfolio actions |
| `packages/kit/src/views/Staking/hooks/useEarnAccount.ts` | Get earn account info |

### Router

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Staking/router/index.tsx` | Staking modal routes |
| `packages/shared/src/routes/staking.ts` | Route enums |

---

## Operation Types

### 1. Stake (Deposit)

**Component:** `UniversalStake`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  details: IStakingProtocolDetails;
  onSuccess?: () => void;
}
```

**Features:**
- Amount input with percentage selector (25%, 50%, 75%, 100%)
- Balance validation
- Min amount validation
- APY display
- Estimated rewards preview

**Validation Flow:**
1. Check wallet balance
2. Check min stake amount
3. Check protocol-specific requirements
4. Estimate gas fee

### 2. Unstake (Withdraw)

**Component:** `UniversalWithdraw`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  details: IStakingProtocolDetails;
  onSuccess?: () => void;
}
```

**Features:**
- Amount input
- Withdrawal options (if multiple)
- Lock period display
- Pending withdrawal tracking

**Special Cases:**
- Some protocols have lock periods
- Some protocols have multiple withdrawal options (instant vs delayed)
- Some protocols require claiming after unstake

### 3. Claim

**Component:** `UniversalClaim`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  symbol: string;
  provider: string;
  details: IStakingProtocolDetails;
  onSuccess?: () => void;
}
```

**Features:**
- Claimable rewards display
- Multiple reward types support
- Claim all or individual

---

## State Management

### Jotai Atoms

Location: `packages/kit/src/states/jotai/contexts/earn/`

**Key Atoms:**
```typescript
// Earn account data
earnAtom: {
  [accountKey: string]: {
    accounts: IEarnAccount[];
    totalFiatValue: string;
    earnings24h: string;
    isOverviewLoaded: boolean;
  }
}

// Portfolio investments cache
earnPortfolioInvestmentsAtom: {
  [accountKey: string]: IEarnPortfolioInvestment[]
}
```

### Data Flow

```
Backend API
    ↓
backgroundApiProxy.serviceStaking
    ↓
useEarnPortfolio / usePromiseResult
    ↓
Jotai atoms (earnAtom, earnPortfolioInvestmentsAtom)
    ↓
UI Components
```

### useEarnPortfolio Hook

This is the main hook for fetching portfolio data.

**Returns:**
```typescript
{
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}
```

**Features:**
- Progressive loading with throttled UI updates
- Caching with `earnPortfolioInvestmentsAtom`
- Partial refresh support (by provider, networkId, symbol)
- Account change detection and cache clearing

---

## useEarnPortfolio Hook Architecture

### Overview

`useEarnPortfolio` is the core data fetching hook for the Earn module, implementing:
- Progressive Loading
- Request Staleness Prevention
- Account Change Detection
- Global State Sync

### File Location

`packages/kit/src/views/Earn/hooks/useEarnPortfolio.ts`

### Return Type

```typescript
export interface IUseEarnPortfolioReturn {
  investments: IEarnPortfolioInvestment[];
  earnTotalFiatValue: BigNumber;
  earnTotalEarnings24hFiatValue: BigNumber;
  isLoading: boolean;
  refresh: (options?: IRefreshOptions) => Promise<void>;
}

export interface IRefreshOptions {
  provider?: string;
  networkId?: string;
  symbol?: string;
  rewardSymbol?: string;
}
```

### Internal Hooks

#### useInvestmentState

Manages local state for investment data:

```typescript
interface IInvestmentStateOptions {
  initialInvestments?: IEarnPortfolioInvestment[];
  initialTotalFiatValue?: string;
  initialTotalEarnings24hFiatValue?: string;
}

function useInvestmentState(options: IInvestmentStateOptions = {}) {
  const [investments, setInvestments] = useState<IEarnPortfolioInvestment[]>(
    () => options.initialInvestments ?? [],
  );
  const [earnTotalFiatValue, setEarnTotalFiatValue] = useState<BigNumber>(
    () => new BigNumber(options.initialTotalFiatValue || 0),
  );
  const [earnTotalEarnings24hFiatValue, setEarnTotalEarnings24hFiatValue] =
    useState<BigNumber>(
      () => new BigNumber(options.initialTotalEarnings24hFiatValue || 0),
    );

  // Use Map to cache investment data, avoid redundant calculations
  const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(
    options.initialInvestments && options.initialInvestments.length > 0
      ? buildInvestmentMapFromList(options.initialInvestments)
      : new Map(),
  );

  const updateInvestments = useCallback(
    (
      newMap: Map<string, IEarnPortfolioInvestment>,
      shouldUpdateTotals = true,
    ): IEarnPortfolioInvestment[] => {
      const validInvestments = filterValidInvestments(newMap.values());
      const sorted = sortByFiatValueDesc(validInvestments);
      setInvestments(sorted);

      if (shouldUpdateTotals) {
        setEarnTotalFiatValue(calculateTotalFiatValue(sorted));
        setEarnTotalEarnings24hFiatValue(calculateTotalEarnings24hValue(sorted));
      }

      investmentMapRef.current = buildInvestmentMapFromList(validInvestments);
      return sorted;
    },
    [],
  );

  const clearInvestments = useCallback(() => {
    investmentMapRef.current.clear();
    setInvestments([]);
    setEarnTotalFiatValue(new BigNumber(0));
    setEarnTotalEarnings24hFiatValue(new BigNumber(0));
  }, []);

  return {
    investments,
    earnTotalFiatValue,
    earnTotalEarnings24hFiatValue,
    investmentMapRef,
    updateInvestments,
    clearInvestments,
  };
}
```

#### useRequestController

Manages request lifecycle, prevents stale requests from updating state (see [state-management-guide.md](state-management-guide.md#request-controller-pattern))

### Data Flow

```
1. Account change detection
   hasAccountChanged() → clearInvestments() → startNewRequest(true)

2. Get available assets and accounts
   getAvailableAssetsV2() + getEarnAvailableAccountsParams()

3. Build account-asset pairs
   accountAssetPairs = accounts × assets (Cartesian product)

4. Concurrent fetching (limit 6 concurrent)
   pLimit(6) → fetchSingleInvestment()

5. Throttled UI update (500ms)
   throttledUIUpdate(requestMap)

6. Final update
   updateInvestments() → setPortfolioCache()

7. Debounced global state sync (500ms)
   debouncedUpdateGlobalState()
```

### Core Implementation

#### Concurrent Investment Fetching

```typescript
const fetchAndUpdateInvestments = useCallback(
  async (options?: IRefreshOptions) => {
    if (!isActive || !isMountedRef.current) return;

    const requestId = hasAccountChanged()
      ? startNewRequest(true)
      : startNewRequest(false);

    const requestMap = new Map(investmentMapRef.current);

    // Get available assets and accounts
    const [assets, accounts] = await Promise.all([
      backgroundApiProxy.serviceStaking.getAvailableAssetsV2(),
      backgroundApiProxy.serviceStaking.getEarnAvailableAccountsParams({
        accountId: accountIdValue,
        networkId: allNetworkId,
        indexedAccountId: accountIndexedAccountIdValue || indexedAccountIdValue,
      }),
    ]);

    if (isRequestStale(requestId) || !isMountedRef.current) return;

    // Build account-asset pairs
    const accountAssetPairs: IAccountAssetPair[] = accounts.flatMap(
      (accountItem) =>
        assets
          .filter((asset) => asset.networkId === accountItem.networkId)
          .map((asset) => ({
            isAirdrop: asset.type === 'airdrop',
            params: {
              accountId: accountIdValue || '',
              accountAddress: accountItem.accountAddress,
              networkId: accountItem.networkId,
              provider: asset.provider,
              symbol: asset.symbol,
              ...(asset.vault && { vault: asset.vault }),
              ...(accountItem.publicKey && { publicKey: accountItem.publicKey }),
            },
          })),
    );

    // Concurrent fetching, limit 6
    const keysUpdatedInThisSession = new Set<string>();
    const limit = pLimit(6);

    const tasks = accountAssetPairs.map(({ params, isAirdrop }) =>
      limit(async () => {
        if (isRequestStale(requestId) || !isMountedRef.current) return;

        const result = await fetchSingleInvestment(params, isAirdrop);

        if (isRequestStale(requestId) || !isMountedRef.current || !result) return;

        const { key: resultKey, investment: newInv, remove } = result;

        if (remove) {
          requestMap.delete(resultKey);
        } else if (newInv) {
          requestMap.set(resultKey, newInv);
        }

        keysUpdatedInThisSession.add(resultKey);

        // Throttle UI update
        if (isMountedRef.current) {
          throttledUIUpdate(new Map(requestMap));
        }
      }),
    );

    await Promise.all(tasks);

    // Ensure all updates are applied
    throttledUIUpdate.flush();

    // Update global cache
    const latestInvestments = updateInvestments(new Map(requestMap), true);

    if (earnAccountKey && latestInvestments) {
      setPortfolioCache((prev) => ({
        ...prev,
        [earnAccountKey]: latestInvestments,
      }));
    }

    finishLoadingNewAccount();
  },
  [/* dependencies */],
);
```

### Polling Configuration

```typescript
usePromiseResult(
  fetchAndUpdateInvestments,
  [
    isActive,
    accountIdValue,
    indexedAccountIdValue,
    allNetworkId,
    fetchAndUpdateInvestments,
  ],
  {
    watchLoading: true,
    pollingInterval: timerUtils.getTimeDurationMs({ minute: 3 }), // 3 minutes
    overrideIsFocused: (isFocused) => isFocused && isActive,
  },
);
```

### Account Data Update Listener

```typescript
useEffect(() => {
  if (!shouldRegisterAccountListener) {
    return undefined;
  }

  const handleAccountDataUpdate = () => {
    if (isSyncingAtomRef.current) return;
    void fetchRef.current();
  };

  appEventBus.on(EAppEventBusNames.AccountDataUpdate, handleAccountDataUpdate);

  return () => {
    appEventBus.off(EAppEventBusNames.AccountDataUpdate, handleAccountDataUpdate);
  };
}, [shouldRegisterAccountListener]);
```

### Investment Data Aggregation

Aggregate investment data by protocol, merging multiple assets from the same protocol:

```typescript
const aggregateByProtocol = (
  investments: IEarnPortfolioInvestment[],
): IEarnPortfolioInvestment[] => {
  const protocolMap = investments.reduce((map, investment) => {
    const protocolKey = investment.protocol.providerDetail.code;
    const existing = map.get(protocolKey);

    if (existing) {
      map.set(protocolKey, mergeInvestments(existing, investment));
    } else {
      map.set(protocolKey, { ...investment });
    }

    return map;
  }, new Map<string, IEarnPortfolioInvestment>());

  return sortByFiatValueDesc(Array.from(protocolMap.values()));
};

// Use when returning
const aggregatedInvestments = useMemo(
  () => aggregateByProtocol(investments),
  [investments],
);

return {
  investments: aggregatedInvestments,
  // ...
};
```

---

## Pending Transaction Handling

### useStakingPendingTxs Hook

Location: `packages/kit/src/views/Earn/hooks/useStakingPendingTxs.ts`

**Returns:**
```typescript
{
  pendingTxs: IStakePendingTx[];
  hasPendingTxs: boolean;
}
```

**IStakePendingTx Structure:**
```typescript
interface IStakePendingTx {
  id: string;
  stakingInfo: {
    label: EEarnLabels;  // 'Stake', 'Unstake', 'Claim', etc.
    protocol: string;
    protocolLogoURI?: string;
    tags?: string[];
  };
  // ... other tx fields
}
```

### StakingActivityIndicator

Location: `packages/kit/src/views/Staking/components/StakingActivityIndicator/`

**Components:**
- `PendingIndicator` - Shows pending count badge
- `StakingActivityIndicator` - Full activity indicator

**Usage:**
```tsx
{pendingCount > 0 ? (
  <PendingIndicator num={pendingCount} onPress={handleHistoryPress} />
) : null}
```

---

## Adding a New Protocol

### Step 1: Backend API

Ensure the backend supports the new protocol:
- `serviceStaking.getAvailableAssetsV2()` returns the protocol
- `serviceStaking.fetchInvestmentDetailV2()` returns user's position
- Protocol-specific actions are implemented

### Step 2: Provider Configuration

If the protocol has special requirements, add configuration:

Location: `packages/shared/types/staking.ts` or protocol-specific files

### Step 3: UI Adaptation (if needed)

For protocols with unique UI requirements:

1. **Special ManageContent**: Create in `Staking/pages/ManagePosition/components/`
   - Example: `AdaManageContent.tsx`, `USDEManageContent.tsx`

2. **Update ManagePositionContent router:**
   ```typescript
   // In ManagePositionContent.tsx
   if (provider === 'your-protocol') {
     return <YourProtocolManageContent {...props} />;
   }
   ```

3. **Custom detail sections**: Add to `ProtocolDetails` or `ProtocolDetailsV2`

### Step 4: Testing

1. Test stake operation with various amounts
2. Test unstake operation (check lock periods)
3. Test claim operation
4. Verify pending state tracking
5. Check portfolio display
6. Test on both desktop and mobile

---

## Navigation

### Opening ManagePosition Modal

```typescript
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

navigation.pushModal(EModalRoutes.StakingModal, {
  screen: EModalStakingRoutes.ManagePosition,
  params: {
    networkId,
    symbol,
    provider,
    vault,  // optional
    tab: 'deposit',  // or 'withdraw'
  },
});
```

### Opening Protocol Details

```typescript
// Desktop - Tab route
navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Earn,
  params: {
    screen: ETabEarnRoutes.EarnProtocolDetails,
    params: { networkId, symbol, provider, vault },
  },
});

// Mobile - Modal route
navigation.pushModal(EModalRoutes.StakingModal, {
  screen: EModalStakingRoutes.ProtocolDetails,
  params: { networkId, symbol, provider, vault },
});
```

---

## Responsive Design

### Desktop Layout
- Side-by-side layout: 65% details, 35% manage position
- Table headers visible
- Popover menus

### Mobile Layout
- Full-width stacked layout
- Expandable rows
- Bottom sheet modals
- Footer action buttons

**Media Query:**
```typescript
const { gtMd } = useMedia();

if (gtMd) {
  // Desktop layout
} else {
  // Mobile layout
}
```

---

## Common Patterns

### Refresh on Transaction Success

```typescript
const handleStake = async () => {
  await stakeAction({
    // ... params
    onSuccess: () => {
      // Refresh portfolio data
      refresh({ provider, networkId, symbol });
    },
  });
};
```

### Disable Actions During Pending

```typescript
const isPending = pendingTxs.some(
  (tx) => tx.stakingInfo.protocol === provider
);

<Button disabled={isPending}>
  Stake
</Button>
```

### Show Pending Indicator

```typescript
const pendingCount = pendingTxs.filter(
  (tx) => tx.stakingInfo.protocol === provider
).length;

{pendingCount > 0 && <PendingIndicator num={pendingCount} />}
```
