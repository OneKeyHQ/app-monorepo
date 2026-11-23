import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  Popover,
  SizableText,
  Slider,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  IPool,
  IPoolAsset,
  IPoolRemovePreview,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { POOLS_COPY } from '../poolsCopy';
import { formatTokenAmount, formatUsd, sortByPair } from '../poolsFormat';
import { isCostlySwap } from '../poolsOutcome';

import { PoolsChip } from './PoolsFilterButton';
import { PoolTokenList } from './PoolTokenList';

const PERCENT_CHIPS = [0.25, 0.5, 0.75, 1];

/** How much to remove: the share as a big number, a slider and quick picks */
export function PoolPercentPicker({
  value,
  onChange,
}: {
  /** Fraction, 0 to 1 */
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <YStack gap="$4">
      <SizableText size="$heading4xl">{`${Math.round(value * 100)}%`}</SizableText>
      <Slider
        testID="earn-pool-percent-slider"
        value={Math.round(value * 100)}
        onChange={(next) => onChange(Number(next) / 100)}
        min={0}
        max={100}
        step={1}
      />
      <XStack gap="$2" flexWrap="wrap">
        {PERCENT_CHIPS.map((percent) => (
          <PoolsChip
            key={percent}
            testID={`earn-pool-percent-${percent * 100}`}
            label={percent === 1 ? POOLS_COPY.maxAmount : `${percent * 100}%`}
            raised
            active={Math.round(value * 100) === percent * 100}
            onPress={() => onChange(percent)}
          />
        ))}
      </XStack>
    </YStack>
  );
}

/** Pool tokens first, then the user's largest holdings */
export function sortTargetAssets(
  wallet: IPoolsWallet,
  preferredIds: string[],
): IPoolAsset[] {
  const valueOf = (asset: IPoolAsset) =>
    new BigNumber(wallet.balances[asset.id] ?? 0).times(asset.priceUsd);
  return wallet.assets.toSorted((a, b) => {
    const rankA = preferredIds.includes(a.id) ? 0 : 1;
    const rankB = preferredIds.includes(b.id) ? 0 : 1;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return valueOf(b).comparedTo(valueOf(a)) ?? 0;
  });
}

/** The token a Zap out lands in, picked from the network's tokens */
export function PoolAssetSelect({
  title,
  assets,
  value,
  onChange,
}: {
  title: string;
  assets: IPoolAsset[];
  value: IPoolAsset;
  onChange: (asset: IPoolAsset) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // One component per token set: a new one on every render would remount
  // the open list
  const content = useMemo(
    () =>
      function TargetList({ closePopover }: { closePopover: () => void }) {
        return (
          <PoolTokenList
            testIDPrefix="earn-pool-target"
            assets={assets}
            onSelect={(asset) => {
              onChangeRef.current(asset);
              closePopover();
            }}
          />
        );
      },
    [assets],
  );
  return (
    <Popover
      title={title}
      floatingPanelProps={{ w: '$72' }}
      renderContent={content}
      renderTrigger={
        // eslint-disable-next-line props-checker/validator -- Popover's trigger wrapper handles the press
        <XStack
          role="button"
          testID="earn-pool-target-asset"
          ai="center"
          gap="$3"
          p="$3"
          borderRadius="$3"
          bg="$bgStrong"
          cursor="pointer"
          userSelect="none"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
        >
          <Token size="sm" tokenImageUri={value.logoURI} borderRadius="$full" />
          <SizableText flex={1} size="$bodyLgMedium">
            {value.symbol}
          </SizableText>
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        </XStack>
      }
    />
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <XStack jc="space-between" ai="flex-start" gap="$3">
      {/* The label keeps one line; a long value wraps instead */}
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <YStack ai="flex-end" gap="$0.5" flexShrink={1}>
        {children}
      </YStack>
    </XStack>
  );
}

/**
 * What lands in the wallet: both tokens, or one token after the swaps
 * (doc §3.7). Fees come along with any removal from a range position.
 */
export function PoolRemoveSummary({
  preview,
  assets,
  includesFees,
  pool,
}: {
  preview: IPoolRemovePreview;
  assets: IPoolAsset[];
  includesFees: boolean;
  /** Lists both tokens the way the pair reads */
  pool?: IPool;
}) {
  const { zapOut } = preview;
  if (zapOut) {
    const target = assets.find((asset) => asset.id === zapOut.targetAssetId);
    const receivedUsd = target
      ? new BigNumber(zapOut.expectedOut).times(target.priceUsd)
      : new BigNumber(0);
    return (
      <YStack gap="$3">
        <SummaryRow label={POOLS_COPY.youReceive}>
          <SizableText size="$headingMd" textAlign="right">
            {formatTokenAmount(zapOut.expectedOut, target?.symbol)}
          </SizableText>
          {target ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {formatUsd(receivedUsd)}
            </SizableText>
          ) : null}
        </SummaryRow>
        {/* The swaps show as the review's steps; a costly one gets a row */}
        {isCostlySwap(zapOut.costUsd, receivedUsd) ? (
          <SummaryRow label={POOLS_COPY.swapCost}>
            <SizableText
              testID="earn-pool-remove-swap-cost"
              size="$bodyMdMedium"
              color="$textCaution"
            >
              {formatUsd(zapOut.costUsd)}
            </SizableText>
          </SummaryRow>
        ) : null}
        {includesFees ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {POOLS_COPY.includesFees}
          </SizableText>
        ) : null}
      </YStack>
    );
  }
  const received = sortByPair(
    pool,
    preview.received.filter((item) => new BigNumber(item.amount).gt(0)),
    (item) => item.assetId,
  );
  return (
    <YStack gap="$3">
      <SummaryRow label={POOLS_COPY.youReceive}>
        {received.map((item) => (
          <SizableText
            key={item.assetId}
            size="$bodyMdMedium"
            textAlign="right"
          >
            {formatTokenAmount(item.amount, item.symbol)}
          </SizableText>
        ))}
      </SummaryRow>
      <SummaryRow label={POOLS_COPY.value}>
        <SizableText size="$bodyMdMedium">
          {formatUsd(preview.receivedUsd)}
        </SizableText>
      </SummaryRow>
      {includesFees ? (
        <SizableText size="$bodySm" color="$textSubdued">
          {POOLS_COPY.includesFees}
        </SizableText>
      ) : null}
    </YStack>
  );
}
