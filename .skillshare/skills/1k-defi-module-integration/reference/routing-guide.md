# Routing Guide for DeFi Modules

This guide covers routing configuration for DeFi modules, including Modal routes, Tab routes, and navigation utilities.

## Route Types Overview

| Route Type | Use Case | Location |
|------------|----------|----------|
| **Modal Routes** | Operation modals, detail pages (mobile) | `packages/kit/src/routes/Modal/router.tsx` |
| **Tab Routes** | Main pages, detail pages (desktop) | `packages/kit/src/routes/Tab/` |
| **Share Routes** | Deep links for sharing | Both Modal and Tab with `exact: true` |

---

## Existing DeFi Routes

### Modal Routes (EModalStakingRoutes)

Location: `packages/shared/src/routes/staking.ts`

```typescript
enum EModalStakingRoutes {
  // Earn/Staking
  InvestmentDetails = 'InvestmentDetails',
  Stake = 'Stake',
  Withdraw = 'Withdraw',
  ManagePosition = 'ManagePosition',
  Claim = 'Claim',
  ProtocolDetails = 'ProtocolDetails',
  ProtocolDetailsV2 = 'ProtocolDetailsV2',
  ProtocolDetailsV2Share = 'ProtocolDetailsV2Share',
  AssetProtocolList = 'AssetProtocolList',
  ClaimOptions = 'ClaimOptions',
  WithdrawOptions = 'WithdrawOptions',
  PortfolioDetails = 'PortfolioDetails',
  HistoryList = 'HistoryList',

  // Borrow
  BorrowManagePosition = 'BorrowManagePosition',
  BorrowTokenSelect = 'BorrowTokenSelect',
  BorrowReserveDetails = 'BorrowReserveDetails',
  BorrowHistoryList = 'BorrowHistoryList',
}
```

### Tab Routes (ETabEarnRoutes)

Location: `packages/shared/src/routes/tabEarn.ts`

```typescript
enum ETabEarnRoutes {
  EarnHome = 'EarnHome',
  EarnProtocols = 'EarnProtocols',
  EarnProtocolDetails = 'EarnProtocolDetails',
  EarnProtocolDetailsShare = 'EarnProtocolDetailsShare',
  BorrowReserveDetails = 'BorrowReserveDetails',
  BorrowReserveDetailsShare = 'BorrowReserveDetailsShare',
}
```

---

## Adding New Routes

### Step 1: Define Route Enum

Create or update route enum file in `packages/shared/src/routes/`.

**For new routes in existing module:**
```typescript
// packages/shared/src/routes/staking.ts
export enum EModalStakingRoutes {
  // ... existing routes
  YourNewRoute = 'YourNewRoute',
}
```

**For entirely new module:**
```typescript
// packages/shared/src/routes/yourModule.ts
export enum EModalYourModuleRoutes {
  YourModuleManagePosition = 'YourModuleManagePosition',
  YourModuleDetails = 'YourModuleDetails',
  YourModuleHistory = 'YourModuleHistory',
}
```

### Step 2: Define Param Types

```typescript
// packages/shared/src/routes/staking.ts (or yourModule.ts)
export type IModalStakingParamList = {
  // ... existing params

  [EModalStakingRoutes.YourNewRoute]: {
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
    // Add other required params
  };
};
```

**Common Param Patterns:**

```typescript
// Base params (most routes need these)
type IBaseRouteParams = {
  networkId: string;
  accountId: string;
  indexedAccountId?: string;
};

// Detail page params
type IDetailParams = IBaseRouteParams & {
  symbol: string;
  provider: string;
  vault?: string;
};

// Borrow-specific params
type IBorrowParams = IBaseRouteParams & {
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
};

// Share link params (no account info)
type IShareParams = {
  network: string;  // network name, not networkId
  symbol: string;
  provider: string;
};
```

### Step 3: Add to Modal Routes Enum (if new module)

```typescript
// packages/shared/src/routes/modal.ts
export enum EModalRoutes {
  // ... existing routes
  YourModuleModal = 'YourModuleModal',
}

export type IModalParamList = {
  // ... existing types
  [EModalRoutes.YourModuleModal]: IModalYourModuleParamList;
};
```

### Step 4: Create Router Configuration

**For existing Staking modal:**
```typescript
// packages/kit/src/views/Staking/router/index.tsx
import { LazyLoad } from '@onekeyhq/shared/src/lazyLoad';

const YourNewPage = LazyLoad(
  () => import('@onekeyhq/kit/src/views/YourModule/pages/YourNewPage'),
);

export const StakingModalRouter = [
  // ... existing routes
  {
    name: EModalStakingRoutes.YourNewRoute,
    component: YourNewPage,
  },
];
```

**For new module:**
```typescript
// packages/kit/src/views/YourModule/router/index.tsx
import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { EModalYourModuleRoutes } from '@onekeyhq/shared/src/routes/yourModule';
import type { IModalYourModuleParamList } from '@onekeyhq/shared/src/routes/yourModule';

const YourModuleManagePosition = LazyLoad(
  () => import('@onekeyhq/kit/src/views/YourModule/pages/YourModuleManagePosition'),
);

const YourModuleDetails = LazyLoad(
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

### Step 5: Register in Modal Router

```typescript
// packages/kit/src/routes/Modal/router.tsx
import { ModalYourModuleRouter } from '../../views/YourModule/router';

const router: IModalRootNavigatorConfig<EModalRoutes>[] = [
  // ... existing routes
  {
    name: EModalRoutes.YourModuleModal,
    children: ModalYourModuleRouter,
  },
];
```

### Step 6: Add Tab Routes (for desktop detail pages)

```typescript
// packages/shared/src/routes/tabEarn.ts (or create new tabYourModule.ts)
export enum ETabEarnRoutes {
  // ... existing routes
  YourModuleDetails = 'YourModuleDetails',
  YourModuleDetailsShare = 'YourModuleDetailsShare',
}

export type ITabEarnParamList = {
  // ... existing params
  [ETabEarnRoutes.YourModuleDetails]: {
    networkId: string;
    symbol: string;
    provider: string;
  };
  [ETabEarnRoutes.YourModuleDetailsShare]: {
    network: string;
    symbol: string;
    provider: string;
  };
};
```

```typescript
// packages/kit/src/routes/Tab/Earn/router.ts
import { LazyLoadRootTabPage } from '../../../components/LazyLoadPage';

const YourModuleDetails = LazyLoadRootTabPage(
  () => import('../../../views/YourModule/pages/YourModuleDetails'),
);

export const earnRouters: ITabSubNavigatorConfig<any, any>[] = [
  // ... existing routes
  {
    name: ETabEarnRoutes.YourModuleDetails,
    component: YourModuleDetails,
    headerShown: !platformEnv.isNative,
  },
  {
    name: ETabEarnRoutes.YourModuleDetailsShare,
    component: YourModuleDetails,
    exact: true,
    rewrite: '/yourmodule/:network/:symbol/:provider',
    headerShown: !platformEnv.isNative,
  },
];
```

---

## Route Configuration Options

### Router Config Properties

```typescript
interface IRouterConfig {
  name: string;           // Route name (from enum)
  component: Component;   // Lazy-loaded component
  exact?: boolean;        // If true, uses only rewrite path (ignores parent paths)
  rewrite?: string;       // Custom URL path
  headerShown?: boolean;  // Show header (usually !platformEnv.isNative)
}
```

### URL Path Configuration

**Default behavior:**
- Path is built from route hierarchy: `/Modal/StakingModal/ManagePosition`

**With `rewrite`:**
- Replaces current segment: `rewrite: '/manage'` → `/Modal/StakingModal/manage`

**With `exact: true`:**
- Ignores parent paths: `rewrite: '/defi/staking/:symbol/:provider'` → `/defi/staking/ETH/lido`

### Share Link Routes

Share routes should:
1. Use `exact: true` to have clean URLs
2. Use `rewrite` with path params
3. NOT include account-specific params
4. Use network name instead of networkId

```typescript
{
  name: EModalStakingRoutes.ProtocolDetailsV2Share,
  component: ProtocolDetailsV2,
  exact: true,
  rewrite: '/defi/:network/:symbol/:provider',
}
```

---

## Navigation Utilities

### Creating Navigation Helper

```typescript
// packages/kit/src/views/YourModule/yourModuleUtils.ts
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { ETabEarnRoutes, ETabRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const YourModuleNavigation = {
  // Push to manage position modal
  pushToManagePosition: (
    navigation: IAppNavigation,
    params: {
      networkId: string;
      symbol: string;
      provider: string;
      // ... other params
    },
  ) => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.YourNewRoute,
      params,
    });
  },

  // Push to detail page (desktop vs mobile)
  pushToDetails: (
    navigation: IAppNavigation,
    params: {
      networkId: string;
      symbol: string;
      provider: string;
    },
  ) => {
    if (platformEnv.isNative) {
      // Mobile: use modal
      navigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.YourModuleDetails,
        params,
      });
    } else {
      // Desktop: use tab route
      navigation.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Earn,
        params: {
          screen: ETabEarnRoutes.YourModuleDetails,
          params,
        },
      });
    }
  },

  // Generate share link
  generateShareLink: (params: {
    networkId: string;
    symbol: string;
    provider: string;
  }) => {
    const networkName = getNetworkName(params.networkId);
    return `${WEB_APP_URL}/yourmodule/${networkName}/${params.symbol}/${params.provider}`;
  },
};
```

### Navigation Methods

```typescript
// Push modal (opens on top of current screen)
navigation.pushModal(EModalRoutes.StakingModal, {
  screen: EModalStakingRoutes.ManagePosition,
  params: { networkId, symbol, provider },
});

// Navigate to tab (replaces current screen in tab)
navigation.navigate(ERootRoutes.Main, {
  screen: ETabRoutes.Earn,
  params: {
    screen: ETabEarnRoutes.EarnProtocolDetails,
    params: { networkId, symbol, provider },
  },
}, {
  pop: true,  // IMPORTANT: Always include pop: true
});

// Switch tab
navigation.switchTab(ETabRoutes.Earn);

// Go back
navigation.goBack();

// Pop to top of stack
navigation.popToTop();
```

---

## Desktop vs Mobile Navigation

### Pattern: Detail Page Navigation

```typescript
const handleNavigateToDetails = useCallback(() => {
  if (platformEnv.isNative) {
    // Mobile: Open as modal
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.BorrowReserveDetails,
      params: {
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        symbol,
        logoURI,
      },
    });
  } else {
    // Desktop: Navigate within tab
    navigation.navigate(ERootRoutes.Main, {
      screen: ETabRoutes.Earn,
      params: {
        screen: ETabEarnRoutes.BorrowReserveDetails,
        params: {
          networkId,
          provider,
          marketAddress,
          reserveAddress,
          symbol,
          logoURI,
        },
      },
    }, {
      pop: true,
    });
  }
}, [navigation, networkId, provider, marketAddress, reserveAddress, symbol, logoURI]);
```

### Pattern: Manage Position Modal

```typescript
const handleOpenManagePosition = useCallback((action: 'supply' | 'withdraw') => {
  navigation.pushModal(EModalRoutes.StakingModal, {
    screen: EModalStakingRoutes.BorrowManagePosition,
    params: {
      networkId,
      accountId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      type: action === 'supply' ? EManagePositionType.Supply : EManagePositionType.Withdraw,
    },
  });
}, [navigation, networkId, accountId, provider, marketAddress, reserveAddress, symbol, logoURI]);
```

---

## Deep Links and Share URLs

### URL Patterns

| Route | URL Pattern | Example |
|-------|-------------|---------|
| Earn Protocol Details | `/earn/:network/:symbol/:provider` | `/earn/ethereum/ETH/lido` |
| Borrow Reserve Details | `/borrow/:networkId/:symbol/:provider` | `/borrow/evm--1/USDC/aave` |
| Staking Details | `/defi/:network/:symbol/:provider` | `/defi/ethereum/ETH/lido` |

### Handling Share Links

Share link routes use the same component but with different params:

```typescript
// Normal route - has accountId
[ETabEarnRoutes.EarnProtocolDetails]: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
};

// Share route - no accountId, uses network name
[ETabEarnRoutes.EarnProtocolDetailsShare]: {
  network: string;  // 'ethereum', not 'evm--1'
  symbol: string;
  provider: string;
  vault?: string;
};
```

In the component, handle both cases:

```typescript
function ProtocolDetails() {
  const route = useRoute();
  const params = route.params;

  // Handle share link (network name) vs normal (networkId)
  const networkId = useMemo(() => {
    if ('networkId' in params) {
      return params.networkId;
    }
    // Convert network name to networkId
    return getNetworkIdFromName(params.network);
  }, [params]);

  // ... rest of component
}
```

---

## Checklist for Adding Routes

- [ ] Define route enum in `packages/shared/src/routes/`
- [ ] Define param types
- [ ] Add to `EModalRoutes` if new module
- [ ] Create router configuration
- [ ] Register in Modal router
- [ ] Add Tab routes for desktop (if needed)
- [ ] Create navigation utility functions
- [ ] Handle desktop vs mobile navigation
- [ ] Add share link route (if needed)
- [ ] Test navigation on all platforms
