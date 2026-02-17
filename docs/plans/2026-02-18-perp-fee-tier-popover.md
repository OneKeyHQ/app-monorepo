# Perp Fee Tier Popover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Fee Tier" popover to the perp trading panel that shows the user's current fee breakdown and a competitive wallet comparison.

**Architecture:** A new `PerpFeeTierPopover` component placed in `PerpTradingPanel.tsx` below the trading buttons. Uses the existing `Popover` component (click-triggered on both desktop and mobile). Demo phase uses hardcoded fee data; wallet comparison data is static constants.

**Tech Stack:** React, TypeScript, Tamagui (XStack/YStack/SizableText), OneKey Popover component, Image component for wallet icons.

---

### Task 1: Add wallet icon assets

**Files:**
- Create: `packages/kit/assets/perps/wallets/onekey.png`
- Create: `packages/kit/assets/perps/wallets/phantom.png`
- Create: `packages/kit/assets/perps/wallets/metamask.png`
- Create: `packages/kit/assets/perps/wallets/infinex.png`
- Create: `packages/kit/assets/perps/wallets/dreamcash.png`
- Create: `packages/kit/assets/perps/wallets/liquid.png`
- Create: `packages/kit/assets/perps/wallets/rainbow.png`

**Step 1: Create wallet icons directory and add placeholder icons**

Create the directory `packages/kit/assets/perps/wallets/` and add 24x24 PNG wallet icons. For the demo, download or use existing brand assets from the codebase. Each icon should be a small square logo.

> Note: Exact icon sourcing will be done manually. The component code should reference these paths.

**Step 2: Commit**

```bash
git add packages/kit/assets/perps/wallets/
git commit -m "feat: add wallet icon assets for perp fee tier comparison"
```

---

### Task 2: Create fee tier constants and types

**Files:**
- Create: `packages/kit/src/views/Perp/components/TradingPanel/components/feeTierData.ts`

**Step 1: Create the constants file**

```typescript
// Hyperliquid fee tiers based on 14-day rolling volume
export const HYPERLIQUID_FEE_TIERS = [
  { tier: 0, minVolume: 0, taker: 0.00045, maker: 0.00015, label: '$0' },
  { tier: 1, minVolume: 5_000_000, taker: 0.0004, maker: 0.00012, label: '>$5M' },
  { tier: 2, minVolume: 25_000_000, taker: 0.00035, maker: 0.00008, label: '>$25M' },
  { tier: 3, minVolume: 100_000_000, taker: 0.0003, maker: 0.00004, label: '>$100M' },
  { tier: 4, minVolume: 500_000_000, taker: 0.00028, maker: 0, label: '>$500M' },
  { tier: 5, minVolume: 2_000_000_000, taker: 0.00026, maker: 0, label: '>$2B' },
  { tier: 6, minVolume: 7_000_000_000, taker: 0.00024, maker: 0, label: '>$7B' },
] as const;

// HYPE staking tiers
export const HYPE_STAKING_TIERS = [
  { tier: 'None', minStaked: 0, discount: 0 },
  { tier: 'Wood', minStaked: 10, discount: 0.05 },
  { tier: 'Bronze', minStaked: 100, discount: 0.1 },
  { tier: 'Silver', minStaked: 1_000, discount: 0.15 },
  { tier: 'Gold', minStaked: 10_000, discount: 0.2 },
  { tier: 'Platinum', minStaked: 100_000, discount: 0.3 },
  { tier: 'Diamond', minStaked: 500_000, discount: 0.4 },
] as const;

// Competitor wallet builder fees (sorted ascending)
export const WALLET_BUILDER_FEES = [
  { name: 'OneKey', builderFee: 0, icon: require('@onekeyhq/kit/assets/perps/wallets/onekey.png') },
  { name: 'Dreamcash', builderFee: 0.00045, icon: require('@onekeyhq/kit/assets/perps/wallets/dreamcash.png') },
  { name: 'Phantom', builderFee: 0.0005, icon: require('@onekeyhq/kit/assets/perps/wallets/phantom.png') },
  { name: 'Infinex', builderFee: 0.0005, icon: require('@onekeyhq/kit/assets/perps/wallets/infinex.png') },
  { name: 'Liquid', builderFee: 0.0005, icon: require('@onekeyhq/kit/assets/perps/wallets/liquid.png') },
  { name: 'Rainbow', builderFee: 0.0005, icon: require('@onekeyhq/kit/assets/perps/wallets/rainbow.png') },
  { name: 'MetaMask', builderFee: 0.001, icon: require('@onekeyhq/kit/assets/perps/wallets/metamask.png') },
] as const;

// Demo user data (hardcoded for now, will be replaced by API data)
export const DEMO_USER_FEE_DATA = {
  feeTier: 3,           // Fee Tier 3
  stakingTier: 'Gold',  // Gold staking tier
  builderFee: 0,        // OneKey builder fee
  volume14d: 100_000_000,
  hypeStaked: 10_000,
} as const;

export function formatFeePercent(fee: number): string {
  return `${(fee * 100).toFixed(3)}%`;
}
```

**Step 2: Commit**

```bash
git add packages/kit/src/views/Perp/components/TradingPanel/components/feeTierData.ts
git commit -m "feat: add fee tier constants and types for perp fee popover"
```

---

### Task 3: Create PerpFeeTierPopover component

**Files:**
- Create: `packages/kit/src/views/Perp/components/TradingPanel/components/PerpFeeTierPopover.tsx`

**Step 1: Create the popover component**

This component renders:
1. A trigger button: `"% Fee Tier"` text with percent icon
2. Popover content with two sections:
   - Section 1: User's current fee breakdown (Builder Fee, HL Taker, HL Maker, Total Taker, Total Maker) + tier tags
   - Section 2: Wallet comparison table (icon + name + builder fee + total taker + total maker)

Key implementation details:
- Use `Popover` from `@onekeyhq/components` (handles mobile sheet automatically)
- Use `Image` from `@onekeyhq/components` for wallet icons (24x24)
- Use `SizableText`, `XStack`, `YStack` for layout
- Use `Badge` for tier tags (Fee Tier 3, Gold)
- OneKey row in comparison table gets `bg="$bgSuccessSubdued"` highlight
- Footer text emphasizing lowest fees
- Import hardcoded data from `feeTierData.ts`
- Compute total fees: `totalTaker = builderFee + hlTaker`, `totalMaker = builderFee + hlMaker`

```typescript
import { memo, useMemo } from 'react';

import {
  Badge,
  Icon,
  Image,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  DEMO_USER_FEE_DATA,
  HYPERLIQUID_FEE_TIERS,
  HYPE_STAKING_TIERS,
  WALLET_BUILDER_FEES,
  formatFeePercent,
} from './feeTierData';

function FeeRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <XStack justifyContent="space-between" py="$1">
      <SizableText
        size={bold ? '$bodyMdMedium' : '$bodySm'}
        color="$textSubdued"
      >
        {label}
      </SizableText>
      <SizableText
        size={bold ? '$bodyMdMedium' : '$bodySm'}
        color={bold ? '$text' : '$textSubdued'}
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function WalletRow({
  name,
  icon,
  builderFee,
  totalTaker,
  totalMaker,
  isHighlighted,
}: {
  name: string;
  icon: any;
  builderFee: string;
  totalTaker: string;
  totalMaker: string;
  isHighlighted?: boolean;
}) {
  return (
    <XStack
      py="$1.5"
      px="$2"
      borderRadius="$2"
      alignItems="center"
      {...(isHighlighted && { bg: '$bgSuccessSubdued' })}
    >
      <XStack flex={1} alignItems="center" gap="$2">
        <Image w={20} h={20} borderRadius="$full">
          <Image.Source source={icon} />
          <Image.Fallback bg="$bgStrong" />
        </Image>
        <SizableText size="$bodySm" color="$text">
          {name}
        </SizableText>
      </XStack>
      <SizableText size="$bodySm" color="$textSubdued" w={70} textAlign="right">
        {builderFee}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued" w={70} textAlign="right">
        {totalTaker}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued" w={70} textAlign="right">
        {totalMaker}
      </SizableText>
    </XStack>
  );
}

function PerpFeeTierPopover() {
  const userFee = DEMO_USER_FEE_DATA;

  const currentTier = useMemo(
    () =>
      HYPERLIQUID_FEE_TIERS.find((t) => t.tier === userFee.feeTier) ??
      HYPERLIQUID_FEE_TIERS[0],
    [userFee.feeTier],
  );

  const stakingTier = useMemo(
    () =>
      HYPE_STAKING_TIERS.find((t) => t.tier === userFee.stakingTier) ??
      HYPE_STAKING_TIERS[0],
    [userFee.stakingTier],
  );

  // Apply staking discount to HL fees
  const hlTaker = currentTier.taker * (1 - stakingTier.discount);
  const hlMaker = currentTier.maker * (1 - stakingTier.discount);
  const totalTaker = userFee.builderFee + hlTaker;
  const totalMaker = userFee.builderFee + hlMaker;

  return (
    <Popover
      title="Fee Tier"
      renderTrigger={
        <XStack alignItems="center" gap="$1.5" cursor="default" py="$1">
          <Icon name="PercentageSquareOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodySm" color="$textSubdued">
            Fee Tier
          </SizableText>
        </XStack>
      }
      floatingPanelProps={{ w: '$112' }}
      renderContent={
        <YStack px="$5" pb="$5" pt="$2" gap="$4">
          {/* Section 1: Your Fees */}
          <YStack gap="$1">
            <SizableText size="$bodyMdMedium" color="$text" pb="$1">
              Your Fees
            </SizableText>
            <FeeRow
              label="Builder Fee (OneKey)"
              value={formatFeePercent(userFee.builderFee)}
            />
            <FeeRow
              label="Hyperliquid Fee (Taker)"
              value={formatFeePercent(hlTaker)}
            />
            <FeeRow
              label="Hyperliquid Fee (Maker)"
              value={formatFeePercent(hlMaker)}
            />
            <YStack
              borderTopWidth="$px"
              borderTopColor="$borderSubdued"
              mt="$1"
              pt="$1"
            >
              <FeeRow
                label="Total Taker Fee"
                value={formatFeePercent(totalTaker)}
                bold
              />
              <FeeRow
                label="Total Maker Fee"
                value={formatFeePercent(totalMaker)}
                bold
              />
            </YStack>
            <XStack gap="$2" pt="$1" flexWrap="wrap">
              <Badge badgeType="info" badgeSize="sm">
                <Badge.Text>{`Fee Tier ${currentTier.tier} (${currentTier.label})`}</Badge.Text>
              </Badge>
              <Badge badgeType="success" badgeSize="sm">
                <Badge.Text>{`${stakingTier.tier} Staking (${(stakingTier.discount * 100).toFixed(0)}% off)`}</Badge.Text>
              </Badge>
            </XStack>
          </YStack>

          {/* Section 2: Wallet Comparison */}
          <YStack gap="$1">
            <SizableText size="$bodyMdMedium" color="$text" pb="$1">
              Wallet Fee Comparison
            </SizableText>
            {/* Table Header */}
            <XStack px="$2" pb="$1">
              <SizableText
                size="$bodyXs"
                color="$textDisabled"
                flex={1}
              >
                Wallet
              </SizableText>
              <SizableText
                size="$bodyXs"
                color="$textDisabled"
                w={70}
                textAlign="right"
              >
                Builder
              </SizableText>
              <SizableText
                size="$bodyXs"
                color="$textDisabled"
                w={70}
                textAlign="right"
              >
                Taker
              </SizableText>
              <SizableText
                size="$bodyXs"
                color="$textDisabled"
                w={70}
                textAlign="right"
              >
                Maker
              </SizableText>
            </XStack>
            {/* Table Rows */}
            {WALLET_BUILDER_FEES.map((wallet) => (
              <WalletRow
                key={wallet.name}
                name={wallet.name}
                icon={wallet.icon}
                builderFee={formatFeePercent(wallet.builderFee)}
                totalTaker={formatFeePercent(wallet.builderFee + hlTaker)}
                totalMaker={formatFeePercent(wallet.builderFee + hlMaker)}
                isHighlighted={wallet.name === 'OneKey'}
              />
            ))}
            <SizableText
              size="$bodyXs"
              color="$textSuccess"
              pt="$2"
              textAlign="center"
            >
              OneKey 0 Builder Fee — lowest fees across all wallets
            </SizableText>
          </YStack>
        </YStack>
      }
    />
  );
}

const PerpFeeTierPopoverMemo = memo(PerpFeeTierPopover);
export { PerpFeeTierPopoverMemo as PerpFeeTierPopover };
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit packages/kit/src/views/Perp/components/TradingPanel/components/PerpFeeTierPopover.tsx`

**Step 3: Commit**

```bash
git add packages/kit/src/views/Perp/components/TradingPanel/components/PerpFeeTierPopover.tsx
git commit -m "feat: create PerpFeeTierPopover component with fee breakdown and wallet comparison"
```

---

### Task 4: Integrate PerpFeeTierPopover into PerpTradingPanel

**Files:**
- Modify: `packages/kit/src/views/Perp/components/TradingPanel/PerpTradingPanel.tsx:117-139`

**Step 1: Add import and render the popover**

Add import at top of file:
```typescript
import { PerpFeeTierPopover } from './components/PerpFeeTierPopover';
```

Modify the `content` variable (around line 117) to add `PerpFeeTierPopover` after the trading button section:

```typescript
const content = (
    <YStack
      gap="$2"
      pl={isMobile ? undefined : '$3'}
      pr={isMobile ? undefined : '$5'}
      flex={isMobile ? 1 : undefined}
      justifyContent={isMobile ? 'space-between' : undefined}
    >
      <PerpTradingForm isSubmitting={isSubmitting} isMobile={isMobile} />
      {perpsAccountStatus.canTrade ? (
        <TradingButtonGroup isMobile={isMobile} />
      ) : (
        <PerpTradingButton
          loading={universalLoading}
          handleShowConfirm={handleShowConfirm}
          formData={formData}
          computedSize={tradingComputed.computedSizeBN}
          isMinimumOrderNotMet={isMinimumOrderNotMet}
          isSubmitting={isSubmitting}
          isNoEnoughMargin={isNoEnoughMargin}
        />
      )}
      <PerpFeeTierPopover />
    </YStack>
  );
```

**Step 2: Verify the web app renders correctly**

Run: `yarn app:web` and navigate to the Perp tab. Verify:
- The "% Fee Tier" text appears below the trading buttons
- Clicking it opens the popover with both sections
- OneKey row is highlighted green in the comparison table
- Popover closes when clicking outside

**Step 3: Commit**

```bash
git add packages/kit/src/views/Perp/components/TradingPanel/PerpTradingPanel.tsx
git commit -m "feat: integrate PerpFeeTierPopover into perp trading panel"
```

---

### Task 5: Visual QA and polish

**Files:**
- Modify: `packages/kit/src/views/Perp/components/TradingPanel/components/PerpFeeTierPopover.tsx` (adjustments as needed)

**Step 1: Test on web and verify layout**

Check these items on the running web app:
- Popover width is adequate for the comparison table (all columns visible)
- Text is readable, no overflow or truncation
- Wallet icons display correctly at 20x20
- Badge tags display correctly for Fee Tier and Staking Tier
- Footer text is visible and correctly colored
- Popover placement adapts (appears above if not enough space below)

**Step 2: Fix any visual issues**

Adjust padding, widths, font sizes as needed based on visual inspection.

**Step 3: Run lint**

Run: `yarn lint:staged`

**Step 4: Run type check**

Run: `yarn tsc:staged`

**Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: polish perp fee tier popover layout and styling"
```
