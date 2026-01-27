# State Management Guide

This guide covers state management patterns used in DeFi modules, including IAsyncData, Pending transactions, Tag system, and refresh strategies.

---

## useRef 使用规则

### 允许的场景（内部状态管理）

以下场景可以使用 useRef：

1. **缓存数据**：避免不必要的重新渲染
   ```typescript
   const investmentMapRef = useRef<Map<string, IEarnPortfolioInvestment>>(new Map());
   const cachedResultRef = useRef<TData | undefined>(undefined);
   ```

2. **时间戳/计数器**：跟踪最后更新时间或强制刷新计数
   ```typescript
   const lastUpdatedAtRef = useRef<number | null>(null);
   const forceRefreshCounterRef = useRef(0);
   ```

3. **Mounted 检测**：防止组件卸载后更新状态
   ```typescript
   const isMountedRef = useRef(true);
   useEffect(() => {
     isMountedRef.current = true;
     return () => { isMountedRef.current = false; };
   }, []);
   ```

4. **请求 ID 跟踪**：防止过期请求更新状态
   ```typescript
   const stateRef = useRef<IRequestControllerState>({
     accountId: undefined,
     requestId: '',
   });
   ```

5. **View Active 状态**：跟踪视图是否活跃
   ```typescript
   const isViewActiveRef = useRef(isViewActive);
   useEffect(() => {
     isViewActiveRef.current = isViewActive;
   }, [isViewActive]);
   ```

### 禁止的场景（跨组件函数传递）

**❌ 绝对禁止使用 useRef 在组件间传递函数**

**错误示例：**
```typescript
// ❌ FORBIDDEN - 在 Context 中定义 ref
type IContextValue = {
  refreshDataRef: React.MutableRefObject<(() => Promise<void>) | null>;
};

// ❌ FORBIDDEN - 子组件设置 ref
useEffect(() => {
  refreshDataRef.current = myRefreshFunction;
}, [myRefreshFunction, refreshDataRef]);

// ❌ FORBIDDEN - 其他组件通过 ref 调用
await refreshDataRef.current?.();
```

**正确示例（State Function 模式）：**
```typescript
// ✅ CORRECT - 在 Context 中定义 state function
type IContextValue = {
  refreshAllData: () => Promise<void>;
  setRefreshAllData: (fn: () => Promise<void>) => void;
};

// ✅ CORRECT - Provider 实现
const [refreshAllData, setRefreshAllDataState] = useState<() => Promise<void>>(
  () => () => Promise.resolve()
);

const setRefreshAllData = useCallback(
  (fn: () => Promise<void>) => {
    setRefreshAllDataState(() => fn);
  },
  [],
);

// ✅ CORRECT - 子组件注册函数
useEffect(() => {
  setRefreshAllData(myRefreshFunction);
  return () => setRefreshAllData(() => Promise.resolve());
}, [myRefreshFunction, setRefreshAllData]);

// ✅ CORRECT - 其他组件直接调用
await refreshAllData();
```

**为什么禁止 Ref 传递函数：**
1. Ref 绕过 React 响应式系统，数据流难以追踪
2. `.current` 可能为 null，需要额外的空值检查
3. State function 模式更符合 React 声明式范式
4. 更容易测试和调试

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

用于管理异步请求的生命周期，防止过期请求更新状态。

### 类型定义

```typescript
interface IRequestControllerState {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  requestId: string;
  isLoadingNewAccount: boolean;
}
```

### 实现

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

### 使用场景

```typescript
const fetchData = useCallback(async () => {
  // 检测账户是否变化
  const requestId = hasAccountChanged()
    ? startNewRequest(true)
    : startNewRequest(false);

  try {
    const result = await fetchFromAPI();

    // 检查请求是否过期（账户已切换或新请求已发起）
    if (isRequestStale(requestId)) return;

    // 安全更新状态
    updateState(result);

    // 标记新账户加载完成
    finishLoadingNewAccount();
  } catch (error) {
    if (isRequestStale(requestId)) return;
    handleError(error);
  }
}, [hasAccountChanged, startNewRequest, isRequestStale, finishLoadingNewAccount]);
```

### 账户切换处理

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

用于优化频繁更新的性能。

### Throttled UI Updates（渐进式加载）

适用于并发请求场景，避免每个请求完成都触发重渲染：

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

// 在并发请求中使用
const limit = pLimit(6);
const tasks = pairsToFetch.map(({ params }) =>
  limit(async () => {
    const result = await fetchSingleInvestment(params);

    if (isRequestStale(requestId)) return;

    requestMap.set(result.key, result.investment);

    // 节流更新 UI，避免频繁重渲染
    if (isMountedRef.current) {
      throttledUIUpdate(new Map(requestMap));
    }
  }),
);

await Promise.all(tasks);

// 最后确保所有更新都已应用
throttledUIUpdate.flush();
```

### Debounced Global State Sync

适用于同步本地状态到全局 Jotai atoms，避免频繁写入：

```typescript
const debouncedUpdateGlobalState = useMemo(() => {
  return debounce(
    (key: string, fiatValue: string, earnings: string) => {
      const latestAccount = actions.current.getEarnAccount(key);
      if (!latestAccount) return;

      // 防止重复同步
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

// 在状态变化时调用
useEffect(() => {
  if (!earnAccountKey || isLoadingNewAccount()) return;

  const totalFiatValueStr = earnTotalFiatValue.toFixed();
  const earnings24hStr = earnTotalEarnings24hFiatValue.toFixed();

  debouncedUpdateGlobalState(earnAccountKey, totalFiatValueStr, earnings24hStr);
}, [earnAccountKey, earnTotalFiatValue, earnTotalEarnings24hFiatValue, debouncedUpdateGlobalState, isLoadingNewAccount]);
```

### 清理

**重要**：必须在组件卸载时取消 throttle/debounce，防止内存泄漏和状态更新错误：

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
