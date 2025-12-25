import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { NumberSizeableText, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

export const ITEM_TITLE_PROPS = { size: '$bodySm' } as const;
export const ITEM_VALUE_PROPS = { size: '$bodySmMedium' } as const;
export const ITEM_CONTAINER_PROPS = { py: '$0.5' } as const;

const SwapProTokenDetailGroup = () => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const intl = useIntl();
  const currencyInfo = useCurrency();
  const { marketCap, volume24h, liquidity, holders } = useMemo(() => {
    const isMarketCapAboveThreshold = new BigNumber(
      tokenMarketDetailInfo?.marketCap || '0',
    ).gte(10);
    const formattedMarketCap = (
      <NumberSizeableText
        size={ITEM_VALUE_PROPS.size}
        formatter={isMarketCapAboveThreshold ? 'marketCap' : 'value'}
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {tokenMarketDetailInfo?.marketCap || '0'}
      </NumberSizeableText>
    );

    const isVolume24hAboveThreshold = new BigNumber(
      tokenMarketDetailInfo?.volume24h || '0',
    ).gte(10);
    const formattedVolume24h = (
      <NumberSizeableText
        size={ITEM_VALUE_PROPS.size}
        formatter={isVolume24hAboveThreshold ? 'marketCap' : 'value'}
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {tokenMarketDetailInfo?.volume24h || '0'}
      </NumberSizeableText>
    );
    const isLiquidityAboveThreshold = new BigNumber(
      tokenMarketDetailInfo?.liquidity || '0',
    ).gte(10);
    const formattedLiquidity = (
      <NumberSizeableText
        size={ITEM_VALUE_PROPS.size}
        formatter={isLiquidityAboveThreshold ? 'marketCap' : 'value'}
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {tokenMarketDetailInfo?.liquidity || '0'}
      </NumberSizeableText>
    );
    const isHoldersAboveThreshold = new BigNumber(
      tokenMarketDetailInfo?.holders?.toString() || '0',
    ).gte(10);
    const formattedHolders = (
      <NumberSizeableText
        size={ITEM_VALUE_PROPS.size}
        formatter={isHoldersAboveThreshold ? 'marketCap' : 'value'}
      >
        {swapProSelectToken?.isNative
          ? '-'
          : tokenMarketDetailInfo?.holders?.toString() || '0'}
      </NumberSizeableText>
    );
    return {
      marketCap: formattedMarketCap,
      volume24h: formattedVolume24h,
      liquidity: formattedLiquidity,
      holders: formattedHolders,
    };
  }, [
    tokenMarketDetailInfo?.marketCap,
    tokenMarketDetailInfo?.volume24h,
    tokenMarketDetailInfo?.liquidity,
    tokenMarketDetailInfo?.holders,
    currencyInfo.symbol,
    swapProSelectToken?.isNative,
  ]);
  return (
    <YStack>
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        valueComponent={marketCap}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.dexmarket_search_result_vol,
        })}
        valueComponent={volume24h}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        valueComponent={liquidity}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        valueComponent={holders}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
    </YStack>
  );
};

export default SwapProTokenDetailGroup;
