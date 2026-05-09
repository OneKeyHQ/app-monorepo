import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  IProtocolUnifiedRow,
  IUnifiedPositionDisplayKind,
} from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeFiAsset } from '@onekeyhq/shared/types/defi';

import { ProtocolPositionCell } from './ProtocolPositionCell';
import { ProtocolRewardsCell } from './ProtocolRewardsCell';

// Position-level USD total = supplied assets + reward assets. The Rewards
// column already itemizes the reward USD separately; the USD column on
// the right is a "what's this position worth as a whole" single number,
// which is why rewards still add into it. Backed by JS number sums (the
// upstream IDeFiAsset.value is already a number, not a BigNumber-string).
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

// Unified table layout for non-lending categories. Columns are sized in
// percent (not flex) so empty cells in continuation rows reserve their
// width deterministically — flex children with no content can collapse on
// web, throwing the second supplied row of LP / merged pool-name positions
// out of alignment with the first.
//
// Liquidity-pool groups switch to a denser shape per design: drop the
// Supplied column, render one logical row per position, and stack each
// underlying asset's amount/value as separate lines inside Balance / USD.
// The Position cell already shows the LP avatars and "tokenA + tokenB"
// name, so re-rendering the same tokens in a Supplied column was just
// noise.

const STANDARD_COLUMN_WIDTHS_WITH_REWARDS = {
  position: '25%',
  supplied: '18%',
  balance: '22%',
  rewards: '20%',
  usd: '15%',
} as const;

const STANDARD_COLUMN_WIDTHS_WITHOUT_REWARDS = {
  position: '28%',
  supplied: '22%',
  balance: '30%',
  usd: '20%',
} as const;

const LP_COLUMN_WIDTHS_WITH_REWARDS = {
  position: '35%',
  balance: '25%',
  rewards: '25%',
  usd: '15%',
} as const;

const LP_COLUMN_WIDTHS_WITHOUT_REWARDS = {
  position: '45%',
  balance: '35%',
  usd: '20%',
} as const;

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

type IProtocolUnifiedTableProps = {
  rows: IProtocolUnifiedRow[];
  displayKind: IUnifiedPositionDisplayKind;
  currencySymbol: string;
};

const ProtocolUnifiedTable = memo(
  ({ rows, displayKind, currencySymbol }: IProtocolUnifiedTableProps) => {
    const intl = useIntl();

    const showRewardsColumn = useMemo(
      () => rows.some((row) => row.rewardsExtraAssets.length > 0),
      [rows],
    );
    const isLpMode = displayKind === 'lp-stack';

    const labels = useMemo(
      () => ({
        position: intl.formatMessage({ id: ETranslations.earn_positions }),
        supplied: intl.formatMessage({
          id: ETranslations.wallet_defi_asset_type_supplied,
        }),
        balance: intl.formatMessage({ id: ETranslations.global_balance }),
        rewards: intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_rewards,
        }),
        value: intl.formatMessage({ id: ETranslations.global_value }),
      }),
      [intl],
    );

    if (isLpMode) {
      const widths = showRewardsColumn
        ? LP_COLUMN_WIDTHS_WITH_REWARDS
        : LP_COLUMN_WIDTHS_WITHOUT_REWARDS;

      return (
        <YStack>
          <XStack mx="$5" px="$2" py="$2" alignItems="center" bg="$bgSubdued">
            <Stack width={widths.position} minWidth={0}>
              <SizableText size="$headingXs" color="$textSubdued">
                {labels.position}
              </SizableText>
            </Stack>
            <Stack width={widths.balance} minWidth={0}>
              <SizableText size="$headingXs" color="$textSubdued">
                {labels.balance}
              </SizableText>
            </Stack>
            {showRewardsColumn ? (
              <Stack width={LP_COLUMN_WIDTHS_WITH_REWARDS.rewards} minWidth={0}>
                <SizableText size="$headingXs" color="$textSubdued">
                  {labels.rewards}
                </SizableText>
              </Stack>
            ) : null}
            <Stack width={widths.usd} minWidth={0} alignItems="flex-end">
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
                <Stack width={widths.position} minWidth={0} pt="$1">
                  <ProtocolPositionCell display={row.positionDisplay} />
                </Stack>
                <YStack width={widths.balance} minWidth={0} gap="$1">
                  {row.primaryAssets.map((asset, assetIndex) => (
                    <NumberSizeableTextWrapper
                      key={`${row.rowKey}-balance-${asset.address}-${assetIndex}`}
                      hideValue
                      size="$bodyMd"
                      formatter="balance"
                      formatterOptions={{ tokenSymbol: asset.symbol }}
                      numberOfLines={1}
                      fontVariant={TABULAR_NUMS}
                    >
                      {asset.amount}
                    </NumberSizeableTextWrapper>
                  ))}
                </YStack>
                {showRewardsColumn ? (
                  <Stack
                    width={LP_COLUMN_WIDTHS_WITH_REWARDS.rewards}
                    minWidth={0}
                  >
                    {row.rewardsExtraAssets.length > 0 ? (
                      <ProtocolRewardsCell
                        rewards={row.rewardsExtraAssets}
                        currencySymbol={currencySymbol}
                      />
                    ) : null}
                  </Stack>
                ) : null}
                <Stack
                  width={widths.usd}
                  minWidth={0}
                  alignItems="flex-end"
                  pt="$1"
                >
                  <NumberSizeableTextWrapper
                    hideValue
                    size="$bodyMdMedium"
                    formatter="value"
                    formatterOptions={{ currency: currencySymbol }}
                    textAlign="right"
                    numberOfLines={1}
                    fontVariant={TABULAR_NUMS}
                  >
                    {positionUsd}
                  </NumberSizeableTextWrapper>
                </Stack>
              </XStack>
            );
          })}
        </YStack>
      );
    }

    const widths = showRewardsColumn
      ? STANDARD_COLUMN_WIDTHS_WITH_REWARDS
      : STANDARD_COLUMN_WIDTHS_WITHOUT_REWARDS;

    return (
      <YStack>
        <XStack mx="$5" px="$2" py="$2" alignItems="center" bg="$bgSubdued">
          <Stack width={widths.position} minWidth={0}>
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.position}
            </SizableText>
          </Stack>
          <Stack width={widths.supplied} minWidth={0}>
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.supplied}
            </SizableText>
          </Stack>
          <Stack width={widths.balance} minWidth={0}>
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.balance}
            </SizableText>
          </Stack>
          {showRewardsColumn ? (
            <Stack
              width={STANDARD_COLUMN_WIDTHS_WITH_REWARDS.rewards}
              minWidth={0}
            >
              <SizableText size="$headingXs" color="$textSubdued">
                {labels.rewards}
              </SizableText>
            </Stack>
          ) : null}
          <Stack width={widths.usd} minWidth={0} alignItems="flex-end">
            <SizableText size="$headingXs" color="$textSubdued">
              {labels.value}
            </SizableText>
          </Stack>
        </XStack>

        {rows.map((row, rowIndex) => {
          // primaryAssets is what fills the Supplied/Balance trio. We
          // render one inner row per asset; the Position cell, Rewards
          // cell, and USD-total cell only attach to the first asset row
          // so multi-asset positions (merged poolNames in non-LP
          // categories) read as a single logical group with one total
          // value on the right. The wrapping YStack hangs a hairline at
          // the top edge so neighboring positions are visibly separated
          // without dropping rules between sub-rows of the same position.
          const assetCount = Math.max(row.primaryAssets.length, 1);
          const positionUsd = sumPositionUsd(
            row.primaryAssets,
            row.rewardsExtraAssets,
          );
          return (
            <YStack key={row.rowKey} mt={rowIndex === 0 ? '$0' : '$3'}>
              {Array.from({ length: assetCount }).map((_, assetIndex) => {
                const asset = row.primaryAssets[assetIndex];
                const isFirst = assetIndex === 0;
                return (
                  <XStack
                    key={`${row.rowKey}-${assetIndex}`}
                    mx="$5"
                    px="$2"
                    py="$2"
                    alignItems="center"
                    minHeight={44}
                  >
                    <Stack width={widths.position} minWidth={0}>
                      {isFirst ? (
                        <ProtocolPositionCell display={row.positionDisplay} />
                      ) : null}
                    </Stack>
                    <XStack
                      width={widths.supplied}
                      minWidth={0}
                      alignItems="center"
                      gap="$2"
                    >
                      {asset ? (
                        <>
                          <Token
                            size="xs"
                            tokenImageUri={asset.meta?.logoUrl}
                            bg="$bgStrong"
                          />
                          <SizableText
                            size="$bodyMdMedium"
                            numberOfLines={1}
                            flex={1}
                            minWidth={0}
                          >
                            {asset.symbol}
                          </SizableText>
                        </>
                      ) : null}
                    </XStack>
                    <Stack width={widths.balance} minWidth={0}>
                      {asset ? (
                        <NumberSizeableTextWrapper
                          hideValue
                          size="$bodyMd"
                          formatter="balance"
                          formatterOptions={{ tokenSymbol: asset.symbol }}
                          numberOfLines={1}
                        >
                          {asset.amount}
                        </NumberSizeableTextWrapper>
                      ) : null}
                    </Stack>
                    {showRewardsColumn ? (
                      <Stack
                        width={STANDARD_COLUMN_WIDTHS_WITH_REWARDS.rewards}
                        minWidth={0}
                      >
                        {isFirst && row.rewardsExtraAssets.length > 0 ? (
                          <ProtocolRewardsCell
                            rewards={row.rewardsExtraAssets}
                            currencySymbol={currencySymbol}
                          />
                        ) : null}
                      </Stack>
                    ) : null}
                    <Stack
                      width={widths.usd}
                      minWidth={0}
                      alignItems="flex-end"
                    >
                      {isFirst ? (
                        <NumberSizeableTextWrapper
                          hideValue
                          size="$bodyMdMedium"
                          formatter="value"
                          formatterOptions={{ currency: currencySymbol }}
                          textAlign="right"
                          numberOfLines={1}
                          fontVariant={TABULAR_NUMS}
                        >
                          {positionUsd}
                        </NumberSizeableTextWrapper>
                      ) : null}
                    </Stack>
                  </XStack>
                );
              })}
            </YStack>
          );
        })}
      </YStack>
    );
  },
);

ProtocolUnifiedTable.displayName = 'ProtocolUnifiedTable';

export { ProtocolUnifiedTable };
