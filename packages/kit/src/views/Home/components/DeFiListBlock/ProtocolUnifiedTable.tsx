import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import {
  ProtocolValueCell,
  isProtocolValueUnavailable,
} from '@onekeyhq/kit/src/components/DeFi/ProtocolValueCell';
import type { IProtocolUnifiedRow } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

import { ProtocolAssetBalanceText } from './ProtocolAssetBalanceText';
import { ProtocolPositionCell } from './ProtocolPositionCell';
import { ProtocolRewardsCell } from './ProtocolRewardsCell';

// Position-level USD total = supplied assets + reward assets. The Rewards
// column already itemizes the reward USD separately; the Value column on
// the right is a "what's this position worth as a whole" single number,
// which is why rewards still add into it.
function sumPositionUsd(
  primaryAssets: IDeFiAsset[],
  rewardsExtraAssets: IDeFiAsset[],
): number {
  let total = 0;
  for (const asset of primaryAssets) {
    total += asset.value;
  }
  for (const asset of rewardsExtraAssets) {
    total += asset.value;
  }
  return total;
}

function hasUnavailableAssetValue(...assetGroups: IDeFiAsset[][]): boolean {
  for (const assets of assetGroups) {
    for (const asset of assets) {
      if (isProtocolValueUnavailable(asset.value)) {
        return true;
      }
    }
  }
  return false;
}

// Returns the most valuable up to `max` assets in USD-descending order.
// Used for the Balance column when a position has more rows than we want
// to stack — surfacing the biggest holdings first reads more usefully
// than the upstream insertion order. If `max` already covers the array,
// returns the original (no copy, no sort).
function topAssetsByValue(assets: IDeFiAsset[], max: number): IDeFiAsset[] {
  if (assets.length <= max) return assets;
  return assets.toSorted((a, b) => b.value - a.value).slice(0, max);
}

// Layout: one logical row per position regardless of asset count. Multi-
// asset positions stack their content inside each cell — Position cell
// stacks avatars (overlapped, +N overflow), Balance cell stacks amounts
// and per-asset USD values (top-N by USD, +N more overflow). Pre-change,
// multi-asset positions rendered as N
// separate XStack rows with Position/Rewards/Value attached to the first row
// only, which made it look like N independent positions instead of one.
//
// Position column is a *fixed* width (not %) so every category table in
// a protocol card — Lending, LP, stake, yield — starts its data columns
// at the same x-coordinate. Without the fix, each table picked its own
// percent split and the columns visibly jagged across categories.
// Exported so the sectioned table can align its first column too.
export const POSITION_COLUMN_WIDTH = 240;

// Flex weights for the trailing columns. Balance leads (amounts can be
// long, especially when stacked); Value gets less because it's a single
// right-aligned number; Rewards sits between when present.
// `*_WITHOUT_REWARDS` are exported because the sectioned table never has
// a rewards column and lands on the same proportions as the unified
// no-rewards layout.
const BALANCE_FLEX_WITH_REWARDS = 1.2;
const REWARDS_FLEX = 1;
const USD_FLEX_WITH_REWARDS = 0.8;
export const BALANCE_FLEX_WITHOUT_REWARDS = 1.5;
export const USD_FLEX_WITHOUT_REWARDS = 1;

// Cap the visible amount lines in the Balance column. Above this we show
// the top-by-USD rows + a "+N more" chip, so an 8-token yield position
// settles at four lines of content instead of eight.
const MAX_BALANCE_LINES = 3;

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IProtocolUnifiedTableProps = {
  rows: IProtocolUnifiedRow[];
  currencySymbol: string;
  priceUnavailableLabel: string;
};

const ProtocolUnifiedTable = memo(
  ({
    rows,
    currencySymbol,
    priceUnavailableLabel,
  }: IProtocolUnifiedTableProps) => {
    const intl = useIntl();

    const showRewardsColumn = useMemo(
      () => rows.some((row) => row.rewardsExtraAssets.length > 0),
      [rows],
    );

    const labels = useMemo(
      () => ({
        position: intl.formatMessage({ id: ETranslations.earn_positions }),
        balance: intl.formatMessage({ id: ETranslations.global_balance }),
        rewards: intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_rewards,
        }),
        value: intl.formatMessage({ id: ETranslations.global_value }),
        showLess: intl.formatMessage({ id: ETranslations.global_show_less }),
      }),
      [intl],
    );

    // Per-row expansion state for the Balance column overflow chip.
    // Local to the table — expansion is purely a view concern, no need
    // to lift to a global atom or persist across remounts.
    const [expandedRows, setExpandedRows] = useState<Set<string>>(
      () => new Set(),
    );
    const toggleExpanded = useCallback((rowKey: string) => {
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowKey)) {
          next.delete(rowKey);
        } else {
          next.add(rowKey);
        }
        return next;
      });
    }, []);

    const balanceFlex = showRewardsColumn
      ? BALANCE_FLEX_WITH_REWARDS
      : BALANCE_FLEX_WITHOUT_REWARDS;
    const usdFlex = showRewardsColumn
      ? USD_FLEX_WITH_REWARDS
      : USD_FLEX_WITHOUT_REWARDS;

    return (
      <YStack>
        <XStack mx="$5" px="$2" py="$2" alignItems="center" bg="$bgSubdued">
          <Stack width={POSITION_COLUMN_WIDTH} flexShrink={0} minWidth={0}>
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.position}
            </SizableText>
          </Stack>
          <Stack flex={balanceFlex} flexBasis={0} minWidth={0}>
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.balance}
            </SizableText>
          </Stack>
          {showRewardsColumn ? (
            <Stack flex={REWARDS_FLEX} flexBasis={0} minWidth={0}>
              <SizableText size="$headingXs" color="$textSubdued">
                {labels.rewards}
              </SizableText>
            </Stack>
          ) : null}
          <Stack
            flex={usdFlex}
            flexBasis={0}
            minWidth={0}
            alignItems="flex-end"
          >
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.value}
            </SizableText>
          </Stack>
        </XStack>

        {rows.map((row, rowIndex) => {
          const positionUsd = sumPositionUsd(
            row.primaryAssets,
            row.rewardsExtraAssets,
          );
          const isPositionUsdUnavailable = hasUnavailableAssetValue(
            row.primaryAssets,
            row.rewardsExtraAssets,
          );
          const isExpanded = expandedRows.has(row.rowKey);
          const visibleBalanceAssets = isExpanded
            ? row.primaryAssets
            : topAssetsByValue(row.primaryAssets, MAX_BALANCE_LINES);
          const balanceOverflow = Math.max(
            0,
            row.primaryAssets.length - MAX_BALANCE_LINES,
          );
          const positionAvatars = row.primaryAssets.map((asset) => ({
            logoUrl: asset.meta?.logoUrl,
          }));

          return (
            <XStack
              key={row.rowKey}
              mx="$5"
              px="$2"
              py="$3"
              alignItems="flex-start"
              minHeight={44}
              mt={rowIndex === 0 ? '$0' : '$3'}
            >
              <Stack
                width={POSITION_COLUMN_WIDTH}
                flexShrink={0}
                minWidth={0}
                pt="$1"
              >
                <ProtocolPositionCell
                  name={row.positionDisplay.text}
                  assets={positionAvatars}
                />
              </Stack>
              <YStack
                flex={balanceFlex}
                flexBasis={0}
                minWidth={0}
                gap="$1"
                pt="$1"
              >
                {visibleBalanceAssets.map((asset, assetIndex) => (
                  <ProtocolAssetBalanceText
                    key={`${row.rowKey}-balance-${asset.address}-${assetIndex}`}
                    asset={asset}
                    currencySymbol={currencySymbol}
                    priceUnavailableLabel={priceUnavailableLabel}
                  />
                ))}
                {balanceOverflow > 0 ? (
                  // Compact ghost button. Sits flush-left in the Balance
                  // column with a small left padding so the bg-on-hover
                  // pill reads as a distinct affordance rather than the
                  // amount lines above; no negative margin so it never
                  // overlaps the Position column to the left.
                  <XStack
                    alignItems="center"
                    gap="$0.5"
                    alignSelf="flex-start"
                    pl="$1.5"
                    pr="$1"
                    py="$0.5"
                    mt="$0.5"
                    borderRadius="$2"
                    borderCurve="continuous"
                    cursor="pointer"
                    userSelect="none"
                    role="button"
                    aria-expanded={isExpanded}
                    focusable
                    focusVisibleStyle={{
                      outlineColor: '$focusRing',
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineOffset: 1,
                    }}
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={() => toggleExpanded(row.rowKey)}
                  >
                    {/* Collapsed: just `+N` (count + symbol = i18n-safe).
                        Chevron carries the "expand" affordance, so the
                        English literal "more" word isn't needed and we
                        avoid hardcoding text without a translation key.
                        Expanded uses the localized "Show less" — the
                        intent there is action, not count. */}
                    <SizableText size="$bodySm" color="$textSubdued">
                      {isExpanded ? labels.showLess : `+${balanceOverflow}`}
                    </SizableText>
                    <Icon
                      name={
                        isExpanded
                          ? 'ChevronTopSmallSolid'
                          : 'ChevronDownSmallSolid'
                      }
                      size="$4"
                      color="$iconSubdued"
                    />
                  </XStack>
                ) : null}
              </YStack>
              {showRewardsColumn ? (
                <Stack flex={REWARDS_FLEX} flexBasis={0} minWidth={0} pt="$1">
                  {row.rewardsExtraAssets.length > 0 ? (
                    <ProtocolRewardsCell
                      rewards={row.rewardsExtraAssets}
                      currencySymbol={currencySymbol}
                      priceUnavailableLabel={priceUnavailableLabel}
                    />
                  ) : null}
                </Stack>
              ) : null}
              <Stack
                flex={usdFlex}
                flexBasis={0}
                minWidth={0}
                alignItems="flex-end"
                pt="$1"
              >
                <ProtocolValueCell
                  value={positionUsd}
                  currencySymbol={currencySymbol}
                  priceUnavailableLabel={priceUnavailableLabel}
                  isUnavailable={isPositionUsdUnavailable}
                  size="$bodyMdMedium"
                  textAlign="right"
                  numberOfLines={1}
                  fontVariant={TABULAR_NUMS}
                />
              </Stack>
            </XStack>
          );
        })}
      </YStack>
    );
  },
);

ProtocolUnifiedTable.displayName = 'ProtocolUnifiedTable';

export { ProtocolUnifiedTable };
