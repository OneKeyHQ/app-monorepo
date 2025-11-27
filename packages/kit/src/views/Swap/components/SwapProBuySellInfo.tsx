import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useCurrency } from '../../../components/Currency';

interface ISwapProBuySellInfoProps {
  tokenDetailInfo?: IMarketTokenDetail;
  timeRange: ESwapProTimeRange;
}

const SwapProBuySellInfo = ({
  tokenDetailInfo,
  timeRange,
}: ISwapProBuySellInfoProps) => {
  const currencyInfo = useCurrency();
  const buyCount = useMemo(() => {
    switch (timeRange) {
      case ESwapProTimeRange.ONE_HOUR:
        return tokenDetailInfo?.buy1hCount ?? 0;
      case ESwapProTimeRange.FOUR_HOURS:
        return tokenDetailInfo?.buy4hCount ?? 0;
      case ESwapProTimeRange.EIGHT_HOURS:
        return tokenDetailInfo?.buy8hCount ?? 0;
      case ESwapProTimeRange.TWENTY_FOUR_HOURS:
        return tokenDetailInfo?.buy24hCount ?? 0;
      default:
        return 0;
    }
  }, [timeRange, tokenDetailInfo]);
  const sellCount = useMemo(() => {
    switch (timeRange) {
      case ESwapProTimeRange.ONE_HOUR:
        return tokenDetailInfo?.sell1hCount ?? 0;
      case ESwapProTimeRange.FOUR_HOURS:
        return tokenDetailInfo?.sell4hCount ?? 0;
      case ESwapProTimeRange.EIGHT_HOURS:
        return tokenDetailInfo?.sell8hCount ?? 0;
      case ESwapProTimeRange.TWENTY_FOUR_HOURS:
        return tokenDetailInfo?.sell24hCount ?? 0;
      default:
        return 0;
    }
  }, [timeRange, tokenDetailInfo]);
  const totalCount = useMemo(() => {
    return new BigNumber(buyCount ?? 0).plus(sellCount ?? 0).toNumber();
  }, [buyCount, sellCount]);
  const buyPercentage = useMemo(() => {
    return new BigNumber(buyCount ?? 0)
      .dividedBy(totalCount ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [buyCount, totalCount]);
  const sellPercentage = useMemo(() => {
    return new BigNumber(sellCount ?? 0)
      .dividedBy(totalCount ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [sellCount, totalCount]);
  const buyVolume = useMemo(() => {
    const buyVolumeValue = new BigNumber(buyCount ?? 0)
      .multipliedBy(tokenDetailInfo?.price ?? 0)
      .toFixed();
    return numberFormat(buyVolumeValue, {
      formatter: 'marketCap',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
  }, [buyCount, tokenDetailInfo?.price, currencyInfo.symbol]);
  const sellVolume = useMemo(() => {
    const sellVolumeValue = new BigNumber(sellCount ?? 0)
      .multipliedBy(tokenDetailInfo?.price ?? 0)
      .toFixed();
    return numberFormat(sellVolumeValue, {
      formatter: 'marketCap',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
  }, [sellCount, tokenDetailInfo?.price, currencyInfo.symbol]);
  return (
    <YStack gap="$2" mt="$2" flex={1}>
      <XStack position="relative" borderRadius="$1" overflow="hidden">
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          width={`${buyPercentage}%`}
          bg="rgba(2, 186, 60, 0.09)"
          borderTopLeftRadius="$1"
          borderBottomLeftRadius="$1"
        />
        <Stack
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          width={`${sellPercentage}%`}
          bg="rgba(255, 1, 1, 0.06)"
          borderTopRightRadius="$1"
          borderBottomRightRadius="$1"
        />
        <XStack
          flexShrink={1}
          flex={1}
          alignItems="center"
          position="relative"
          zIndex={1}
        >
          <Stack
            w="$4.5"
            h="$4.5"
            justifyContent="center"
            alignItems="center"
            borderColor="rgba(0, 140, 61, 0.43)"
            borderWidth={1}
            borderRadius="$1"
          >
            <SizableText size="$bodySm" color="$textSuccess">
              B
            </SizableText>
          </Stack>
          <SizableText size="$bodySm" color="$textSuccess">
            {buyPercentage.toFixed(2)}%
          </SizableText>
        </XStack>
        <XStack
          flex={1}
          justifyContent="flex-end"
          alignItems="center"
          position="relative"
          zIndex={1}
        >
          <SizableText size="$bodySm" color="$textCritical">
            {sellPercentage.toFixed(2)}%
          </SizableText>
          <Stack
            w="$4.5"
            h="$4.5"
            justifyContent="center"
            alignItems="center"
            borderColor="rgba(217, 0, 3, 0.32)"
            borderWidth={1}
            borderRadius="$1"
          >
            <SizableText size="$bodySm" color="$textCritical">
              S
            </SizableText>
          </Stack>
        </XStack>
      </XStack>
      <XStack justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSuccess">
          {buyVolume}
        </SizableText>
        <SizableText size="$bodySm" color="$textCritical">
          {sellVolume}
        </SizableText>
      </XStack>
    </YStack>
  );
};

export default SwapProBuySellInfo;
