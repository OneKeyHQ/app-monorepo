import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useCurrency } from '../../../components/Currency';

interface ISwapProBuySellInfoProps {
  tokenDetailInfo?: IMarketTokenDetail;
  timeRange: ESwapProTimeRange;
}

const getCountByTimeRange = (
  detail: IMarketTokenDetail | undefined,
  timeRange: ESwapProTimeRange,
  type: 'buy' | 'sell' | 'volume',
  endString: string,
) => {
  const key = `${type}${timeRange}${endString}` as keyof IMarketTokenDetail;
  return (detail?.[key] as number) ?? 0;
};

const SwapProBuySellInfo = ({
  tokenDetailInfo,
  timeRange,
}: ISwapProBuySellInfoProps) => {
  const currencyInfo = useCurrency();
  const buyCount = useMemo(() => {
    return getCountByTimeRange(tokenDetailInfo, timeRange, 'buy', 'Count');
  }, [timeRange, tokenDetailInfo]);
  const sellCount = useMemo(() => {
    return getCountByTimeRange(tokenDetailInfo, timeRange, 'sell', 'Count');
  }, [timeRange, tokenDetailInfo]);
  const totalCount = useMemo(() => {
    return new BigNumber(buyCount ?? 0).plus(sellCount ?? 0).toNumber();
  }, [buyCount, sellCount]);
  const buyPercentage = useMemo(() => {
    if (!totalCount || totalCount === 0) return 0;
    return new BigNumber(buyCount ?? 0)
      .dividedBy(totalCount ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [buyCount, totalCount]);
  const sellPercentage = useMemo(() => {
    if (!totalCount || totalCount === 0) return 0;
    return new BigNumber(sellCount ?? 0)
      .dividedBy(totalCount ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [sellCount, totalCount]);
  const buyVolume = useMemo(() => {
    const buyVolumeCount = getCountByTimeRange(
      tokenDetailInfo,
      timeRange,
      'buy',
      'Count',
    );
    const priceBN = new BigNumber(tokenDetailInfo?.price || 0);
    const buyVolumeValue = priceBN.multipliedBy(buyVolumeCount);
    return numberFormat(buyVolumeValue.toFixed(), {
      formatter: 'marketCap',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
  }, [tokenDetailInfo, timeRange, currencyInfo.symbol]);
  const sellVolume = useMemo(() => {
    const sellVolumeCount = getCountByTimeRange(
      tokenDetailInfo,
      timeRange,
      'sell',
      'Count',
    );
    const priceBN = new BigNumber(tokenDetailInfo?.price || 0);
    const sellVolumeValue = priceBN.multipliedBy(sellVolumeCount);
    return numberFormat(sellVolumeValue.toFixed(), {
      formatter: 'marketCap',
      formatterOptions: {
        currency: currencyInfo.symbol,
      },
    });
  }, [tokenDetailInfo, timeRange, currencyInfo.symbol]);
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
            <SizableText size="$bodySmMedium" color="$textSuccess">
              B
            </SizableText>
          </Stack>
          <SizableText
            size="$bodyXs"
            color="$textSuccess"
            ml="$0.5"
            fontFamily="$monoRegular"
          >
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
          <SizableText
            size="$bodyXs"
            color="$textCritical"
            mr="$0.5"
            fontFamily="$monoRegular"
          >
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
        <SizableText
          size="$bodySm"
          color="$textSuccess"
          fontFamily="$monoRegular"
        >
          {buyVolume}
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textCritical"
          fontFamily="$monoRegular"
        >
          {sellVolume}
        </SizableText>
      </XStack>
    </YStack>
  );
};

export default SwapProBuySellInfo;
