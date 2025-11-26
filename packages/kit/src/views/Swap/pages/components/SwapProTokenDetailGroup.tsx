import { useMemo } from 'react';

import { YStack } from '@onekeyhq/components';
import {
  useSwapProTokenMarketDetailInfoAtom,
  useSwapProTokenMarketDetailInfoLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import SwapCommonInfoItem from '../../components/SwapCommonInfoItem';

const SwapProTokenDetailGroup = () => {
  const [tokenMarketDetailInfo] = useSwapProTokenMarketDetailInfoAtom();
  const [tokenMarketDetailLoading] =
    useSwapProTokenMarketDetailInfoLoadingAtom();

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
        title="Market Cap"
        value={marketCap}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title="24h Vol"
        value={volume24h}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title="Liquidity"
        value={liquidity}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={tokenMarketDetailLoading}
      />
      <SwapCommonInfoItem
        title="Holders"
        value={holders}
        titleProps={{
          size: '$bodySm',
        }}
        valueProps={{
          size: '$bodySmMedium',
        }}
        isLoading={tokenMarketDetailLoading}
      />
    </YStack>
  );
};

export default SwapProTokenDetailGroup;
