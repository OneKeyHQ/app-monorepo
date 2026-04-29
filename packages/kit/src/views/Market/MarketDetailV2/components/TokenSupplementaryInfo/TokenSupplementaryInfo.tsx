import { useCallback, useMemo } from 'react';

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

import { useBtcMetadata } from '../../hooks/useBtcMetadata';
import { useTokenDetail } from '../../hooks/useTokenDetail';
import {
  STAT_FALLBACK_VALUE,
  formatBlockHeightValue,
  formatCurrencyStatValue,
  formatMarketCapValue,
} from '../../utils/statValue';

const formatBtcAmount = (value: string | number | undefined) => {
  const formatted = formatMarketCapValue(value);
  return formatted === STAT_FALLBACK_VALUE ? formatted : `${formatted} BTC`;
};

interface ISupplementaryRow {
  key: string;
  label: string;
  value: string;
  tooltip?: string;
  onPress?: () => void;
}

export function TokenSupplementaryInfo() {
  const intl = useIntl();
  const { tokenDetail, networkId } = useTokenDetail();
  const btcMetadata = useBtcMetadata();

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
          value: formatBtcAmount(btcMetadata.totalSupply),
        },
        {
          key: 'fdv',
          label: intl.formatMessage({ id: ETranslations.dexmarket_fdv_title }),
          value: formatCurrencyStatValue(btcMetadata.fdv),
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

    return [
      {
        key: 'circulating',
        label: intl.formatMessage({
          id: ETranslations.global_circulating_supply,
        }),
        value: formatMarketCapValue(tokenDetail.circulatingSupply),
        tooltip: intl.formatMessage({
          id: ETranslations.dexmarket_circulating_supply_tips,
        }),
      },
      {
        key: 'marketCap',
        label: intl.formatMessage({ id: ETranslations.dexmarket_market_cap }),
        value: formatCurrencyStatValue(tokenDetail.marketCap),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_mc_tips }),
      },
      {
        key: 'fdv',
        label: intl.formatMessage({ id: ETranslations.global_fdv }),
        value: formatCurrencyStatValue(tokenDetail.fdv),
        tooltip: intl.formatMessage({ id: ETranslations.dexmarket_fdv_desc }),
      },
    ];
  }, [btcMetadata, intl, tokenDetail, handleBlockHeightPress]);

  if (!tokenDetail) {
    return null;
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
                  dashColor="$textDisabled"
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
