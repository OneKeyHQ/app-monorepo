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
