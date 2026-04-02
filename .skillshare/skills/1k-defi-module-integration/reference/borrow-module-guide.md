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

### ManagePosition Component (Unified Operation Component)

The `ManagePosition` component is a unified component that handles all 4 borrow operations (Supply, Withdraw, Borrow, Repay) through a single `action` prop. This reduces code duplication by 70-80%.

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/ManagePosition/index.tsx` | Main entry, unified component for all 4 operations |
| `packages/kit/src/views/Borrow/components/ManagePosition/ManagePositionContext.tsx` | Context for state management |
| `packages/kit/src/views/Borrow/components/ManagePosition/types.ts` | Type definitions |

#### ManagePosition Hooks

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/ManagePosition/hooks/useManagePositionState.ts` | Core state management (balance, validation, derived values) |
| `packages/kit/src/views/Borrow/components/ManagePosition/hooks/useAmountInput.ts` | Amount input logic (onChange, onMax, percentage selection) |
| `packages/kit/src/views/Borrow/components/ManagePosition/hooks/useTokenSelector.ts` | Token selector logic (navigation vs popover mode) |

#### ManagePosition UI Modules

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/AmountInputSection.tsx` | Amount input area with token selector |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/ActionFooter.tsx` | Confirm button and percentage keyboard |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/index.tsx` | Info display area (health factor, APY, fees) |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/HealthFactorInfo.tsx` | Health factor display |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/PositionInfo.tsx` | Position info (supply/borrow amounts) |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/ApyInfo.tsx` | APY details |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/FeeInfo.tsx` | Fee information |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/CollateralInfo.tsx` | Collateral info |
| `packages/kit/src/views/Borrow/components/ManagePosition/modules/InfoDisplaySection/SwapOrBridgeInfo.tsx` | Swap/Bridge prompt |

#### Shared Validation Hook

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/components/UniversalBorrowAction/index.tsx` | Shared validation hook (useUniversalBorrowAction) |

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
| `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts` | Transaction hooks (Supply, Withdraw, Borrow, Repay, Claim) |

### Utilities

| File | Purpose |
|------|---------|
| `packages/kit/src/views/Borrow/borrowUtils.ts` | Navigation helpers |
| `packages/kit/src/views/Staking/utils/utils.ts` | Tag builders (buildBorrowTag, parseBorrowTag) |

---

## ManagePosition Component

### Overview

`ManagePosition` is a unified component that handles all 4 borrow operations (Supply, Withdraw, Borrow, Repay) through a single `action` prop. This reduces code duplication by 70-80%.

### Props

```typescript
interface IManagePositionProps {
  // Core identifiers
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;

  // Action type - determines behavior
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';

  // Token info
  balance: string;           // Wallet balance (Supply/Repay) or Position balance (Withdraw/Borrow)
  maxBalance?: string;       // For max button calculation
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price?: string;
  tokenInfo?: IEarnTokenInfo;

  // UI configuration
  isDisabled?: boolean;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  actionLabel?: string;
  isInModalContext?: boolean;  // Modal context flag

  // Token selection (for withdraw/repay popover mode)
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  onTokenSelect?: (item: IBorrowAsset) => void;

  // Callbacks
  onConfirm?: (params: IManagePositionConfirmParams) => Promise<void>;
}

interface IManagePositionConfirmParams {
  amount: string;
  withdrawAll?: boolean;  // For withdraw action
  repayAll?: boolean;     // For repay action
}
```

### Action-Specific Behavior

| Feature | Supply | Withdraw | Borrow | Repay |
|---------|--------|----------|--------|-------|
| Token Selector Mode | Navigation | Popover | Navigation | Popover |
| Check Insufficient Balance | ✅ | ✅ | ❌ | ✅ |
| Percentage Calculation Base | maxBalance | maxBalance | maxBalance | Wallet Balance |
| Liquidation Risk Dialog | ❌ | ❌ | ✅ | ❌ |
| isDisabled Affects Info Area | ❌ | ✅ | ✅ | ✅ |
| Special Flag | - | withdrawAll | - | repayAll |

### Usage Examples

```tsx
import { ManagePosition } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import type { IManagePositionConfirmParams } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';

// Supply
<ManagePosition
  accountId={accountId}
  networkId={networkId}
  providerName={providerName}
  action="supply"
  balance={walletBalance}
  maxBalance={maxSupplyBalance}
  tokenSymbol="USDC"
  tokenImageUri={tokenLogo}
  decimals={6}
  price="1.00"
  borrowMarketAddress={marketAddress}
  borrowReserveAddress={reserveAddress}
  onConfirm={async ({ amount }) => {
    await handleSupply(amount);
  }}
/>

// Withdraw with token selector
<ManagePosition
  accountId={accountId}
  networkId={networkId}
  providerName={providerName}
  action="withdraw"
  balance={suppliedBalance}
  tokenSymbol="USDC"
  tokenImageUri={tokenLogo}
  decimals={6}
  price="1.00"
  borrowMarketAddress={marketAddress}
  borrowReserveAddress={reserveAddress}
  selectableAssets={suppliedAssets}
  selectableAssetsLoading={isLoading}
  onTokenSelect={handleTokenSelect}
  onConfirm={async ({ amount, withdrawAll }) => {
    await handleWithdraw(amount, withdrawAll);
  }}
/>

// Borrow (liquidation risk dialog handled internally)
<ManagePosition
  accountId={accountId}
  networkId={networkId}
  providerName={providerName}
  action="borrow"
  balance={availableToBorrow}
  tokenSymbol="USDC"
  tokenImageUri={tokenLogo}
  decimals={6}
  price="1.00"
  borrowMarketAddress={marketAddress}
  borrowReserveAddress={reserveAddress}
  onConfirm={async ({ amount }) => {
    await handleBorrow(amount);
  }}
/>

// Repay
<ManagePosition
  accountId={accountId}
  networkId={networkId}
  providerName={providerName}
  action="repay"
  balance={walletBalance}
  maxBalance={debtBalance}  // Debt balance for repay all
  tokenSymbol="USDC"
  tokenImageUri={tokenLogo}
  decimals={6}
  price="1.00"
  borrowMarketAddress={marketAddress}
  borrowReserveAddress={reserveAddress}
  selectableAssets={borrowedAssets}
  selectableAssetsLoading={isLoading}
  onTokenSelect={handleTokenSelect}
  onConfirm={async ({ amount, repayAll }) => {
    await handleRepay(amount, repayAll);
  }}
/>
```

### Internal Architecture

```
ManagePosition
├── useManagePositionState()     # Core state (balance, validation, derived values)
├── useAmountInput()             # Input handling (onChange, onMax, percentage)
├── useTokenSelector()           # Token selector (navigation vs popover)
├── useUniversalBorrowAction()   # Backend validation API
├── ManagePositionContext        # Shared state via Context
└── UI Modules
    ├── AmountInputSection       # Input area
    ├── InfoDisplaySection       # Info display
    │   ├── HealthFactorInfo
    │   ├── PositionInfo
    │   ├── ApyInfo
    │   ├── FeeInfo
    │   ├── CollateralInfo
    │   └── SwapOrBridgeInfo
    └── ActionFooter             # Confirm button
```

### Token Selector Modes

#### Navigation Mode (Supply/Borrow)

Opens a full-screen token selection page:

```typescript
// In useTokenSelector.ts
if (action === 'supply' || action === 'borrow') {
  navigation.push(EModalStakingRoutes.BorrowTokenSelect, {
    accountId,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    action,
    currentReserveAddress: borrowReserveAddress,
    onSelect: (item: IBorrowAsset) => {
      navigation.setParams({
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
      });
    },
  });
}
```

#### Popover Mode (Withdraw/Repay)

Shows a popover with selectable assets:

```typescript
// In useTokenSelector.ts
if (action === 'withdraw' || action === 'repay') {
  // Uses BorrowAssetSelectPopover component
  const popoverContent = createBorrowAssetSelectPopoverContent({
    assets: selectableAssets,
    isLoading: selectableAssetsLoading,
    selectedReserveAddress: borrowReserveAddress,
    action: action as 'withdraw' | 'repay',
    onSelect: (item) => {
      setAmountValue('');  // Clear input when switching token
      onTokenSelect?.(item);
    },
  });
}
```

### Liquidation Risk Dialog (Borrow Only)

For borrow action, the component automatically shows a liquidation risk confirmation dialog when the health factor is at risk:

```typescript
// In ActionFooter.tsx
const handleConfirm = useCallback(async () => {
  if (action === 'borrow' && actionResult?.riskOfLiquidationAlert) {
    const confirmed = await showLiquidationRiskDialog();
    if (!confirmed) return;
  }
  await onConfirm?.({ amount, withdrawAll, repayAll });
}, [action, actionResult, amount, withdrawAll, repayAll, onConfirm]);
```

### Percentage Selection

The percentage selector (25%, 50%, 75%, 100%) calculates differently based on action:

```typescript
// In useAmountInput.ts
const onSelectPercentageStage = useCallback((stage: number) => {
  let baseAmount: string;

  if (action === 'repay') {
    // Repay: percentage of wallet balance (not debt)
    baseAmount = balance;
  } else {
    // Supply/Withdraw/Borrow: percentage of maxBalance
    baseAmount = maxAmountValue;
  }

  const percentage = stage / 100;
  const amount = new BigNumber(baseAmount).times(percentage).toFixed(decimals);
  setAmountValue(amount);
}, [action, balance, maxAmountValue, decimals, setAmountValue]);
```

### ManagePosition Context

```typescript
interface IManagePositionContextValue {
  state: IManagePositionState;
  actions: IManagePositionActions;
  actionResult: IManagePositionActionResult | null;
}

interface IManagePositionState {
  // Core identifiers
  accountId: string;
  networkId: string;
  providerName: string;
  borrowMarketAddress: string;
  borrowReserveAddress: string;

  // Action configuration
  action: TBorrowActionType;
  actionLabel?: string;

  // Token info
  tokenSymbol?: string;
  tokenImageUri?: string;
  decimals?: number;
  price: string;
  balance: string;
  maxBalance?: string;
  tokenInfo?: IEarnTokenInfo;
  token?: IToken;
  networkLogoURI?: string;

  // UI state
  isDisabled: boolean;
  isInModalContext: boolean;
  amountValue: string;
  submitting: boolean;

  // Derived values
  maxAmountValue: string;
  currentValue: string;
  currencySymbol: string;

  // Validation state
  isInsufficientBalance: boolean;
  isAmountInvalid: boolean;

  // Action-specific flags
  isWithdrawAll: boolean;
  isRepayAll: boolean;

  // Token selection
  selectableAssets?: IBorrowAsset[];
  selectableAssetsLoading?: boolean;
  tokenSelectorMode: TTokenSelectorMode;
  tokenSelectorTriggerProps: ITokenSelectorTriggerProps;

  // UI configuration
  showApyDetail: boolean;
  beforeFooter?: ReactElement | null;
}

interface IManagePositionActions {
  setAmountValue: (value: string) => void;
  setSubmitting: (value: boolean) => void;
  onChangeAmountValue: (value: string) => void;
  onBlurAmountValue: () => void;
  onMax: () => void;
  onSelectPercentageStage: (stage: number) => void;
  onTokenSelect?: (item: IBorrowAsset) => void;
  handleOpenTokenSelector: () => void;
  onSubmit: () => Promise<void>;
}
```

### Usage in Modules

```typescript
// In any module component
import { useManagePositionContext } from '../ManagePositionContext';

function AmountInputSection() {
  const { state, actions } = useManagePositionContext();

  return (
    <StakingAmountInput
      value={state.amountValue}
      onChange={actions.onChangeAmountValue}
      onMax={actions.onMax}
      tokenSymbol={state.tokenSymbol}
      tokenImageUri={state.tokenImageUri}
      balance={state.balance}
      isInsufficientBalance={state.isInsufficientBalance}
      // ...
    />
  );
}
```

---

## Integration with Staking Module

The `ManagePosition` component is used by the Staking module's `StakeSection` and `WithdrawSection` components when the Borrow API is enabled.

### StakeSection Integration

```typescript
// In StakeSection.tsx
import {
  ManagePosition,
  type IManagePositionConfirmParams,
} from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';

const StakeSection = ({ useBorrowApi, borrowAction, ... }) => {
  const isBorrowStake =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'supply' ||
      borrowApiCtx.borrowApiParams.action === 'borrow');

  const onBorrowConfirm = useCallback(
    async (params: IManagePositionConfirmParams) => {
      const { amount } = params;
      // Handle supply or borrow
      await (action === 'borrow' ? handleBorrowBorrow : handleBorrowSupply)({
        amount,
        // ...
      });
    },
    [...]
  );

  return isBorrowStake ? (
    <ManagePosition
      accountId={accountId}
      networkId={networkId}
      providerName={providerName}
      action={borrowApiCtx.borrowApiParams.action as 'supply' | 'borrow'}
      balance={tokenInfo?.balanceParsed ?? ''}
      maxBalance={effectiveMaxBalance}
      onConfirm={onBorrowConfirm}
      isInModalContext={isInModalContext}
      // ...
    />
  ) : (
    <UniversalStake ... />
  );
};
```

### WithdrawSection Integration

```typescript
// In WithdrawSection.tsx
import { ManagePosition } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import type { IManagePositionConfirmParams } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';

const WithdrawSection = ({ useBorrowApi, borrowAction, ... }) => {
  const isBorrowWithdraw =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'withdraw' ||
      borrowApiCtx.borrowApiParams.action === 'repay');

  const onBorrowConfirm = useCallback(
    async ({ amount, withdrawAll, repayAll }: IManagePositionConfirmParams) => {
      if (action === 'repay') {
        await handleBorrowRepay({ amount, repayAll, ... });
      } else {
        await handleBorrowWithdraw({ amount, withdrawAll, ... });
      }
    },
    [...]
  );

  return isBorrowWithdraw ? (
    <ManagePosition
      accountId={accountId}
      networkId={networkId}
      providerName={providerName}
      action={borrowApiCtx.borrowApiParams.action as 'withdraw' | 'repay'}
      balance={effectiveBalance}
      maxBalance={effectiveMaxBalance}
      selectableAssets={assetsList.assets}
      selectableAssetsLoading={assetsListLoading}
      onTokenSelect={handleTokenSelect}
      onConfirm={onBorrowConfirm}
      isInModalContext={isInModalContext}
      // ...
    />
  ) : (
    <UniversalWithdraw ... />
  );
};
```

---

## State Management

### BorrowProvider Full Implementation

#### Type Definition

```typescript
import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

// Unified async data type
export type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};

export type IBorrowEarnAccount = {
  walletId?: string;
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  account?: {
    id: string;
    indexedAccountId?: string;
    pub?: string;
  };
} | null;

type IBorrowContextValue = {
  // Market (sync data)
  market: IBorrowMarketItem | null;
  setMarket: React.Dispatch<React.SetStateAction<IBorrowMarketItem | null>>;

  // Async data - unified format
  earnAccount: IAsyncData<IBorrowEarnAccount>;
  setEarnAccount: React.Dispatch<React.SetStateAction<IAsyncData<IBorrowEarnAccount>>>;

  reserves: IAsyncData<IBorrowReserveItem | null>;
  setReserves: React.Dispatch<React.SetStateAction<IAsyncData<IBorrowReserveItem | null>>>;

  // Status
  borrowDataStatus: EBorrowDataStatus;
  setBorrowDataStatus: React.Dispatch<React.SetStateAction<EBorrowDataStatus>>;

  // Other
  swapConfig: ISwapConfig;
  pendingTxs: IStakePendingTx[];
  setPendingTxs: (txs: IStakePendingTx[]) => void;

  // ✅ State function pattern (NOT ref) for cross-component communication
  refreshAllBorrowData: () => Promise<void>;
  setRefreshAllBorrowData: (fn: () => Promise<void>) => void;
};
```

#### Helper Function

```typescript
const defaultAsyncData = <T,>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});
```

#### Provider Implementation

```typescript
const BorrowContext = createContext<IBorrowContextValue | null>(null);

export const BorrowProvider = ({ children }: PropsWithChildren) => {
  const [market, setMarket] = useState<IBorrowMarketItem | null>(null);
  const [earnAccount, setEarnAccount] = useState<IAsyncData<IBorrowEarnAccount>>(
    defaultAsyncData(null),
  );
  const [reserves, setReserves] = useState<IAsyncData<IBorrowReserveItem | null>>(
    defaultAsyncData(null),
  );
  const [borrowDataStatus, setBorrowDataStatus] = useState<EBorrowDataStatus>(
    EBorrowDataStatus.Idle,
  );
  const [pendingTxs, setPendingTxsState] = useState<IStakePendingTx[]>([]);

  // ✅ State function pattern for cross-component communication
  // Note: When storing functions in useState, use () => fn format
  const [refreshAllBorrowData, setRefreshAllBorrowDataState] = useState<
    () => Promise<void>
  >(() => () => Promise.resolve());

  // Stable setter - use useCallback to ensure stable reference
  const setRefreshAllBorrowData = useCallback(
    (fn: () => Promise<void>) => {
      setRefreshAllBorrowDataState(() => fn);
    },
    [],
  );

  // Stable setter for pending transactions
  const setPendingTxs = useCallback((txs: IStakePendingTx[]) => {
    setPendingTxsState(txs);
  }, []);

  // Fetch swap config when market networkId changes
  const { result: swapConfig } = usePromiseResult(
    async () => {
      const networkId = market?.networkId;
      if (!networkId) {
        return defaultSwapConfig;
      }
      return backgroundApiProxy.serviceSwap.checkSupportSwap({ networkId });
    },
    [market?.networkId],
    { initResult: defaultSwapConfig },
  );

  const contextValue = useMemo(
    () => ({
      market,
      setMarket,
      earnAccount,
      setEarnAccount,
      reserves,
      setReserves,
      borrowDataStatus,
      setBorrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
      refreshAllBorrowData,
      setRefreshAllBorrowData,
    }),
    [
      market,
      earnAccount,
      reserves,
      borrowDataStatus,
      swapConfig,
      pendingTxs,
      setPendingTxs,
      refreshAllBorrowData,
      setRefreshAllBorrowData,
    ],
  );

  return (
    <BorrowContext.Provider value={contextValue}>
      {children}
    </BorrowContext.Provider>
  );
};

export const useBorrowContext = () => {
  const context = useContext(BorrowContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useBorrowContext must be used within a BorrowProvider',
    );
  }
  return context;
};
```

#### Child Component Registers Refresh Function

```typescript
// In Overview.tsx
const { reserves, setRefreshAllBorrowData } = useBorrowContext();

const refreshReserves = reserves.refresh;
const refreshBorrowData = useCallback(async () => {
  const tasks: Array<Promise<void>> = [];
  tasks.push(refreshReserves());
  tasks.push(refreshBorrowRewards(), refreshHealthFactor());
  await Promise.all(tasks);
}, [refreshReserves, refreshBorrowRewards, refreshHealthFactor]);

// Register refresh function to Context
useEffect(() => {
  setRefreshAllBorrowData(refreshBorrowData);
  return () => {
    setRefreshAllBorrowData(() => Promise.resolve());
  };
}, [refreshBorrowData, setRefreshAllBorrowData]);
```

#### BorrowPendingBridge Call

```typescript
// In BorrowPendingBridge
const { refreshAllBorrowData } = useBorrowContext();

const handleRefresh = useCallback(async () => {
  await refreshAllBorrowData(); // Call directly, no .current needed
}, [refreshAllBorrowData]);
```

### IAsyncData<T> Pattern

```typescript
type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};

const defaultAsyncData = <T,>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});
```

### useRef Usage Rules

**❌ Forbidden: Cross-component function passing**

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

**✅ Allowed: Internal state management**

```typescript
// ✅ Cache data
const reservesResultRef = useRef<IBorrowReserveItem | undefined>(undefined);

// ✅ Timestamp tracking
const lastReservesUpdatedAtRef = useRef<number | null>(null);

// ✅ Force refresh counter
const forceRefreshCounterRef = useRef(0);

// ✅ View Active state
const isViewActiveRef = useRef(isViewActive);
```

See [state-management-guide.md](state-management-guide.md#useref-usage-rules)

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
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌──────┐    ┌───────────────┐    ┌───────────────────┐   │
│ Idle │───▶│LoadingMarkets │───▶│WaitingForAccount  │   │
└──────┘    └───────────────┘    └───────────────────┘   │
                                          │              │
                                          ▼              │
                                 ┌─────────────────┐     │
                                 │ LoadingReserves │     │
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

**Status Calculation Implementation:**

```typescript
const dataStatus = useMemo(() => {
  if (!isViewActive) return EBorrowDataStatus.Idle;

  if (marketsLoading) {
    if (!market) return EBorrowDataStatus.LoadingMarkets;
    return EBorrowDataStatus.Refreshing;
  }

  if (!market || !fetchKey) return EBorrowDataStatus.Idle;

  if (shouldWaitForAccount) return EBorrowDataStatus.WaitingForAccount;

  if (reservesLoading) {
    // Distinguish between initial load and refresh
    if (!prevReservesDataRef.current || lastFetchKeyRef.current !== fetchKey) {
      return EBorrowDataStatus.LoadingReserves;
    }
    return EBorrowDataStatus.Refreshing;
  }

  if (reservesResult !== undefined) {
    return EBorrowDataStatus.Ready;
  }

  return EBorrowDataStatus.Idle;
}, [
  isViewActive,
  marketsLoading,
  market,
  fetchKey,
  shouldWaitForAccount,
  reservesLoading,
  reservesResult,
]);
```

---

## BorrowDataGate Full Implementation

The `BorrowDataGate` component orchestrates all data fetching.

**Responsibilities:**
1. Fetch markets via `useBorrowMarkets`
2. Fetch account via `useEarnAccount`
3. Fetch reserves via `useBorrowReserves`
4. Manage polling (1 minute interval)
5. Handle stale data (1 minute TTL)
6. Sync data to Context using IAsyncData format
7. Calculate and sync data status

**Constants:**

```typescript
const BORROW_POLLING_INTERVAL = 1 * 60 * 1000; // 1 minute
const BORROW_STALE_TTL = BORROW_POLLING_INTERVAL;
```

**Full Implementation:**

```typescript
export const BorrowDataGate = ({
  children,
  isActive = true,
  onBorrowNetworksChange,
}: {
  children: ReactNode;
  isActive?: boolean;
  onBorrowNetworksChange?: (networkIds: string[]) => void;
}) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;
  const isViewActiveRef = useRef(isViewActive);

  const {
    markets,
    isLoading: marketsLoading,
    refetchMarkets,
  } = useBorrowMarkets({ isActive: isViewActive });
  const market = useMemo(() => markets?.[0], [markets]);

  const {
    setMarket,
    setReserves,
    setEarnAccount,
    setBorrowDataStatus,
  } = useBorrowContext();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const {
    earnAccount: earnAccountData,
    refreshAccount,
    isLoading: earnAccountLoading,
  } = useEarnAccount({ networkId: market?.networkId });

  const { fetchReserves } = useBorrowReserves();

  // ✅ Use useRef for internal state management
  const lastFetchKeyRef = useRef<string | null>(null);
  const lastReservesUpdatedAtRef = useRef<number | null>(null);
  const reservesResultRef = useRef<IBorrowReserveItem | undefined>(undefined);
  const forceRefreshCounterRef = useRef(0);
  const lastForceRefreshCounterRef = useRef(0);
  const prevReservesDataRef = useRef<IBorrowReserveItem | null>(null);

  const accountId = earnAccountData?.accountId ?? earnAccountData?.account?.id;
  const shouldWaitForAccount =
    !activeAccount.ready ||
    (activeAccount.account?.id !== undefined && earnAccountData === undefined);

  const fetchKey = useMemo(
    () =>
      !isEmpty(market)
        ? `${market.provider}-${market.marketAddress}-${accountId ?? 'public'}`
        : null,
    [market, accountId],
  );

  // Main data fetching
  const {
    result: reservesResult,
    isLoading: reservesLoading,
    run: refreshReserves,
  } = usePromiseResult(
    async () => {
      if (!fetchKey || !market || shouldWaitForAccount) {
        return reservesResultRef.current;
      }
      if (!isViewActiveRef.current) {
        return reservesResultRef.current;
      }

      const lastUpdatedAt = lastReservesUpdatedAtRef.current;
      const isStale = !lastUpdatedAt || Date.now() - lastUpdatedAt > BORROW_STALE_TTL;
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      const hasNoCache = reservesResultRef.current === undefined;
      const shouldFetch = shouldForceRefresh || isStale || hasNoCache;

      if (!shouldFetch) {
        return reservesResultRef.current;
      }

      lastForceRefreshCounterRef.current = forceRefreshCounterRef.current;

      const result = await fetchReserves({
        provider: market.provider,
        networkId: market.networkId,
        marketAddress: market.marketAddress,
        accountId,
      });

      reservesResultRef.current = result;
      lastReservesUpdatedAtRef.current = Date.now();
      return result;
    },
    [fetchKey, market, accountId, shouldWaitForAccount, fetchReserves],
    {
      watchLoading: true,
      checkIsFocused: true,
      undefinedResultIfReRun: true,
      undefinedResultIfError: true,
      pollingInterval: isViewActive ? BORROW_POLLING_INTERVAL : undefined,
      revalidateOnFocus: true,
    },
  );

  // Force refresh function
  const refreshReservesWithForce = useMemo(() => {
    return async () => {
      forceRefreshCounterRef.current += 1;
      await refreshReserves();
    };
  }, [refreshReserves]);

  // Calculate data status
  const dataStatus = useMemo(() => {
    if (!isViewActive) return EBorrowDataStatus.Idle;
    if (marketsLoading) {
      if (!market) return EBorrowDataStatus.LoadingMarkets;
      return EBorrowDataStatus.Refreshing;
    }
    if (!market || !fetchKey) return EBorrowDataStatus.Idle;
    if (shouldWaitForAccount) return EBorrowDataStatus.WaitingForAccount;
    if (reservesLoading) {
      if (!prevReservesDataRef.current || lastFetchKeyRef.current !== fetchKey) {
        return EBorrowDataStatus.LoadingReserves;
      }
      return EBorrowDataStatus.Refreshing;
    }
    if (reservesResult !== undefined) return EBorrowDataStatus.Ready;
    return EBorrowDataStatus.Idle;
  }, [isViewActive, marketsLoading, market, fetchKey, shouldWaitForAccount, reservesLoading, reservesResult]);

  // Sync isViewActiveRef
  useEffect(() => {
    isViewActiveRef.current = isViewActive;
  }, [isViewActive]);

  // Clear cache when fetchKey changes
  useEffect(() => {
    if (lastFetchKeyRef.current !== fetchKey) {
      lastFetchKeyRef.current = fetchKey;
      lastReservesUpdatedAtRef.current = null;
      reservesResultRef.current = undefined;
    }
  }, [fetchKey]);

  // Sync market to Context
  useEffect(() => {
    setMarket(market ?? null);
  }, [market, setMarket]);

  // Sync dataStatus to Context
  useEffect(() => {
    setBorrowDataStatus(dataStatus);
  }, [dataStatus, setBorrowDataStatus]);

  // Sync earnAccount to Context (IAsyncData format)
  useEffect(() => {
    setEarnAccount({
      data: earnAccountData ?? null,
      loading: earnAccountLoading ?? false,
      refresh: () => refreshAccount(),
    });
  }, [earnAccountData, earnAccountLoading, refreshAccount, setEarnAccount]);

  // Sync reserves to Context (IAsyncData format)
  useEffect(() => {
    const isLoading =
      dataStatus === EBorrowDataStatus.LoadingMarkets ||
      dataStatus === EBorrowDataStatus.WaitingForAccount ||
      dataStatus === EBorrowDataStatus.LoadingReserves;

    let dataToSet: IBorrowReserveItem | null = prevReservesDataRef.current;

    if (dataStatus === EBorrowDataStatus.LoadingMarkets ||
        dataStatus === EBorrowDataStatus.WaitingForAccount) {
      dataToSet = null;
    } else if (dataStatus === EBorrowDataStatus.LoadingReserves) {
      if (lastFetchKeyRef.current !== fetchKey) {
        dataToSet = null;
      }
    } else if (dataStatus === EBorrowDataStatus.Ready && reservesResult !== undefined) {
      dataToSet = reservesResult;
    }

    prevReservesDataRef.current = dataToSet;

    setReserves({
      data: dataToSet,
      loading: isLoading,
      refresh: refreshReservesWithForce,
    });
  }, [dataStatus, fetchKey, reservesResult, refreshReservesWithForce, setReserves]);

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

---

## Repay with Collateral Pattern

This section covers the "Repay with Collateral" feature, which allows users to repay debt using their collateral assets instead of wallet balance.

### Overview

| Aspect | Standard Repay | Repay with Collateral |
|--------|---------------|----------------------|
| Source | Wallet balance | Collateral assets |
| Input | Single amount | Dual amount (Repay ↔ Using) |
| Token Selection | Debt token | Collateral token |
| Swap Required | No | Yes (collateral → debt) |
| Slippage | Not needed | Required |
| Price Impact | Not shown | Must show |

### Repay Source Toggle

```tsx
type TRepaySource = 'wallet' | 'collateral';

function RepaySourceToggle({
  value,
  onChange,
}: {
  value: TRepaySource;
  onChange: (source: TRepaySource) => void;
}) {
  return (
    <SegmentControl
      value={value}
      onChange={onChange}
      options={[
        { value: 'wallet', label: 'From wallet balance' },
        { value: 'collateral', label: 'With Collateral' },
      ]}
    />
  );
}
```

**State Reset on Toggle:**
```typescript
const handleSourceChange = useCallback((source: TRepaySource) => {
  setRepaySource(source);
  // Reset amounts when switching source
  setRepayAmount('');
  setUsingAmount('');
  // Reset selected collateral
  if (source === 'collateral') {
    setSelectedCollateral(defaultCollateral);
  }
}, [defaultCollateral]);
```

### Dual Amount Input Pattern

For operations involving asset conversion (e.g., repay with collateral), implement dual input with bidirectional sync.

**State Structure:**
```typescript
interface IDualInputState {
  repayAmount: string;           // Debt token amount to repay
  usingAmount: string;           // Collateral token amount to use
  activeInput: 'repay' | 'using'; // Which input is being edited
  isCalculating: boolean;        // Quote calculation in progress
}

const [dualInput, setDualInput] = useState<IDualInputState>({
  repayAmount: '',
  usingAmount: '',
  activeInput: 'repay',
  isCalculating: false,
});
```

**Bidirectional Sync Logic:**
```typescript
// When repay amount changes, calculate using amount
const calculateUsingAmount = useDebouncedCallback(
  async (repayAmount: string) => {
    if (!repayAmount || dualInput.activeInput !== 'repay') return;

    setDualInput(prev => ({ ...prev, isCalculating: true }));

    try {
      const quote = await backgroundApiProxy.serviceStaking.getRepayWithCollateralQuote({
        networkId,
        provider,
        marketAddress,
        debtReserveAddress,
        collateralReserveAddress: selectedCollateral.reserveAddress,
        repayAmount,
        slippage,
      });

      setDualInput(prev => ({
        ...prev,
        usingAmount: quote.collateralAmount,
        isCalculating: false,
      }));
      setExchangeRate(quote.exchangeRate);
      setPriceImpact(quote.priceImpact);
    } catch (error) {
      setDualInput(prev => ({ ...prev, isCalculating: false }));
    }
  },
  300,
);

// When using amount changes, calculate repay amount
const calculateRepayAmount = useDebouncedCallback(
  async (usingAmount: string) => {
    if (!usingAmount || dualInput.activeInput !== 'using') return;

    setDualInput(prev => ({ ...prev, isCalculating: true }));

    try {
      const quote = await backgroundApiProxy.serviceStaking.getRepayWithCollateralQuote({
        networkId,
        provider,
        marketAddress,
        debtReserveAddress,
        collateralReserveAddress: selectedCollateral.reserveAddress,
        collateralAmount: usingAmount,
        slippage,
      });

      setDualInput(prev => ({
        ...prev,
        repayAmount: quote.repayAmount,
        isCalculating: false,
      }));
      setExchangeRate(quote.exchangeRate);
      setPriceImpact(quote.priceImpact);
    } catch (error) {
      setDualInput(prev => ({ ...prev, isCalculating: false }));
    }
  },
  300,
);
```

**UI Component:**
```tsx
function DualAmountInput({
  repayToken,
  collateralToken,
  dualInput,
  onRepayAmountChange,
  onUsingAmountChange,
  exchangeRate,
  priceImpact,
}: IDualAmountInputProps) {
  return (
    <YStack gap="$3">
      {/* Repay Amount Input */}
      <YStack>
        <SizableText size="$bodySm" color="$textSubdued">Repay</SizableText>
        <XStack justifyContent="space-between" alignItems="center">
          <NumberInput
            value={dualInput.repayAmount}
            onChange={(value) => {
              onRepayAmountChange(value);
            }}
            onFocus={() => setDualInput(prev => ({ ...prev, activeInput: 'repay' }))}
          />
          <TokenSelector token={repayToken} disabled />
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            ${formatCurrency(repayAmountUsd)}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            Available {repayToken.available} <Pressable onPress={onMax}>Max</Pressable>
          </SizableText>
        </XStack>
      </YStack>

      {/* Swap Arrow */}
      <XStack justifyContent="center">
        <Icon name="ArrowUpDownOutline" size={20} color="$iconSubdued" />
      </XStack>

      {/* Using Amount Input */}
      <YStack>
        <SizableText size="$bodySm" color="$textSubdued">Using</SizableText>
        <XStack justifyContent="space-between" alignItems="center">
          <NumberInput
            value={dualInput.usingAmount}
            onChange={(value) => {
              onUsingAmountChange(value);
            }}
            onFocus={() => setDualInput(prev => ({ ...prev, activeInput: 'using' }))}
          />
          <CollateralSelector
            selected={collateralToken}
            onSelect={onCollateralSelect}
          />
        </XStack>
        <XStack justifyContent="space-between">
          <SizableText size="$bodySm" color={getPriceImpactColor(priceImpact)}>
            ${formatCurrency(usingAmountUsd)} ({priceImpact})
          </SizableText>
        </XStack>
      </YStack>

      {/* Exchange Rate */}
      <XStack justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          1 {collateralToken.symbol} = {exchangeRate} {repayToken.symbol}
        </SizableText>
      </XStack>
    </YStack>
  );
}
```

### Collateral Selector

Unlike the standard token selector, the collateral selector shows:
- Available collateral balance
- USD value of collateral
- Only assets that are currently supplied as collateral

```tsx
interface ICollateralAsset {
  reserveAddress: string;
  token: {
    symbol: string;
    logoURI: string;
    decimals: number;
  };
  collateralBalance: string;      // Amount supplied as collateral
  collateralBalanceUsd: string;   // USD value
}

function CollateralSelector({
  selected,
  assets,
  onSelect,
}: {
  selected: ICollateralAsset;
  assets: ICollateralAsset[];
  onSelect: (asset: ICollateralAsset) => void;
}) {
  return (
    <Popover>
      <Popover.Trigger>
        <XStack alignItems="center" gap="$1" cursor="pointer">
          <Image source={{ uri: selected.token.logoURI }} size={24} />
          <SizableText>{selected.token.symbol}</SizableText>
          <Icon name="ChevronDownSmallOutline" size={16} />
        </XStack>
      </Popover.Trigger>
      <Popover.Content>
        <YStack>
          <XStack justifyContent="space-between" px="$3" py="$2">
            <SizableText size="$bodySm" color="$textSubdued">Asset</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">Available</SizableText>
          </XStack>
          {assets.map((asset) => (
            <Pressable
              key={asset.reserveAddress}
              onPress={() => onSelect(asset)}
            >
              <XStack
                justifyContent="space-between"
                alignItems="center"
                px="$3"
                py="$2"
                bg={asset.reserveAddress === selected.reserveAddress ? '$bgActive' : undefined}
              >
                <XStack alignItems="center" gap="$2">
                  <Image source={{ uri: asset.token.logoURI }} size={32} />
                  <SizableText>{asset.token.symbol}</SizableText>
                </XStack>
                <YStack alignItems="flex-end">
                  <SizableText>
                    {asset.collateralBalance} {asset.token.symbol}
                  </SizableText>
                  <SizableText size="$bodySm" color="$textSubdued">
                    ${asset.collateralBalanceUsd}
                  </SizableText>
                </YStack>
              </XStack>
            </Pressable>
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
```

### Slippage Settings

For operations involving swaps, implement slippage settings:

```typescript
interface ISlippageSettings {
  mode: 'auto' | 'custom';
  value: string;  // Percentage, e.g., "0.5"
}

const DEFAULT_SLIPPAGE = '0.5';

function SlippageSettings({
  settings,
  onChange,
}: {
  settings: ISlippageSettings;
  onChange: (settings: ISlippageSettings) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <YStack>
      <Pressable onPress={() => setIsExpanded(!isExpanded)}>
        <XStack justifyContent="space-between" alignItems="center">
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">Slippage</SizableText>
            <Tooltip content="Maximum price difference you're willing to accept">
              <Icon name="InfoCircleOutline" size={14} color="$iconSubdued" />
            </Tooltip>
          </XStack>
          <XStack alignItems="center" gap="$1">
            <SizableText size="$bodySm">
              {settings.mode === 'auto' ? `Auto (${DEFAULT_SLIPPAGE}%)` : `${settings.value}%`}
            </SizableText>
            <Icon
              name={isExpanded ? 'ChevronUpSmallOutline' : 'ChevronRightSmallOutline'}
              size={16}
              color="$iconSubdued"
            />
          </XStack>
        </XStack>
      </Pressable>

      {isExpanded && (
        <XStack gap="$2" mt="$2">
          <Button
            size="small"
            variant={settings.mode === 'auto' ? 'primary' : 'secondary'}
            onPress={() => onChange({ mode: 'auto', value: DEFAULT_SLIPPAGE })}
          >
            Auto
          </Button>
          {['0.1', '0.5', '1.0'].map((value) => (
            <Button
              key={value}
              size="small"
              variant={settings.mode === 'custom' && settings.value === value ? 'primary' : 'secondary'}
              onPress={() => onChange({ mode: 'custom', value })}
            >
              {value}%
            </Button>
          ))}
          <NumberInput
            value={settings.mode === 'custom' ? settings.value : ''}
            onChange={(value) => onChange({ mode: 'custom', value })}
            placeholder="Custom"
            suffix="%"
            size="small"
          />
        </XStack>
      )}
    </YStack>
  );
}
```

### Price Impact Display

Show price impact with color-coded severity:

```typescript
type TPriceImpactSeverity = 'low' | 'medium' | 'high';

function getPriceImpactSeverity(impact: string): TPriceImpactSeverity {
  const impactNum = Math.abs(parseFloat(impact));
  if (impactNum < 0.5) return 'low';
  if (impactNum < 2) return 'medium';
  return 'high';
}

function getPriceImpactColor(impact: string): string {
  const severity = getPriceImpactSeverity(impact);
  switch (severity) {
    case 'low':
      return '$textSubdued';
    case 'medium':
      return '$textCaution';
    case 'high':
      return '$textCritical';
  }
}

function PriceImpactDisplay({ impact, usdValue }: { impact: string; usdValue: string }) {
  const severity = getPriceImpactSeverity(impact);
  const color = getPriceImpactColor(impact);

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText size="$bodySm" color={color}>
        ${usdValue} ({impact}%)
      </SizableText>
      {severity === 'high' && (
        <Icon name="AlertTriangleOutline" size={14} color="$iconCritical" />
      )}
    </XStack>
  );
}
```

### Repay with Collateral Info Display

Show the impact of the operation on user's position:

```tsx
function RepayWithCollateralInfo({
  healthFactor,
  myBorrow,
  remainingCollateral,
}: IRepayWithCollateralInfoProps) {
  return (
    <YStack gap="$3">
      {/* Health Factor Change */}
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText>Health factor</SizableText>
        <XStack alignItems="center" gap="$2">
          <SizableText color={getHealthFactorColor(healthFactor.current)}>
            {healthFactor.current}
          </SizableText>
          <Icon name="ArrowRightOutline" size={14} color="$iconSubdued" />
          <SizableText color={getHealthFactorColor(healthFactor.after)}>
            {healthFactor.after}
          </SizableText>
        </XStack>
      </XStack>
      {healthFactor.after < 1.5 && (
        <SizableText size="$bodySm" color="$textCritical">
          Liquidation at &lt; 1.0
        </SizableText>
      )}

      {/* My Borrow Change */}
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText>My borrow</SizableText>
        <XStack alignItems="center" gap="$2">
          <YStack alignItems="flex-end">
            <SizableText>{myBorrow.current}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              ${myBorrow.currentUsd}
            </SizableText>
          </YStack>
          <Icon name="ArrowRightOutline" size={14} color="$iconSubdued" />
          <YStack alignItems="flex-end">
            <SizableText>{myBorrow.after}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              ${myBorrow.afterUsd}
            </SizableText>
          </YStack>
        </XStack>
      </XStack>

      {/* Remaining Collateral */}
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText>Remaining collateral</SizableText>
        <SizableText>
          {remainingCollateral.amount} {remainingCollateral.symbol} (${remainingCollateral.usd})
        </SizableText>
      </XStack>
    </YStack>
  );
}
```

---

## Adding a New Lending Protocol

This section provides a comprehensive guide for integrating a new lending protocol (e.g., AAVE, Compound) into the Borrow module.

### Protocol Feature Comparison

Before integration, understand the protocol's features:

| Feature | Morpho | AAVE v3 | Compound v3 |
|---------|--------|---------|-------------|
| Health Factor | ✅ | ✅ | ❌ (uses Account Liquidity) |
| Multiple Markets | ✅ | ✅ | ✅ |
| Flash Loans | ❌ | ✅ | ❌ |
| Isolation Mode | ❌ | ✅ | ❌ |
| E-Mode (Efficiency Mode) | ❌ | ✅ | ❌ |
| Variable Rate | ✅ | ✅ | ✅ |
| Stable Rate | ❌ | ✅ | ❌ |
| Rewards | ✅ | ✅ | ✅ |
| Permit (Gasless Approval) | ❌ | ✅ | ✅ |

### Step 1: Define Protocol Types

**Location:** `packages/shared/types/borrow/`

```typescript
// protocols/aave.ts
export enum EAaveFeature {
  IsolationMode = 'IsolationMode',
  EMode = 'EMode',
  StableRate = 'StableRate',
}

export interface IAaveMarket extends IBorrowMarketItem {
  provider: 'aave';
  features: EAaveFeature[];
  eModeCategories?: IAaveEModeCategory[];
}

export interface IAaveEModeCategory {
  id: number;
  label: string;
  ltv: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  assets: string[];  // Reserve addresses in this category
}

export interface IAaveReserve extends IBorrowReserveItem {
  // AAVE-specific fields
  stableBorrowRate?: string;
  variableBorrowRate: string;
  isIsolated?: boolean;
  isolationModeTotalDebt?: string;
  isolationModeDebtCeiling?: string;
  eModeCategory?: number;
}
```

### Step 2: Extend Provider Enum

**Location:** `packages/shared/types/staking.ts`

```typescript
export enum EBorrowProvider {
  Morpho = 'morpho',
  Aave = 'aave',
  Compound = 'compound',
  // Add new provider here
}
```

### Step 3: Implement Backend Service Methods

**Location:** `packages/kit-bg/src/services/ServiceStaking.ts`

```typescript
// Add protocol-specific methods
class ServiceStaking {
  // ... existing methods

  // AAVE-specific: Get E-Mode categories
  @backgroundMethod()
  async getAaveEModeCategories(params: {
    networkId: string;
    marketAddress: string;
  }): Promise<IAaveEModeCategory[]> {
    // Implementation
  }

  // AAVE-specific: Set E-Mode
  @backgroundMethod()
  async setAaveEMode(params: {
    networkId: string;
    marketAddress: string;
    accountId: string;
    categoryId: number;
  }): Promise<IEncodedTx> {
    // Implementation
  }

  // Protocol-agnostic methods should handle provider differences internally
  @backgroundMethod()
  async getBorrowReserves(params: IBorrowReservesParams): Promise<IBorrowReserveItem> {
    const { provider } = params;

    switch (provider) {
      case EBorrowProvider.Aave:
        return this.getAaveReserves(params);
      case EBorrowProvider.Morpho:
        return this.getMorphoReserves(params);
      case EBorrowProvider.Compound:
        return this.getCompoundReserves(params);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
```

### Step 4: Protocol-Specific UI Components (if needed)

For protocols with unique features, create dedicated UI components:

**Example: AAVE E-Mode Selector**

```tsx
// packages/kit/src/views/Borrow/components/AaveEModeSelector.tsx
function AaveEModeSelector({
  categories,
  currentCategory,
  onSelect,
}: {
  categories: IAaveEModeCategory[];
  currentCategory: number;
  onSelect: (categoryId: number) => void;
}) {
  return (
    <YStack>
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText>E-Mode</SizableText>
        <Popover>
          <Popover.Trigger>
            <XStack alignItems="center" gap="$1" cursor="pointer">
              <SizableText>
                {currentCategory === 0
                  ? 'Disabled'
                  : categories.find(c => c.id === currentCategory)?.label}
              </SizableText>
              <Icon name="ChevronDownSmallOutline" size={16} />
            </XStack>
          </Popover.Trigger>
          <Popover.Content>
            <YStack>
              <Pressable onPress={() => onSelect(0)}>
                <XStack px="$3" py="$2">
                  <SizableText>Disabled</SizableText>
                </XStack>
              </Pressable>
              {categories.map((category) => (
                <Pressable key={category.id} onPress={() => onSelect(category.id)}>
                  <YStack px="$3" py="$2">
                    <SizableText>{category.label}</SizableText>
                    <SizableText size="$bodySm" color="$textSubdued">
                      LTV: {category.ltv}% | Liquidation: {category.liquidationThreshold}%
                    </SizableText>
                  </YStack>
                </Pressable>
              ))}
            </YStack>
          </Popover.Content>
        </Popover>
      </XStack>
    </YStack>
  );
}
```

### Step 5: Extend ManagePosition (if needed)

For protocols with significantly different operation flows:

```typescript
// In ManagePosition/index.tsx
function ManagePosition(props: IManagePositionProps) {
  const { providerName, action } = props;

  // Protocol-specific rendering
  if (providerName === EBorrowProvider.Aave && action === 'borrow') {
    return <AaveBorrowContent {...props} />;
  }

  // Default rendering
  return <DefaultManagePositionContent {...props} />;
}
```

### Step 6: Update Tag System

**Location:** `packages/kit/src/views/Staking/utils/utils.ts`

```typescript
// Extend tag format if protocol has unique operations
export function buildBorrowTag(params: {
  provider: string;
  action: TBorrowAction | 'setEMode';  // Add protocol-specific actions
  claimIds?: string[];
  eModeCategory?: number;  // AAVE-specific
}): string {
  const { provider, action, claimIds, eModeCategory } = params;
  let tag = `borrow:${provider}:${action}`;

  if (claimIds?.length) {
    tag += `:${claimIds.join(',')}`;
  }
  if (eModeCategory !== undefined) {
    tag += `:emode-${eModeCategory}`;
  }

  return tag;
}
```

### Step 7: Testing Checklist

- [ ] Test all 4 basic operations (Supply, Withdraw, Borrow, Repay)
- [ ] Test protocol-specific features (E-Mode, Isolation Mode, etc.)
- [ ] Test health factor calculation and display
- [ ] Test liquidation risk warnings
- [ ] Test rewards claiming
- [ ] Test pending transaction tracking
- [ ] Test error handling for protocol-specific errors
- [ ] Test on all supported networks for the protocol
- [ ] Test responsive layout (desktop/mobile)

### Protocol Integration Checklist

```markdown
## New Protocol Integration Checklist

### Phase 1: Type Definitions
- [ ] Define protocol-specific types in `packages/shared/types/borrow/`
- [ ] Add provider to `EBorrowProvider` enum
- [ ] Define protocol feature flags

### Phase 2: Backend Service
- [ ] Implement `get{Protocol}Markets()` method
- [ ] Implement `get{Protocol}Reserves()` method
- [ ] Implement `get{Protocol}HealthFactor()` method (if applicable)
- [ ] Implement protocol-specific action methods
- [ ] Update `getBorrowReserves()` to handle new provider
- [ ] Update `getBorrowTransactionConfirmation()` to handle new provider

### Phase 3: UI Components
- [ ] Determine if protocol needs custom UI components
- [ ] Create protocol-specific components (if needed)
- [ ] Update ManagePosition to handle protocol differences
- [ ] Add protocol-specific info sections to detail page

### Phase 4: Tag System
- [ ] Update `buildBorrowTag()` for protocol-specific actions
- [ ] Update `parseBorrowTag()` to handle new tag formats
- [ ] Test pending transaction tracking

### Phase 5: Testing
- [ ] Test all operations on testnet
- [ ] Test all operations on mainnet
- [ ] Test edge cases (max amounts, zero balance, etc.)
- [ ] Test error scenarios
- [ ] Test responsive layout
```
```
