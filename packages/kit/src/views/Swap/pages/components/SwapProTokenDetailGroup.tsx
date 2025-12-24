import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import {
  useSwapProSelectTokenAtom,
  useSwapProTokenMarketDetailInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

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
    const formattedMarketCap = numberFormat(
      tokenMarketDetailInfo?.marketCap ?? '0',
      {
        formatter: 'marketCap',
        formatterOptions: {
          currency: currencyInfo.symbol,
        },
      },
    );
    const formattedVolume24h = numberFormat(
      tokenMarketDetailInfo?.volume24h ?? '0',
      {
        formatter: 'marketCap',
        formatterOptions: {
          currency: currencyInfo.symbol,
        },
      },
    );
    const formattedLiquidity = numberFormat(
      tokenMarketDetailInfo?.liquidity ?? '0',
      {
        formatter: 'marketCap',
        formatterOptions: {
          currency: currencyInfo.symbol,
        },
      },
    );
    const formattedHolders = numberFormat(
      tokenMarketDetailInfo?.holders?.toString() ?? '0',
      {
        formatter: 'marketCap',
      },
    );
    return {
      marketCap: formattedMarketCap,
      volume24h: formattedVolume24h,
      liquidity: formattedLiquidity,
      holders: formattedHolders,
    };
  }, [tokenMarketDetailInfo, currencyInfo.symbol]);
  return (
    <YStack>
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        value={marketCap}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.dexmarket_search_result_vol,
        })}
        value={volume24h}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        value={liquidity}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={swapProSelectToken?.isNative ? '-' : holders}
        titleProps={ITEM_TITLE_PROPS}
        valueProps={ITEM_VALUE_PROPS}
        containerProps={ITEM_CONTAINER_PROPS}
      />
    </YStack>
  );
};

export default SwapProTokenDetailGroup;
