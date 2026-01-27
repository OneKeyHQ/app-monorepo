# New Module Integration Guide

This guide covers creating an entirely new DeFi module (not fitting into Earn or Borrow patterns).

## When to Create a New Module

Create a new module when:
- Operations differ significantly from Earn (Stake/Unstake/Claim) or Borrow (Supply/Withdraw/Borrow/Repay)
- Data structures are fundamentally different
- Requires independent Tab or unique navigation
- Has unique UI/UX requirements

**Examples:**
- Pendle (PT/YT trading, fixed yield)
- GMX (perpetual trading)
- Options protocols
- Liquidity provision with impermanent loss tracking

---

## Module Structure Template

```
packages/kit/src/views/YourModule/
├── YourModuleProvider.tsx          # Context or Jotai provider
├── yourModuleDataStatus.ts         # Data status enum (optional)
├── yourModuleUtils.ts              # Navigation and utility functions
├── components/
│   ├── YourModuleDataGate.tsx      # Data orchestration
│   ├── Overview.tsx                # Summary stats
│   ├── YourOperationA/             # Operation A component
│   │   └── index.tsx
│   ├── YourOperationB/             # Operation B component
│   │   └── index.tsx
│   └── ...
├── hooks/
│   ├── useYourModuleData.ts        # Main data hook
│   ├── useYourModuleActions.ts     # Action handlers
│   └── ...
└── pages/
    ├── YourModuleHome.tsx          # Home page
    ├── YourModuleDetails/          # Detail page
    │   └── index.tsx
    └── YourModuleManagePosition/   # Manage position modal
        └── index.tsx
```

---

## Step-by-Step Implementation

### Step 1: Define Routes

#### 1.1 Create Route Enum

Location: `packages/shared/src/routes/yourModule.ts`

```typescript
export enum EModalYourModuleRoutes {
  YourModuleManagePosition = 'YourModuleManagePosition',
  YourModuleDetails = 'YourModuleDetails',
  YourModuleHistory = 'YourModuleHistory',
}

export type IModalYourModuleParamList = {
  [EModalYourModuleRoutes.YourModuleManagePosition]: {
    networkId: string;
    symbol: string;
    provider: string;
    // ... other params
  };
  [EModalYourModuleRoutes.YourModuleDetails]: {
    networkId: string;
    symbol: string;
    provider: string;
  };
  [EModalYourModuleRoutes.YourModuleHistory]: {
    accountId: string;
    networkId: string;
  };
};
```

#### 1.2 Add to Modal Routes

Location: `packages/shared/src/routes/modal.ts`

```typescript
export enum EModalRoutes {
  // ... existing routes
  YourModuleModal = 'YourModuleModal',
}

export type IModalParamList = {
  // ... existing types
  [EModalRoutes.YourModuleModal]: IModalYourModuleParamList;
};
```

#### 1.3 Create Router Configuration

Location: `packages/kit/src/views/YourModule/router/index.ts`

```typescript
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IModalYourModuleParamList } from '@onekeyhq/shared/src/routes/yourModule';
import { EModalYourModuleRoutes } from '@onekeyhq/shared/src/routes/yourModule';

const YourModuleManagePosition = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/YourModule/pages/YourModuleManagePosition'),
);

const YourModuleDetails = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/YourModule/pages/YourModuleDetails'),
);

export const ModalYourModuleRouter: IModalFlowNavigatorConfig<
  EModalYourModuleRoutes,
  IModalYourModuleParamList
>[] = [
  {
    name: EModalYourModuleRoutes.YourModuleManagePosition,
    component: YourModuleManagePosition,
  },
  {
    name: EModalYourModuleRoutes.YourModuleDetails,
    component: YourModuleDetails,
  },
];
```

#### 1.4 Register in Modal Router

Location: `packages/kit/src/routes/Modal/router.tsx`

```typescript
import { ModalYourModuleRouter } from '../../views/YourModule/router';

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  // ... existing routes
  {
    name: EModalRoutes.YourModuleModal,
    children: ModalYourModuleRouter,
  },
];
```

---

### Step 2: Create Provider

Choose between Context (page-scoped) or Jotai (global/persistent).

#### Option A: React Context (Recommended for page-scoped data)

```typescript
// YourModuleProvider.tsx
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Define IAsyncData type
export type IAsyncData<T> = {
  data: T;
  loading: boolean;
  refresh: () => Promise<void>;
};

const defaultAsyncData = <T,>(data: T): IAsyncData<T> => ({
  data,
  loading: false,
  refresh: () => Promise.resolve(),
});

// Define context value type
type IYourModuleContextValue = {
  // Sync data
  config: IYourModuleConfig | null;
  setConfig: React.Dispatch<React.SetStateAction<IYourModuleConfig | null>>;

  // Async data
  positions: IAsyncData<IYourModulePosition[] | null>;
  setPositions: React.Dispatch<React.SetStateAction<IAsyncData<IYourModulePosition[] | null>>>;

  // Status
  dataStatus: EYourModuleDataStatus;
  setDataStatus: React.Dispatch<React.SetStateAction<EYourModuleDataStatus>>;

  // Pending transactions
  pendingTxs: IPendingTx[];
  setPendingTxs: (txs: IPendingTx[]) => void;

  // Refresh ref
  refreshDataRef: React.MutableRefObject<(() => Promise<void>) | null>;
};

const YourModuleContext = createContext<IYourModuleContextValue | null>(null);

export const YourModuleProvider = ({ children }: PropsWithChildren) => {
  const [config, setConfig] = useState<IYourModuleConfig | null>(null);
  const [positions, setPositions] = useState<IAsyncData<IYourModulePosition[] | null>>(
    defaultAsyncData(null)
  );
  const [dataStatus, setDataStatus] = useState<EYourModuleDataStatus>(
    EYourModuleDataStatus.Idle
  );
  const [pendingTxs, setPendingTxsState] = useState<IPendingTx[]>([]);

  const refreshDataRef = useRef<(() => Promise<void>) | null>(null);

  const setPendingTxs = useCallback((txs: IPendingTx[]) => {
    setPendingTxsState(txs);
  }, []);

  const contextValue = useMemo(
    () => ({
      config,
      setConfig,
      positions,
      setPositions,
      dataStatus,
      setDataStatus,
      pendingTxs,
      setPendingTxs,
      refreshDataRef,
    }),
    [config, positions, dataStatus, pendingTxs, setPendingTxs]
  );

  return (
    <YourModuleContext.Provider value={contextValue}>
      {children}
    </YourModuleContext.Provider>
  );
};

export const useYourModuleContext = () => {
  const context = useContext(YourModuleContext);
  if (!context) {
    throw new OneKeyLocalError(
      'useYourModuleContext must be used within a YourModuleProvider'
    );
  }
  return context;
};
```

#### Option B: Jotai (For global/persistent data)

```typescript
// In packages/kit/src/states/jotai/contexts/yourModule/atoms.ts
import { atom } from 'jotai';

export const yourModuleAtom = atom<{
  [accountKey: string]: IYourModuleAccountData;
}>({});

export const yourModulePositionsAtom = atom<{
  [accountKey: string]: IYourModulePosition[];
}>({});
```

---

### Step 3: Implement DataGate

```typescript
// YourModuleDataGate.tsx
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useYourModuleContext } from '../YourModuleProvider';
import { useYourModuleData } from '../hooks/useYourModuleData';

const POLLING_INTERVAL = 60 * 1000; // 1 minute
const STALE_TTL = POLLING_INTERVAL;

export const YourModuleDataGate = ({
  children,
  isActive = true,
}: {
  children: ReactNode;
  isActive?: boolean;
}) => {
  const isFocused = useIsFocused();
  const isViewActive = isFocused && isActive;

  const { setConfig, setPositions, setDataStatus } = useYourModuleContext();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Refs for caching
  const lastFetchKeyRef = useRef<string | null>(null);
  const lastUpdatedAtRef = useRef<number | null>(null);
  const cachedResultRef = useRef<IYourModulePosition[] | undefined>(undefined);
  const forceRefreshCounterRef = useRef(0);

  const accountId = activeAccount.account?.id;
  const fetchKey = accountId ? `yourmodule-${accountId}` : null;

  // Fetch data with caching
  const { result, isLoading, run: refreshData } = usePromiseResult(
    async () => {
      if (!fetchKey || !isViewActive) {
        return cachedResultRef.current;
      }

      const lastUpdatedAt = lastUpdatedAtRef.current;
      const isStale = !lastUpdatedAt || Date.now() - lastUpdatedAt > STALE_TTL;
      const shouldForceRefresh =
        forceRefreshCounterRef.current > lastForceRefreshCounterRef.current;
      const hasNoCache = cachedResultRef.current === undefined;

      if (!isStale && !shouldForceRefresh && !hasNoCache) {
        return cachedResultRef.current;
      }

      // Fetch fresh data
      const data = await fetchYourModuleData({ accountId });
      cachedResultRef.current = data;
      lastUpdatedAtRef.current = Date.now();
      return data;
    },
    [fetchKey, isViewActive, accountId],
    {
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

  // Sync to Context
  useEffect(() => {
    setPositions({
      data: result ?? null,
      loading: isLoading,
      refresh: refreshWithForce,
    });
  }, [result, isLoading, refreshWithForce, setPositions]);

  return <>{children}</>;
};
```

---

### Step 4: Implement Home Page

```typescript
// YourModuleHome.tsx
import { memo } from 'react';

import { ScrollView, YStack } from '@onekeyhq/components';

import { YourModuleProvider, useYourModuleContext } from '../YourModuleProvider';
import { YourModuleDataGate } from '../components/YourModuleDataGate';
import { Overview } from '../components/Overview';
import { PositionsList } from '../components/PositionsList';

const YourModuleHomeContent = memo(({ isActive = true }) => {
  const { positions, pendingTxs } = useYourModuleContext();

  return (
    <ScrollView flex={1}>
      <YStack flex={1} px="$5" pb="$10">
        <Overview />
        <PositionsList />
      </YStack>
    </ScrollView>
  );
});

const YourModulePendingBridge = ({ pendingTxs, onRegisterRefresh }) => {
  const { setPendingTxs, refreshDataRef } = useYourModuleContext();

  useEffect(() => {
    setPendingTxs(pendingTxs ?? []);
  }, [pendingTxs, setPendingTxs]);

  useEffect(() => {
    if (!onRegisterRefresh) return;
    onRegisterRefresh(async () => {
      await refreshDataRef.current?.();
    });
    return () => onRegisterRefresh(null);
  }, [onRegisterRefresh, refreshDataRef]);

  return null;
};

export const YourModuleHome = memo(({
  isActive = true,
  pendingTxs,
  onRegisterRefresh,
}) => {
  return (
    <YourModuleProvider>
      <YourModulePendingBridge
        pendingTxs={pendingTxs}
        onRegisterRefresh={onRegisterRefresh}
      />
      <YourModuleDataGate isActive={isActive}>
        <YourModuleHomeContent isActive={isActive} />
      </YourModuleDataGate>
    </YourModuleProvider>
  );
});
```

---

### Step 5: Implement Operation Components

```typescript
// components/YourOperationA/index.tsx
import { useCallback, useState } from 'react';

import { Button, YStack } from '@onekeyhq/components';

import { StakingAmountInput } from '../../../Staking/components/StakingAmountInput';
import { StakingFormWrapper } from '../../../Staking/components/StakingFormWrapper';

export const YourOperationA = ({
  accountId,
  networkId,
  balance,
  tokenSymbol,
  onConfirm,
}: IYourOperationAProps) => {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm({ amount });
    } finally {
      setIsLoading(false);
    }
  }, [amount, onConfirm]);

  const isValid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balance);

  return (
    <StakingFormWrapper>
      <YStack gap="$4">
        <StakingAmountInput
          value={amount}
          onChange={setAmount}
          balance={balance}
          tokenSymbol={tokenSymbol}
          balanceLabel="Available"
        />

        {/* Add your custom fields here */}

        <Button
          variant="primary"
          size="large"
          disabled={!isValid}
          loading={isLoading}
          onPress={handleConfirm}
        >
          Confirm
        </Button>
      </YStack>
    </StakingFormWrapper>
  );
};
```

---

### Step 6: Implement Detail Page (Optional)

```typescript
// pages/YourModuleDetails/index.tsx
import { Page, YStack } from '@onekeyhq/components';

import { ChartSection } from './components/ChartSection';
import { InfoSection } from './components/InfoSection';

function YourModuleDetails() {
  const route = useRoute();
  const { networkId, symbol, provider } = route.params;

  return (
    <Page>
      <Page.Header title={symbol} />
      <Page.Body>
        <YStack gap="$4" p="$4">
          <ChartSection />
          <InfoSection />
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default YourModuleDetails;
```

---

### Step 7: Configure Tab Integration

If integrating into Earn Tab (like Borrow):

```typescript
// In EarnHome.tsx
import { YourModuleHome } from '../YourModule/pages/YourModuleHome';

// Add mode switching
const [mode, setMode] = useState<'earn' | 'borrow' | 'yourmodule'>('earn');

// Render based on mode
{mode === 'yourmodule' && (
  <YourModuleHome
    isActive={isActive && mode === 'yourmodule'}
    pendingTxs={yourModulePendingTxs}
    onRegisterRefresh={setYourModuleRefresh}
  />
)}
```

If creating independent Tab:

```typescript
// In packages/kit/src/routes/Tab/router.ts
{
  name: ETabRoutes.YourModule,
  tabBarIcon: (focused?: boolean) =>
    focused ? 'YourIconSolid' : 'YourIconOutline',
  translationId: ETranslations.your_module_tab,
  rewrite: '/yourmodule',
  exact: true,
  children: yourModuleRouters,
}
```

---

## Comparison: Earn vs Borrow vs New Module

| Aspect | Earn | Borrow | New Module |
|--------|------|--------|------------|
| State Management | Jotai (global) | Context (page-scoped) | Choose based on needs |
| Operations | 2-3 (Stake/Unstake/Claim) | 4 (Supply/Withdraw/Borrow/Repay) | Custom |
| Key Metric | APY | Health Factor | Custom |
| Tab Integration | Own Tab | Inside Earn Tab | Choose |
| Pending Tracking | Via Jotai | Via Context + Bridge | Via Context + Bridge |

---

## Best Practices

### 1. Reuse Existing Components

```typescript
// Reuse from Staking module
import { StakingAmountInput } from '../Staking/components/StakingAmountInput';
import { StakingFormWrapper } from '../Staking/components/StakingFormWrapper';
import { EarnText } from '../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../Staking/components/ProtocolDetails/EarnTooltip';
import { PendingIndicator } from '../Staking/components/StakingActivityIndicator';
```

### 2. Follow IAsyncData Pattern

```typescript
// Always use IAsyncData for async data
const [data, setData] = useState<IAsyncData<T>>(defaultAsyncData(null));

// Update with all three fields
setData({
  data: result,
  loading: isLoading,
  refresh: refreshFunction,
});
```

### 3. Implement Proper Cleanup

```typescript
useEffect(() => {
  return () => {
    // Cleanup on unmount
    if (refreshDataRef.current === myRefreshFunction) {
      refreshDataRef.current = null;
    }
  };
}, []);
```

### 4. Handle Account Changes

```typescript
useEffect(() => {
  if (prevAccountId !== accountId) {
    // Clear cache
    cachedResultRef.current = undefined;
    lastUpdatedAtRef.current = null;
    // Trigger refresh
    refreshData();
  }
}, [accountId]);
```

### 5. Responsive Design

```typescript
const { gtMd } = useMedia();

if (gtMd) {
  // Desktop: side-by-side layout
  return <XStack>...</XStack>;
} else {
  // Mobile: stacked layout
  return <YStack>...</YStack>;
}
```
