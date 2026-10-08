import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openBlockExplorerUrl } from '@onekeyhq/kit/src/utils/explorerUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useBtcMetadataContext } from '../../hooks/BtcMetadataContext';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  MARKET_CAP_FORMATTER,
  USD_CURRENCY_FORMATTER,
  formatBlockHeightValue,
  formatMarketCapValue,
  formatStatValueWithFormatter,
} from '../../utils/statValue';

interface ISupplementaryRow {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
  onPress?: () => void;
}

export function TokenSupplementaryInfo({
  variant = 'sidebar',
  px,
}: {
  variant?: 'sidebar' | 'overview';
  px?: ComponentProps<typeof XStack>['px'];
}) {
  const intl = useIntl();
  const { tokenDetail, networkId } = useTokenDetail();
  const btcMetadata = useBtcMetadataContext();

  const handleBlockHeightPress = useCallback(() => {
    if (!btcMetadata) {
      return;
    }
    void openBlockExplorerUrl({
      networkId,
      blockHeight: btcMetadata.blockHeight,
    });
  }, [btcMetadata, networkId]);

  const rows = useMemo<ISupplementaryRow[]>(() => {
    if (btcMetadata) {
      return [
        {
          key: 'totalSupply',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_total_supply,
          }),
          value: formatMarketCapValue(btcMetadata.totalSupply),
        },
        {
          key: 'remainingSupply',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_remaining_supply,
          }),
          value: formatMarketCapValue(btcMetadata.remainingSupply),
        },
        {
          key: 'blockHeight',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_block_height,
          }),
          value: formatBlockHeightValue(btcMetadata.blockHeight),
          onPress: handleBlockHeightPress,
        },
        {
          key: 'blockReward',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_block_reward,
          }),
          value: `${btcMetadata.blockReward} BTC`,
        },
        {
          key: 'nextHalving',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_btc_next_halving,
          }),
          value: btcMetadata.nextHalvingDisplay,
        },
      ];
    }

    if (!tokenDetail) {
      return [];
    }

    if (variant === 'overview') {
      return [
        {
          key: 'marketCap',
          label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
          value: formatStatValueWithFormatter(
            tokenDetail.marketCap,
            USD_CURRENCY_FORMATTER,
          ),
          tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
        },
        {
          key: 'liquidity',
          label: intl.formatMessage({ id: ETranslations.global_liquidity }),
          value: formatStatValueWithFormatter(
            tokenDetail.liquidity,
            USD_CURRENCY_FORMATTER,
          ),
        },
        {
          key: 'holders',
          label: intl.formatMessage({ id: ETranslations.dexmarket_holders }),
          value: formatStatValueWithFormatter(
            tokenDetail.holders,
            MARKET_CAP_FORMATTER,
          ),
        },
        {
          key: 'volume24h',
          label: intl.formatMessage({
            id: ETranslations.dexmarket_stock_24h_volume,
          }),
          value: formatStatValueWithFormatter(
            tokenDetail.volume24h,
            USD_CURRENCY_FORMATTER,
          ),
        },
        {
          key: 'fdv',
          label: intl.formatMessage({ id: ETranslations.global_fdv }),
          value: formatStatValueWithFormatter(
            tokenDetail.fdv,
            USD_CURRENCY_FORMATTER,
          ),
          tooltip: intl.formatMessage({ id: ETranslations.dexmarket_fdv_desc }),
        },
      ];
    }

    return [
      {
        key: 'circulating',
        label: intl.formatMessage({
          id: ETranslations.global_circulating_supply,
        }),
        value: formatStatValueWithFormatter(
          tokenDetail.circulatingSupply,
          MARKET_CAP_FORMATTER,
        ),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_circulating_supply_tips,
        }),
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        value: formatStatValueWithFormatter(
          tokenDetail.marketCap,
          USD_CURRENCY_FORMATTER,
        ),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
      },
      {
        key: 'fdv',
        label: intl.formatMessage({ id: ETranslations.global_fdv }),
        value: formatStatValueWithFormatter(
          tokenDetail.fdv,
          USD_CURRENCY_FORMATTER,
        ),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_fdv_desc }),
      },
    ];
  }, [btcMetadata, intl, tokenDetail, handleBlockHeightPress, variant]);

  if (!tokenDetail) {
    return null;
  }

  if (variant === 'overview') {
    return (
      <XStack width="100%" px={px ?? '$5'} py="$6" flexWrap="wrap" rowGap="$6">
        {rows.map((item) => (
          <YStack key={item.key} flex={1} minWidth={144} pr="$2.5" gap="$1">
            {item.tooltip ? (
              <Tooltip
                placement="top"
                renderTrigger={
                  <DashText
                    size="$bodyMd"
                    color="$textSubdued"
                    dashThickness={0.5}
                    cursor="help"
                    numberOfLines={1}
                  >
                    {item.label}
                  </DashText>
                }
                renderContent={
                  <SizableText size="$bodySm">{item.tooltip}</SizableText>
                }
              />
            ) : (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {item.label}
              </SizableText>
            )}
            <SizableText size="$headingMd" numberOfLines={1}>
              {item.value}
            </SizableText>
          </YStack>
        ))}
      </XStack>
    );
  }

  return (
    <YStack pl="$3" pr="$5" pt="$3" gap="$2.5">
      {rows.map((item) => (
        <XStack key={item.key} gap="$2" jc="space-between" ai="center">
          {item.tooltip ? (
            <Tooltip
              placement="top"
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  dashThickness={0.5}
                  cursor="help"
                >
                  {item.label}
                </DashText>
              }
              renderContent={
                <SizableText size="$bodySm">{item.tooltip}</SizableText>
              }
            />
          ) : (
            <SizableText size="$bodySm" color="$textSubdued">
              {item.label}
            </SizableText>
          )}
          <SizableText
            size="$bodySmMedium"
            color={item.onPress ? '$textInfo' : '$text'}
            cursor={item.onPress ? 'pointer' : undefined}
            hoverStyle={
              item.onPress ? { textDecorationLine: 'underline' } : undefined
            }
            onPress={item.onPress}
          >
            {item.value}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
