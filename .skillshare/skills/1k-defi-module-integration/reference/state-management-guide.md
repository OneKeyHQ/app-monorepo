# State Management Guide

This guide covers state management patterns used in DeFi modules, including IAsyncData, Pending transactions, Tag system, and refresh strategies.

---

## useRef Usage Rules

### Allowed Scenarios (Internal State Management)

The following scenarios allow useRef:

1. **Cache Data**: Avoid unnecessary re-renders
   ```typescript
   const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(new Map());
   const cachedResultRef = useRef<TData | undefined>(undefined);
   ```

2. **Timestamps/Counters**: Track last update time or force refresh count
   ```typescript
   const lastUpdatedAtRef = useRef<number | null>(null);
   const forceRefreshCounterRef = useRef(0);
   ```

3. **Mounted Detection**: Prevent state updates after unmount
   ```typescript
   const isMountedRef = useRef(true);
   useEffect(() => {
     isMountedRef.current = true;
     return () => { isMountedRef.current = false; };
   }, []);
   ```

4. **Request ID Tracking**: Prevent stale requests from updating state
   ```typescript
   const stateRef = useRef<IRequestControllerState>({
     accountId: undefined,
     requestId: '',
   });
   ```

5. **View Active State**: Track if view is active
   ```typescript
   const isViewActiveRef = useRef(isViewActive);
   useEffect(() => {
     isViewActiveRef.current = isViewActive;
   }, [isViewActive]);
   ```

### Forbidden Scenarios (Cross-Component Function Passing)

**❌ NEVER use useRef to pass functions between components**

**Bad Example:**
```typescript
// ❌ FORBIDDEN - Define ref in Context
type IContextValue = {
  refreshDataRef: React.MutableRefObject<(() => Promise<void>) | null>;
};

// ❌ FORBIDDEN - Child component sets ref
useEffect(() => {
  refreshDataRef.current = myRefreshFunction;
}, [myRefreshFunction, refreshDataRef]);

// ❌ FORBIDDEN - Other components call via ref
await refreshDataRef.current?.();
```

**Good Example (State Function Pattern):**
```typescript
// ✅ CORRECT - Define state function in Context
type IContextValue = {
  refreshAllData: () => Promise<void>;
  setRefreshAllData: (fn: () => Promise<void>) => void;
};

// ✅ CORRECT - Provider implementation
const [refreshAllData, setRefreshAllDataState] = useState<() => Promise<void>>(
  () => () => Promise.resolve()
);

const setRefreshAllData = useCallback(
  (fn: () => Promise<void>) => {
    setRefreshAllDataState(() => fn);
  },
  [],
);

// ✅ CORRECT - Child component registers function
useEffect(() => {
  setRefreshAllData(myRefreshFunction);
  return () => setRefreshAllData(() => Promise.resolve());
}, [myRefreshFunction, setRefreshAllData]);

// ✅ CORRECT - Other components call directly
await refreshAllData();
```

**Why Ref Function Passing is Forbidden:**
1. Refs bypass React's reactive system, making data flow hard to trace
2. `.current` may be null, requiring extra null checks
3. State function pattern aligns better with React's declarative paradigm
4. Easier to test and debug

---

## IAsyncData<T> Pattern

### Definition

```typescript
type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};
```

### Purpose

Provides a unified format for all async data, making it easy to:
- Display loading states consistently
- Trigger refreshes from any component
- Track data availability

### Helper Function

```typescript
const defaultAsyncData = <T>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});
```

### Usage in Context

```typescript
// In Provider
const [reserves, setReserves] = useState<IAsyncData<IReserveData | null>>(
  defaultAsyncData(null)
);

// In DataGate - sync fetched data to Context
useEffect(() => {
  setReserves({
    data: reservesResult ?? null,
    loading: isLoading,
    refresh: refreshWithForce,
  });
}, [reservesResult, isLoading, refreshWithForce, setReserves]);

// In UI Component - consume data
const { reserves } = useModuleContext();

if (reserves.loading && !reserves.data) {
  return <Skeleton />;
}

return (
  <View>
    <Text>{reserves.data?.value}</Text>
    <Button onPress={reserves.refresh}>Refresh</Button>
  </View>
);
```

### Best Practices

1. **Always update all three fields together**
   ```typescript
   // ✅ Correct
   setData({
     data: result,
     loading: isLoading,
     refresh: refreshFunction,
   });

   // ❌ Wrong - partial update
   setData(prev => ({ ...prev, data: result }));
   ```

2. **Show skeleton only on initial load**
   ```typescript
   // Show skeleton only when loading AND no data
   if (reserves.loading && !reserves.data) {
     return <Skeleton />;
   }
   // Show data with loading indicator for refresh
   return (
     <View>
       <Data value={reserves.data} />
       {reserves.loading && <RefreshIndicator />}
     </View>
   );
   ```

---

## Data Status State Machine

### Definition

```typescript
enum EDataStatus {
  Idle = 'Idle',                    // Initial state, no data
  LoadingMarkets = 'LoadingMarkets', // Fetching market/protocol info
  WaitingForAccount = 'WaitingForAccount', // Waiting for account resolution
  LoadingData = 'LoadingData',      // Fetching main data
  Refreshing = 'Refreshing',        // Background refresh with existing data
  Ready = 'Ready',                  // Data loaded successfully
}
```

### State Transitions

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌──────┐    ┌───────────────┐    ┌───────────────────┐   │
│ Idle │───▶│LoadingMarkets │───▶│WaitingForAccount  │   │
└──────┘    └───────────────┘    └───────────────────┘   │
                                          │              │
                                          ▼              │
                                 ┌─────────────────┐     │
                                 │  LoadingData    │     │
                                 └─────────────────┘     │
                                          │              │
                                          ▼              │
                                 ┌─────────────────┐     │
                                 │     Ready       │◀────┘
                                 └─────────────────┘
                                          │
                                          ▼
                                 ┌─────────────────┐
                                 │   Refreshing    │
                                 └─────────────────┘
                                          │
                                          └──────────────┘
```

### Implementation

```typescript
const dataStatus = useMemo(() => {
  if (!isViewActive) return EDataStatus.Idle;

  if (marketsLoading) {
    if (!market) return EDataStatus.LoadingMarkets;
    return EDataStatus.Refreshing;
  }

  if (!market || !fetchKey) return EDataStatus.Idle;

  if (shouldWaitForAccount) return EDataStatus.WaitingForAccount;

  if (dataLoading) {
    if (!prevDataRef.current || lastFetchKeyRef.current !== fetchKey) {
      return EDataStatus.LoadingData;
    }
    return EDataStatus.Refreshing;
  }

  if (dataResult !== undefined) {
    return EDataStatus.Ready;
  }

  return EDataStatus.Idle;
}, [isViewActive, marketsLoading, market, fetchKey, shouldWaitForAccount, dataLoading, dataResult]);
```

### Usage for UI States

```typescript
const isInitialLoading =
  dataStatus === EDataStatus.LoadingMarkets ||
  dataStatus === EDataStatus.WaitingForAccount ||
  dataStatus === EDataStatus.LoadingData;

const isRefreshing = dataStatus === EDataStatus.Refreshing;
const isReady = dataStatus === EDataStatus.Ready;

// UI rendering
if (isInitialLoading) {
  return <FullPageSkeleton />;
}

return (
  <View>
    <Content data={data} />
    {isRefreshing && <RefreshIndicator />}
  </View>
);
```

---

## Pending Transaction Management

### PendingTx Structure

```typescript
interface IStakePendingTx {
  id: string;                       // Transaction hash or unique ID
  stakingInfo: {
    label: EEarnLabels;             // 'Stake', 'Unstake', 'Claim', 'Supply', 'Borrow', etc.
    protocol: string;               // Protocol name
    protocolLogoURI?: string;
    tags?: string[];                // Custom tags for filtering
  };
  createdAt: number;
  // ... other tx fields
}
```

### EEarnLabels Enum

```typescript
enum EEarnLabels {
  Stake = 'Stake',
  Unstake = 'Unstake',
  Claim = 'Claim',
  Supply = 'Supply',
  Withdraw = 'Withdraw',
  Borrow = 'Borrow',
  Repay = 'Repay',
  // ... other labels
}
```

### Tracking Pending Transactions

```typescript
// In Provider
const [pendingTxs, setPendingTxsState] = useState<IStakePendingTx[]>([]);

const setPendingTxs = useCallback((txs: IStakePendingTx[]) => {
  setPendingTxsState(txs);
}, []);

// In PendingBridge - sync from external source
useEffect(() => {
  setPendingTxs(externalPendingTxs ?? []);
}, [externalPendingTxs, setPendingTxs]);
```

### Filtering Pending Transactions

```typescript
// Get pending count for a specific protocol
const pendingCount = pendingTxs.filter(
  (tx) => tx.stakingInfo.protocol === provider
).length;

// Get pending transactions by label
const pendingClaims = pendingTxs.filter(
  (tx) => tx.stakingInfo.label === EEarnLabels.Claim
);

// Check if any pending for this action
const hasPendingSupply = pendingTxs.some(
  (tx) =>
    tx.stakingInfo.label === EEarnLabels.Supply &&
    tx.stakingInfo.protocol === provider
);
```

---

## Tag System

Tags provide a way to encode additional information in pending transactions for filtering and identification.

### Tag Format

```
borrow:{provider}:{action}[:{claimIds}]
```

**Examples:**
- `borrow:aave:supply`
- `borrow:aave:borrow`
- `borrow:aave:claim:1,2,3`

### Tag Functions

Location: `packages/kit/src/views/Staking/utils/utils.ts`

#### buildBorrowTag

```typescript
type IBorrowAction = 'supply' | 'borrow' | 'withdraw' | 'repay' | 'claim';

const buildBorrowTag = ({
  provider,
  action,
  claimIds,
}: {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
}): string => {
  const base = `borrow:${provider.toLowerCase()}:${action}`;
  if (action === 'claim' && claimIds?.length) {
    return `${base}:${claimIds.toSorted().join(',')}`;
  }
  return base;
};

// Usage
const tag = buildBorrowTag({
  provider: 'aave',
  action: 'claim',
  claimIds: ['reward-1', 'reward-2'],
});
// Result: "borrow:aave:claim:reward-1,reward-2"
```

#### parseBorrowTag

```typescript
const parseBorrowTag = (
  tag: string,
): {
  provider: string;
  action: IBorrowAction;
  claimIds?: string[];
} | null => {
  if (!tag.startsWith('borrow:')) return null;
  const parts = tag.split(':');
  if (parts.length < 3) return null;
  return {
    provider: parts[1],
    action: parts[2] as IBorrowAction,
    claimIds: parts[3]?.split(','),
  };
};

// Usage
const parsed = parseBorrowTag("borrow:aave:claim:reward-1,reward-2");
// Result: { provider: 'aave', action: 'claim', claimIds: ['reward-1', 'reward-2'] }
```

#### isBorrowTag

```typescript
const isBorrowTag = (tag: string): boolean => tag.startsWith('borrow:');
```

### Using Tags in Transactions

```typescript
// When creating a transaction
const stakingInfo = {
  label: EEarnLabels.Claim,
  protocol: earnUtils.getEarnProviderName({ providerName: provider }),
  protocolLogoURI: market?.logoURI,
  tags: [
    EEarnLabels.Borrow,  // Category tag
    buildBorrowTag({
      provider,
      action: 'claim',
      claimIds: ['reward-1', 'reward-2'],
    }),
  ],
};

await claimAction({
  // ... params
  stakingInfo,
});
```

### Extracting Info from Tags

```typescript
// Extract pending claim IDs
const pendingClaimIds = useMemo(
  () =>
    pendingTxs
      .filter((tx) => tx.stakingInfo.label === EEarnLabels.Claim)
      .flatMap((tx) => {
        const tags = tx.stakingInfo.tags ?? [];
        return tags.flatMap((tag) => {
          if (isBorrowTag(tag)) {
            const parsed = parseBorrowTag(tag);
            return parsed?.claimIds ?? [];
          }
          return [];
        });
      }),
  [pendingTxs]
);

// Disable claim button if already pending
const pendingIdSet = new Set(pendingClaimIds);
const isClaimPending = pendingIdSet.has(item.id);

<Button disabled={isClaimPending}>
  Claim
</Button>
```

---

## DataGate Pattern

DataGate is a component that orchestrates data fetching and syncs results to Context.

### Responsibilities

1. **Fetch data** from backend APIs
2. **Manage caching** with stale time
3. **Handle polling** when view is active
4. **Sync to Context** using IAsyncData format
5. **Track data status** for UI states

### Implementation Template

```typescript
const POLLING_INTERVAL = 60 * 1000; // 1 minute
const STALE_TTL = POLLING_INTERVAL;

export const DataGate = ({
  children,
  isActive = true,
}: {
  children: ReactNode;
  isActive?: boolean;
}) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;
  const isViewActiveRef = useRef(isViewActive);

  const { setData, setDataStatus } = useModuleContext();

  // Refs for caching
  const lastFetchKeyRef = useRef<string | null>(null);
  const lastUpdatedAtRef = useRef<number | null>(null);
  const cachedResultRef = useRef<TData | undefined>(undefined);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);

  // Build fetch key for cache invalidation
  const fetchKey = useMemo(() => {
    // Return unique key based on dependencies
    return `${provider}-${accountId}`;
  }, [provider, accountId]);

  // Main data fetch with caching
  const {
    result,
    isLoading,
    run: refreshData,
  } = usePromiseResult(
    async () => {
      if (!fetchKey || !isViewActiveRef.current) {
        return cachedResultRef.current;
      }

      const lastUpdatedAt = lastUpdatedAtRef.current;
      const isStale = !lastUpdatedAt || Date.now() - lastUpdatedAt > STALE_TTL;
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      const hasNoCache = cachedResultRef.current === undefined;

      const shouldFetch = shouldForceRefresh || isStale || hasNoCache;
      if (!shouldFetch) {
        return cachedResultRef.current;
      }

      lastForceRefreshCounterRef.current = forceRefreshCounterRef.current;

      // Fetch fresh data
      const data = await fetchData({ /* params */ });
      cachedResultRef.current = data;
      lastUpdatedAtRef.current = Date.now();
      return data;
    },
    [fetchKey, /* other dependencies */],
    {
      watchLoading: true,
      checkIsFocused: true,
      pollingInterval: isViewActive ? POLLING_INTERVAL : undefined,
      revalidateOnFocus: true,
    }
  );

  // Force refresh function
  const refreshWithForce = useMemo(() => {
    return async () => {
      forceRefreshCounterRef.current += 1;
      await refreshData();
    };
  }, [refreshData]);

  // Update isViewActiveRef
  useEffect(() => {
    isViewActiveRef.current = isViewActive;
  }, [isViewActive]);

  // Clear cache on fetchKey change
  useEffect(() => {
    if (lastFetchKeyRef.current !== fetchKey) {
      lastFetchKeyRef.current = fetchKey;
      lastUpdatedAtRef.current = null;
      cachedResultRef.current = undefined;
    }
  }, [fetchKey]);

  // Sync to Context
  useEffect(() => {
    setData({
      data: result ?? null,
      loading: isLoading,
      refresh: refreshWithForce,
    });
  }, [result, isLoading, refreshWithForce, setData]);

  return <>{children}</>;
};
```

---

## PendingBridge Pattern

PendingBridge syncs external pending transactions to the module's Context.

### Implementation

```typescript
const PendingBridge = ({
  pendingTxs,
  onRegisterRefresh,
}: {
  pendingTxs?: IStakePendingTx[];
  onRegisterRefresh?: (handler: (() => Promise<void>) | null) => void;
}) => {
  const { setPendingTxs, refreshDataRef } = useModuleContext();

  // Sync pending transactions to Context
  useEffect(() => {
    setPendingTxs(pendingTxs ?? []);
  }, [pendingTxs, setPendingTxs]);

  // Create refresh handler
  const handleRefresh = useCallback(async () => {
    await refreshDataRef.current?.();
  }, [refreshDataRef]);

  // Register refresh handler for external callers
  useEffect(() => {
    if (!onRegisterRefresh) return undefined;
    onRegisterRefresh(handleRefresh);
    return () => {
      onRegisterRefresh(null);
    };
  }, [handleRefresh, onRegisterRefresh]);

  return null;
};
```

### Usage in Home Page

```typescript
const ModuleHome = ({
  pendingTxs,
  onRegisterRefresh,
}) => {
  return (
    <ModuleProvider>
      <PendingBridge
        pendingTxs={pendingTxs}
        onRegisterRefresh={onRegisterRefresh}
      />
      <DataGate>
        <HomeContent />
      </DataGate>
    </ModuleProvider>
  );
};
```

---

## Refresh Strategies

### Refresh Triggers

| Trigger | When | What to Refresh | Implementation |
|---------|------|-----------------|----------------|
| Manual | User clicks refresh button | All visible data | `requestRefresh('manual')` |
| Transaction Success | Pending tx completes | Affected data | `requestRefresh('txSuccess')` |
| Polling | Every N minutes | All data (background) | `pollingInterval` option |
| Focus | Tab/screen becomes active | Stale data only | `revalidateOnFocus` option |
| Account Change | User switches account | Clear cache, fetch all | Watch `activeAccount` |

### Implementation

```typescript
// In Overview component
const requestRefresh = useCallback(
  async (reason: 'manual' | 'txSuccess') => {
    setIsManualRefreshing(true);
    try {
      await refreshBorrowData();
    } finally {
      setIsManualRefreshing(false);
    }
  },
  [refreshBorrowData]
);

// Register for external refresh (e.g., when pending tx completes)
useEffect(() => {
  refreshBorrowDataRef.current = () => requestRefresh('txSuccess');
  return () => {
    if (refreshBorrowDataRef.current === requestRefresh) {
      refreshBorrowDataRef.current = null;
    }
  };
}, [requestRefresh, refreshBorrowDataRef]);

// Manual refresh button
<IconButton
  icon="RefreshCcwOutline"
  loading={reserves.loading || isManualRefreshing}
  onPress={() => requestRefresh('manual')}
/>
```

### Refresh on Transaction Success

```typescript
const handleClaim = async () => {
  await claimAction({
    // ... params
    stakingInfo: {
      label: EEarnLabels.Claim,
      protocol: provider,
      tags: [buildBorrowTag({ provider, action: 'claim', claimIds })],
    },
    onSuccess: () => requestRefresh('txSuccess'),
  });
};
```

### Partial Refresh (Earn Module)

```typescript
// Refresh only specific protocol data
const refresh = useCallback(
  async (options?: IRefreshOptions) => {
    await fetchAndUpdateInvestments(options);
  },
  [fetchAndUpdateInvestments]
);

// Usage
refresh({ provider: 'lido', networkId: 'evm--1', symbol: 'ETH' });
```

---

## Request Controller Pattern

Used to manage async request lifecycle and prevent stale requests from updating state.

### Type Definition

```typescript
interface IRequestControllerState {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  requestId: string;
  isLoadingNewAccount: boolean;
}
```

### Implementation

```typescript
function useRequestController(
  accountId: string | undefined,
  indexedAccountId: string | undefined,
) {
  const stateRef = useRef<IRequestControllerState>({
    accountId,
    indexedAccountId,
    requestId: '',
    isLoadingNewAccount: true,
  });

  const hasAccountChanged = useCallback(() => {
    const state = stateRef.current;
    return (
      state.accountId !== accountId ||
      state.indexedAccountId !== indexedAccountId
    );
  }, [accountId, indexedAccountId]);

  const startNewRequest = useCallback(
    (isAccountChange = false) => {
      const newRequestId = generateUUID();
      stateRef.current = {
        accountId,
        indexedAccountId,
        requestId: newRequestId,
        isLoadingNewAccount: isAccountChange
          ? true
          : stateRef.current.isLoadingNewAccount,
      };
      return newRequestId;
    },
    [accountId, indexedAccountId],
  );

  const isRequestStale = useCallback((requestId: string) => {
    return requestId !== stateRef.current.requestId;
  }, []);

  const finishLoadingNewAccount = useCallback(() => {
    stateRef.current.isLoadingNewAccount = false;
  }, []);

  const isLoadingNewAccount = useCallback(() => {
    return stateRef.current.isLoadingNewAccount;
  }, []);

  return {
    hasAccountChanged,
    startNewRequest,
    isRequestStale,
    finishLoadingNewAccount,
    isLoadingNewAccount,
  };
}
```

### Usage Scenarios

```typescript
const fetchData = useCallback(async () => {
  // Check if account has changed
  const requestId = hasAccountChanged()
    ? startNewRequest(true)
    : startNewRequest(false);

  try {
    const result = await fetchFromAPI();

    // Check if request is stale (account switched or new request started)
    if (isRequestStale(requestId)) return;

    // Safely update state
    updateState(result);

    // Mark new account loading complete
    finishLoadingNewAccount();
  } catch (error) {
    if (isRequestStale(requestId)) return;
    handleError(error);
  }
}, [hasAccountChanged, startNewRequest, isRequestStale, finishLoadingNewAccount]);
```

### Account Switch Handling

```typescript
useEffect(() => {
  if (hasAccountChanged()) {
    clearInvestments();
    throttledUIUpdate.cancel();
    startNewRequest(true);
    setIsLoading(true);
  }
}, [hasAccountChanged, clearInvestments, throttledUIUpdate, startNewRequest]);
```

---

## Throttled/Debounced Updates Pattern

Used to optimize performance for frequent updates.

### Throttled UI Updates (Progressive Loading)

Suitable for concurrent request scenarios, avoiding re-renders on every request completion:

```typescript
const throttledUIUpdate = useMemo(
  () =>
    throttle(
      (newMap: Map<string, IEarnPortfolioInvestment>) => {
        updateInvestments(newMap, false);
      },
      500,
      { leading: true, trailing: true },
    ),
  [updateInvestments],
);

// Use in concurrent requests
const limit = pLimit(6);
const tasks = pairsToFetch.map(({ params }) =>
  limit(async () => {
    const result = await fetchSingleInvestment(params);

    if (isRequestStale(requestId)) return;

    requestMap.set(result.key, result.investment);

    // Throttle UI updates to avoid frequent re-renders
    if (isMountedRef.current) {
      throttledUIUpdate(new Map(requestMap));
    }
  }),
);

await Promise.all(tasks);

// Ensure all updates are applied at the end
throttledUIUpdate.flush();
```

### Debounced Global State Sync

Suitable for syncing local state to global Jotai atoms, avoiding frequent writes:

```typescript
const debouncedUpdateGlobalState = useMemo(() => {
  return debounce(
    (key: string, fiatValue: string, earnings: string) => {
      const latestAccount = actions.current.getEarnAccount(key);
      if (!latestAccount) return;

      // Only update if values changed (prevent duplicate sync)
      if (
        lastSyncedValuesRef.current.totalFiatValue === fiatValue &&
        lastSyncedValuesRef.current.earnings24h === earnings
      ) {
        return;
      }

      lastSyncedValuesRef.current = {
        totalFiatValue: fiatValue,
        earnings24h: earnings
      };

      actions.current.updateEarnAccounts({
        key,
        earnAccount: {
          ...latestAccount,
          totalFiatValue: fiatValue,
          earnings24h: earnings,
        },
      });
    },
    500,
  );
}, [actions]);

// Call when state changes
useEffect(() => {
  if (!earnAccountKey || isLoadingNewAccount()) return;

  const totalFiatValueStr = earnTotalFiatValue.toFixed();
  const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

  debouncedUpdateGlobalState(earnAccountKey, totalFiatValueStr, earnings24hStr);
}, [earnAccountKey, earnTotalFiatValue, earnTotalEarnings24hFiatValue, debouncedUpdateGlobalState, isLoadingNewAccount]);
```

### Cleanup

**Important**: You must cancel throttle/debounce on component unmount to prevent memory leaks and state update errors:

```typescript
useEffect(() => {
  isMountedRef.current = true;

  return () => {
    isMountedRef.current = false;
    throttledUIUpdate.cancel();
    debouncedUpdateGlobalState.cancel();
    investmentMapRef.current.clear();
  };
}, [throttledUIUpdate, debouncedUpdateGlobalState, investmentMapRef]);
```

---

## Context vs Jotai

### When to Use Context

- Page-scoped data (cleared when leaving page)
- Data that doesn't need to persist
- Complex interdependent state
- Example: Borrow module

### When to Use Jotai

- Global data (shared across pages)
- Data that should persist
- Simple independent atoms
- Example: Earn module portfolio

### Hybrid Approach

```typescript
// Use Jotai for global cache
const [portfolioCache, setPortfolioCache] = useEarnPortfolioInvestmentsAtom();

// Use local state for UI
const [isLoading, setIsLoading] = useState(false);

// Sync to Jotai on fetch complete
if (earnAccountKey && latestInvestments) {
  setPortfolioCache((prev) => ({
    ...prev,
    [earnAccountKey]: latestInvestments,
  }));
}
```
