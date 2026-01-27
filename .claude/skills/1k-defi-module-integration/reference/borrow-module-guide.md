# Borrow Module Integration Guide

This guide covers integrating new lending protocols into the Borrow module.

## Architecture Overview

```
BorrowHome (integrated in Earn Tab)
├── BorrowProvider (React Context)
├── BorrowPendingBridge (syncs external pending state)
├── BorrowDataGate (data orchestration)
│   ├── useBorrowMarkets()
│   ├── useEarnAccount()
│   └── useBorrowReserves()
├── Overview (net worth, health factor, rewards)
├── 4 Cards
│   ├── SuppliedCard (user's supplied assets)
│   ├── SupplyCard (available to supply)
│   ├── BorrowedCard (user's borrowed assets)
│   └── BorrowCard (available to borrow)
├── ManagePosition Modal (Supply/Withdraw/Borrow/Repay)
└── ReserveDetails (detail page with charts)
```

---

## Key Files

### Home Page

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/pages/BorrowHome.tsx` | Main entry, integrates with Earn Tab |
| `packages/kit/src/views/Borrow/BorrowProvider.tsx` | Context provider with IAsyncData |
| `packages/kit/src/views/Borrow/borrowDataStatus.ts` | Data status enum |
| `packages/kit/src/views/Borrow/components/BorrowDataGate.tsx` | Data orchestration |
| `packages/kit/src/views/Borrow/components/Overview.tsx` | Summary stats |
| `packages/kit/src/views/Borrow/components/Markets.tsx` | Market selector |

### Asset Cards

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/SuppliedCard.tsx` | User's supplied assets |
| `packages/kit/src/views/Borrow/components/SupplyCard.tsx` | Available to supply |
| `packages/kit/src/views/Borrow/components/BorrowedCard.tsx` | User's borrowed assets |
| `packages/kit/src/views/Borrow/components/BorrowCard.tsx` | Available to borrow |

### Operation Components

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/UniversalBorrowSupply/index.tsx` | Supply operation |
| `packages/kit/src/views/Borrow/components/UniversalBorrowWithdraw/index.tsx` | Withdraw operation |
| `packages/kit/src/views/Borrow/components/UniversalBorrowBorrow/index.tsx` | Borrow operation |
| `packages/kit/src/views/Borrow/components/UniversalBorrowRepay/index.tsx` | Repay operation |
| `packages/kit/src/views/Borrow/components/UniversalBorrowAction/index.tsx` | Shared validation hook |

### Detail Pages

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/pages/ReserveDetails/index.tsx` | Reserve detail page |
| `packages/kit/src/views/Borrow/pages/BorrowManagePosition/index.tsx` | Manage position modal |
| `packages/kit/src/views/Borrow/pages/BorrowHistoryList.tsx` | Transaction history |

### Hooks

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/hooks/useBorrowMarkets.ts` | Fetch markets |
| `packages/kit/src/views/Borrow/hooks/useBorrowReserves.ts` | Fetch reserves |
| `packages/kit/src/views/Borrow/hooks/useBorrowHealthFactor.ts` | Health factor with polling |
| `packages/kit/src/views/Borrow/hooks/useBorrowRewards.ts` | Claimable rewards |
| `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts` | Claim action |

### Utilities

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/borrowUtils.ts` | Navigation helpers |
| `packages/kit/src/views/Staking/utils/utils.ts` | Tag builders (buildBorrowTag, parseBorrowTag) |

---

## 4 Operation Types

### 1. Supply (Add Collateral)

**Component:** `UniversalBorrowSupply`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;           // Wallet balance
  maxBalance?: string;       // For max button
  tokenSymbol: string;
  tokenImageUri: string;
  decimals: number;
  price: string;
  tokenInfo: ITokenInfo;
  borrowReserves: IBorrowReserveItem;
  isDisabled?: boolean;
  showApyDetail?: boolean;
  actionLabel?: string;
  onConfirm: (params: ISupplyParams) => Promise<void>;
}
```

**Features:**
- Amount input with percentage selector (25%, 50%, 75%, 100%)
- Token selector (opens BorrowTokenSelect modal)
- Health factor preview (current → after)
- Supply APY display
- "Can be used as collateral" indicator
- Swap/Bridge options for token acquisition

**Validation:**
- Amount > 0
- Amount <= wallet balance
- Valid decimal places
- Protocol-specific checks via `useUniversalBorrowAction`

### 2. Withdraw (Remove Collateral)

**Component:** `UniversalBorrowWithdraw`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;           // Supplied amount
  tokenSymbol: string;
  tokenImageUri: string;
  decimals: number;
  price: string;
  tokenInfo: ITokenInfo;
  isDisabled?: boolean;
  showApyDetail?: boolean;
  actionLabel?: string;
  selectableAssets?: ISelectableAsset[];  // For multi-asset withdrawal
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (asset: ISelectableAsset) => void;
  onConfirm: (params: IWithdrawParams) => Promise<void>;
}
```

**Features:**
- Amount input
- Asset selector popover (for multi-asset)
- Health factor preview
- "Withdraw All" option
- Supply APY display

**Special:**
- `isWithdrawAll` flag passed to `onConfirm`
- Clears amount when token changes

### 3. Borrow

**Component:** `UniversalBorrowBorrow`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;           // Available to borrow
  tokenSymbol: string;
  tokenImageUri: string;
  decimals: number;
  price: string;
  tokenInfo: ITokenInfo;
  borrowReserves: IBorrowReserveItem;
  isDisabled?: boolean;
  showApyDetail?: boolean;
  actionLabel?: string;
  onConfirm: (params: IBorrowParams) => Promise<void>;
}
```

**Features:**
- Amount input with percentage selector
- Token selector
- Health factor preview
- Borrow APY display
- **Liquidation Risk Dialog** - Shows warning if borrowing increases risk

**Liquidation Risk Handling:**
```typescript
const { riskOfLiquidationAlert } = useUniversalBorrowAction({
  action: 'borrow',
  // ... other params
});

// Before confirming, check risk
if (riskOfLiquidationAlert) {
  const confirmed = await showLiquidationRiskDialog();
  if (!confirmed) return;
}
await onConfirm(params);
```

### 4. Repay

**Component:** `UniversalBorrowRepay`

**Props:**
```typescript
{
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;
  balance: string;           // Wallet balance
  maxBalance?: string;       // Debt balance (for repay all)
  tokenSymbol: string;
  tokenImageUri: string;
  decimals: number;
  price: string;
  tokenInfo: ITokenInfo;
  isDisabled?: boolean;
  showApyDetail?: boolean;
  actionLabel?: string;
  selectableAssets?: ISelectableAsset[];
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (asset: ISelectableAsset) => void;
  onConfirm: (params: IRepayParams) => Promise<void>;
}
```

**Features:**
- Amount input
- Asset selector popover
- Health factor preview
- "Repay All" option
- Borrow APY display

**Special:**
- `maxBalance` represents debt balance, not wallet balance
- `isRepayAll` flag passed to `onConfirm`

---

## State Management

### BorrowProvider Context

```typescript
type IBorrowContextValue = {
  // Market (sync data)
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;

  // Async data with unified format
  earnAccount: IAsyncData<IBorrowEarnAccount>;
  setEarnAccount: React.Dispatch<React.SetStateAction<IAsyncData<IBorrowEarnAccount>>>;

  reserves: IAsyncData<IBorrowReserveItem | null>;
  setReserves: React.Dispatch<React.SetStateAction<IAsyncData<IBorrowReserveItem | null>>>;

  // Status
  borrowDataStatus: EBorrowDataStatus;
  setBorrowDataStatus: React.Dispatch<React.SetStateAction<EBorrowDataStatus>>;

  // Swap config
  swapConfig: ISwapConfig;

  // Pending transactions
  pendingTxs: IStakePendingTx[];
  setPendingTxs: (txs: IStakePendingTx[]) => void;

  // Refresh function for external triggers (set by Overview, used by BorrowPendingBridge)
  refreshAllBorrowData: () => Promise<void>;
  setRefreshAllBorrowData: (fn: () => Promise<void>) => void;
};
```

### IAsyncData<T> Pattern

```typescript
type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};

const defaultAsyncData = <T>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});
```

### Forbidden Pattern: Ref for Cross-Component Communication

**NEVER use `useRef` for cross-component function passing** unless absolutely necessary.

**Why this is forbidden:**
1. Ref pattern bypasses React's reactive system, making data flow hard to trace
2. `.current` may be null, requiring extra null checks
3. State function pattern is more aligned with React's declarative paradigm
4. Easier to test and debug

**Bad Example (FORBIDDEN):**
```typescript
// Define ref in Context
refreshDataRef: React.MutableRefObject<(() => Promise<void>) | null>;

// Child component sets ref
useEffect(() => {
  refreshDataRef.current = myRefreshFunction;
}, [myRefreshFunction, refreshDataRef]);

// Other component calls via ref
await refreshDataRef.current?.();
```

**Good Example:**
```typescript
// Define state function in Context
refreshAllData: () => Promise<void>;
setRefreshAllData: (fn: () => Promise<void>) => void;

// Child component sets function
useEffect(() => {
  setRefreshAllData(myRefreshFunction);
  return () => setRefreshAllData(() => Promise.resolve());
}, [myRefreshFunction, setRefreshAllData]);

// Other component calls directly
await refreshAllData();
```

### Data Status State Machine

```typescript
enum EBorrowDataStatus {
  Idle = 'Idle',
  LoadingMarkets = 'LoadingMarkets',
  WaitingForAccount = 'WaitingForAccount',
  LoadingReserves = 'LoadingReserves',
  Refreshing = 'Refreshing',
  Ready = 'Ready',
}
```

**State Transitions:**
```
Idle
  ↓ (view becomes active)
LoadingMarkets
  ↓ (markets loaded)
WaitingForAccount
  ↓ (account resolved)
LoadingReserves
  ↓ (reserves loaded)
Ready
  ↓ (refresh triggered)
Refreshing
  ↓ (refresh complete)
Ready
```

---

## BorrowDataGate

The `BorrowDataGate` component orchestrates all data fetching.

**Responsibilities:**
1. Fetch markets via `useBorrowMarkets`
2. Fetch account via `useEarnAccount`
3. Fetch reserves via `useBorrowReserves`
4. Manage polling (1 minute interval)
5. Handle stale data (1 minute TTL)
6. Sync data to Context

**Key Implementation:**
```typescript
const BorrowDataGate = ({ children, isActive = true }) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;

  // Fetch markets
  const { markets, isLoading: marketsLoading } = useBorrowMarkets({ isActive: isViewActive });

  // Fetch reserves with caching
  const { result: reservesResult, isLoading: reservesLoading, run: refreshReserves } = usePromiseResult(
    async () => {
      // Check stale time, force refresh counter
      // Return cached data if not stale
      // Fetch fresh data if needed
    },
    [dependencies],
    {
      pollingInterval: isViewActive ? POLLING_INTERVAL : undefined,
      revalidateOnFocus: true,
    }
  );

  // Sync to Context
  useEffect(() => {
    setReserves({
      data: reservesResult,
      loading: isLoading,
      refresh: refreshWithForce,
    });
  }, [reservesResult, isLoading, refreshWithForce]);

  return <>{children}</>;
};
```

---

## Health Factor

### useBorrowHealthFactor Hook

```typescript
const {
  healthFactorData,
  isLoading,
  refresh,
} = useBorrowHealthFactor({
  networkId,
  provider,
  marketAddress,
  accountId,
  enabled: boolean,
});
```

**Features:**
- 30-second polling interval
- Color-coded risk levels
- Liquidation threshold alerts

**Health Factor Data:**
```typescript
interface IHealthFactorData {
  healthFactor: {
    text: IEarnText;  // { text: '1.5', color: '$textSuccess' }
    button?: {
      data: {
        healthFactorDetail: IHealthFactorDetail;
      };
    };
  };
  alerts?: IBorrowAlert[];
}
```

**Risk Level Colors:**
- Green (`$textSuccess`): Health factor > 2
- Yellow (`$textCaution`): Health factor 1.5 - 2
- Red (`$textCritical`): Health factor < 1.5

---

## Pending Transaction Handling

### Tag System

Location: `packages/kit/src/views/Staking/utils/utils.ts`

**Build Tag:**
```typescript
const tag = buildBorrowTag({
  provider: 'aave',
  action: 'claim',  // 'supply' | 'withdraw' | 'borrow' | 'repay' | 'claim'
  claimIds: ['1', '2'],  // optional, for claim action
});
// Result: "borrow:aave:claim:1,2"
```

**Parse Tag:**
```typescript
const parsed = parseBorrowTag("borrow:aave:claim:1,2");
// Result: { provider: 'aave', action: 'claim', claimIds: ['1', '2'] }
```

**Check Tag:**
```typescript
const isBorrow = isBorrowTag("borrow:aave:claim:1,2");  // true
```

### BorrowPendingBridge

Bridges external pending transactions to the Borrow Context.

```typescript
const BorrowPendingBridge = ({ pendingTxs, onRegisterBorrowRefresh }) => {
  const { setPendingTxs, refreshAllBorrowData } = useBorrowContext();

  // Sync pending transactions
  useEffect(() => {
    setPendingTxs(pendingTxs ?? []);
  }, [pendingTxs, setPendingTxs]);

  // Register refresh handler
  const handleRefresh = useCallback(async () => {
    await refreshAllBorrowData();
  }, [refreshAllBorrowData]);

  useEffect(() => {
    onRegisterBorrowRefresh?.(handleRefresh);
    return () => onRegisterBorrowRefresh?.(null);
  }, [handleRefresh, onRegisterBorrowRefresh]);

  return null;
};
```

### Extracting Pending Info in UI

```typescript
// In Overview component
const pendingCount = pendingTxs.length;

const pendingClaimIds = useMemo(
  () =>
    pendingTxs
      .filter((tx) => tx.stakingInfo.label === EEarnLabels.Claim)
      .flatMap((tx) => {
        const tags = tx.stakingInfo.tags ?? [];
        return tags.flatMap((tag) => {
          if (isBorrowTag(tag)) {
            return parseBorrowTag(tag)?.claimIds ?? [];
          }
          return [];
        });
      }),
  [pendingTxs]
);
```

---

## Integration with Earn Tab

### BorrowHome Props

```typescript
type IBorrowHomeProps = {
  header?: React.ReactNode;
  isActive?: boolean;
  pendingTxs?: IStakePendingTx[];
  onRegisterBorrowRefresh?: (handler: (() => Promise<void>) | null) => void;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
};
```

### Component Structure

```tsx
const BorrowHome = ({
  header,
  isActive = true,
  pendingTxs,
  onRegisterBorrowRefresh,
  onBorrowNetworksChange,
}) => {
  return (
    <BorrowProvider>
      <BorrowPendingBridge
        pendingTxs={pendingTxs}
        onRegisterBorrowRefresh={onRegisterBorrowRefresh}
      />
      <BorrowDataGate
        isActive={isActive}
        onBorrowNetworksChange={onBorrowNetworksChange}
      >
        <BorrowHomeContent header={header} isActive={isActive} />
      </BorrowDataGate>
    </BorrowProvider>
  );
};
```

---

## Navigation

### Opening ManagePosition Modal

```typescript
import { BorrowNavigation } from '../borrowUtils';

// Supply/Borrow - opens deposit tab
BorrowNavigation.pushToBorrowManagePosition(navigation, {
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
  action: 'supply',  // or 'borrow'
});

// Withdraw/Repay - opens withdraw tab
BorrowNavigation.pushToBorrowManagePosition(navigation, {
  // ... same params
  action: 'withdraw',  // or 'repay'
});
```

### Opening Reserve Details

```typescript
// Desktop - Tab route
BorrowNavigation.pushToBorrowReserveDetails(navigation, {
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
});

// Mobile - Modal route (handled automatically by pushToBorrowReserveDetails)
```

---

## Adding a New Lending Protocol

### Step 1: Backend API

Ensure the backend supports:
- `serviceBorrow.getMarkets()` returns the market
- `serviceBorrow.getReserves()` returns reserve data
- `serviceBorrow.getHealthFactor()` returns health factor
- Protocol-specific actions are implemented

### Step 2: Market Configuration

If the protocol has special requirements, update:
- Market type definitions
- Reserve type definitions
- Health factor calculation

### Step 3: UI Adaptation (if needed)

For protocols with unique requirements:

1. **Custom operation components**: Create variants of `UniversalBorrowXxx`
2. **Custom detail sections**: Add to `ReserveDetails`
3. **Custom validation**: Extend `useUniversalBorrowAction`

### Step 4: Testing

1. Test all 4 operations (Supply, Withdraw, Borrow, Repay)
2. Test health factor updates
3. Test liquidation risk warnings
4. Test pending state tracking
5. Test claim rewards
6. Check responsive layout

---

## Common Patterns

### Refresh on Transaction Success

```typescript
const handleSupply = async () => {
  await supplyAction({
    // ... params
    stakingInfo: {
      label: EEarnLabels.Supply,
      protocol: provider,
      tags: [EEarnLabels.Borrow, buildBorrowTag({ provider, action: 'supply' })],
    },
    onSuccess: () => requestRefresh('txSuccess'),
  });
};
```

### Disable Actions During Pending

```typescript
const pendingIdSet = new Set(pendingClaimIds);
const isClaimPending = pendingIdSet.has(item.id);

<Button disabled={isClaimPending}>
  Claim
</Button>
```

### Show Health Factor Change

```typescript
<HealthFactor
  current={healthFactorData?.healthFactor}
  latest={transactionConfirmation?.healthFactor}
/>
```

---

## Backend Service Methods

All DeFi data is fetched through `backgroundApiProxy.serviceStaking`. Here are the key methods for Borrow module:

### Market & Reserve Data

```typescript
// Fetch available markets
const markets = await backgroundApiProxy.serviceStaking.getBorrowMarkets({
  networkId,
});

// Fetch reserves for a market
const reserves = await backgroundApiProxy.serviceStaking.getBorrowReserves({
  networkId,
  provider,
  marketAddress,
  accountId,  // optional, for user-specific data
});
```

### Health Factor

```typescript
// Fetch health factor (with 30s polling recommended)
const healthFactor = await backgroundApiProxy.serviceStaking.getBorrowHealthFactor({
  networkId,
  provider,
  marketAddress,
  accountId,
});
```

### Transaction Confirmation

```typescript
// Get transaction preview before executing
const confirmation = await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  accountId,
  action: 'supply' | 'withdraw' | 'borrow' | 'repay',
  amount,
  repayAll,  // optional, for repay action
});

// Returns:
// - healthFactor: { current, latest }
// - estimatedFee
// - alerts
// - riskOfLiquidation
```

### Rewards

```typescript
// Fetch claimable rewards
const rewards = await backgroundApiProxy.serviceStaking.getBorrowRewards({
  networkId,
  provider,
  marketAddress,
  accountId,
});

// Claim rewards
await backgroundApiProxy.serviceStaking.claimBorrowRewards({
  networkId,
  provider,
  marketAddress,
  accountId,
  ids,  // reward IDs to claim
});
```

### Service File Location

Main service: `packages/kit-bg/src/services/ServiceStaking.ts`

---

## Error Handling & Validation

### Debounced Validation

Use `useDebouncedCallback` for async validation to avoid excessive API calls:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const checkAmount = useDebouncedCallback(
  async (value: string) => {
    if (!value || !isReady) return;

    setCheckAmountLoading(true);
    try {
      const result = await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation({
        // ... params
        amount: value,
      });
      setTransactionConfirmation(result);
      setCheckAmountAlerts(result.alerts ?? []);
    } catch (error) {
      // Handle error
    } finally {
      setCheckAmountLoading(false);
    }
  },
  300,  // 300ms debounce
  { leading: false, trailing: true }
);

// Call on amount change
useEffect(() => {
  checkAmount(amount);
}, [amount, checkAmount]);
```

### Amount Validation

```typescript
// Check if amount is valid
const isAmountInvalid = (value: string): boolean => {
  if (!value) return true;
  if (Number.isNaN(Number(value))) return true;
  if (value.endsWith('.')) return true;
  return false;
};

// Check decimal places
const countDecimalPlaces = (value: string): number => {
  if (!value.includes('.')) return 0;
  return value.split('.')[1]?.length ?? 0;
};

// Validate
const isValid = useMemo(() => {
  if (isAmountInvalid(amount)) return false;
  if (new BigNumber(amount).lte(0)) return false;
  if (new BigNumber(amount).gt(balance)) return false;
  if (countDecimalPlaces(amount) > decimals) return false;
  if (checkAmountResult === false) return false;
  return true;
}, [amount, balance, decimals, checkAmountResult]);
```

### Error Types

```typescript
import { OneKeyLocalError, OneKeyServerApiError } from '@onekeyhq/shared/src/errors';

try {
  await someAction();
} catch (error) {
  if (error instanceof OneKeyServerApiError) {
    // Server API error - show user-friendly message
    Toast.error({ title: error.message });
  } else if (error instanceof OneKeyLocalError) {
    // Local error - may need different handling
    console.error(error);
  } else {
    // Unknown error
    Toast.error({ title: 'Something went wrong' });
  }
}
```

### Validation Alerts

The `useUniversalBorrowAction` hook returns validation alerts:

```typescript
const {
  checkAmountMessage,      // Error message string
  checkAmountAlerts,       // Array of alerts
  checkAmountLoading,      // Loading state
  isCheckAmountMessageError,  // Is error (vs warning)
  riskOfLiquidationAlert,  // Liquidation risk flag
} = useUniversalBorrowAction({
  action: 'borrow',
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  amount,
});

// Display alerts
{checkAmountMessage && (
  <Alert
    type={isCheckAmountMessageError ? 'critical' : 'warning'}
    title={checkAmountMessage}
  />
)}
```
