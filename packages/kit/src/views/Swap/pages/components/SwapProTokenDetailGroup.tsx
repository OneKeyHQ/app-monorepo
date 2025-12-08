import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { YStack } from '@onekeyhq/components';
import { useSwapProTokenMarketDetailInfoAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

const SwapProTokenDetailGroup = () => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const intl = useIntl();
  const { marketCap, volume24h, liquidity, holders } = useMemo(() => {
    const formattedMarketCap = numberFormat(
      tokenMarketDetailInfo?.marketCap ?? '0',
      {
        formatter: 'marketCap',
      },
    );
    const formattedVolume24h = numberFormat(
      tokenMarketDetailInfo?.volume24h ?? '0',
      {
        formatter: 'marketCap',
      },
    );
    const formattedLiquidity = numberFormat(
      tokenMarketDetailInfo?.liquidity ?? '0',
      {
        formatter: 'marketCap',
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
  }, [tokenMarketDetailInfo]);
  return (
    <YStack gap="$1.5">
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_market_cap })}
        value={marketCap}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        // isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.dexmarket_search_result_vol,
        })}
        value={volume24h}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        // isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_liquidity })}
        value={liquidity}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        // isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title={intl.formatMessage({ id: ETranslations.dexmarket_holders })}
        value={holders}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        // isLoading={tokenMarketDetailLoading}
      />
    </YStack>
  );
};

export default SwapProTokenDetailGroup;
