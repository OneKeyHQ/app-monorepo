import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useCurrency } from '../../../components/Currency';

interface ISwapProBuySellInfoProps {
  tokenDetailInfo?: IMarketTokenDetail;
  timeRange: ESwapProTimeRange;
  isNative?: boolean;
}

const getCountByTimeRange = (
  detail: IMarketTokenDetail | undefined,
  timeRange: ESwapProTimeRange,
  type: 'buy' | 'sell' | 'vBuy' | 'vSell',
  endString: string,
) => {
  const key = `${type}${timeRange}${endString}` as keyof IMarketTokenDetail;
  return (detail?.[key] as number) ?? 0;
};

const SwapProBuySellInfo = ({
  tokenDetailInfo,
  timeRange,
  isNative,
}: ISwapProBuySellInfoProps) => {
  const currencyInfo = useCurrency();
  const buyVolume = useMemo(() => {
    const buyVolumeValue = getCountByTimeRange(
      tokenDetailInfo,
      timeRange,
      'vBuy',
      '',
    );
    const isAboveThreshold = new BigNumber(buyVolumeValue).gte(10);
    const formattedBuyVolume = (
      <NumberSizeableText
        size="$bodySm"
        color="$textSuccess"
        fontFamily="$monoRegular"
        formatter={isAboveThreshold ? 'marketCap' : 'value'}
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {isNative ? '--' : buyVolumeValue}
      </NumberSizeableText>
    );
    return {
      value: buyVolumeValue,
      formattedValue: formattedBuyVolume,
    };
  }, [tokenDetailInfo, timeRange, currencyInfo.symbol, isNative]);
  const sellVolume = useMemo(() => {
    const sellVolumeValue = getCountByTimeRange(
      tokenDetailInfo,
      timeRange,
      'vSell',
      '',
    );
    const isAboveThreshold = new BigNumber(sellVolumeValue).gte(10);
    const formattedSellVolume = (
      <NumberSizeableText
        size="$bodySm"
        color="$textCritical"
        fontFamily="$monoRegular"
        formatter={isAboveThreshold ? 'marketCap' : 'value'}
        formatterOptions={{ currency: currencyInfo.symbol }}
      >
        {isNative ? '--' : sellVolumeValue}
      </NumberSizeableText>
    );
    return {
      value: sellVolumeValue,
      formattedValue: formattedSellVolume,
    };
  }, [tokenDetailInfo, timeRange, currencyInfo.symbol, isNative]);
  const totalVolume = useMemo(() => {
    const buyVBN = new BigNumber(buyVolume.value);
    const sellVBN = new BigNumber(sellVolume.value);
    if (buyVBN.isNaN() || sellVBN.isNaN()) return '';
    return buyVBN.plus(sellVBN).toFixed();
  }, [buyVolume, sellVolume]);

  const buyPercentage = useMemo(() => {
    if (!totalVolume || totalVolume === '0') return 0;
    return new BigNumber(buyVolume.value || 0)
      .dividedBy(totalVolume ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [buyVolume, totalVolume]);
  const sellPercentage = useMemo(() => {
    if (!totalVolume || totalVolume === '0') return 0;
    return new BigNumber(sellVolume.value || 0)
      .dividedBy(totalVolume ?? 0)
      .multipliedBy(100)
      .toNumber();
  }, [sellVolume, totalVolume]);
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
            {isNative ? '--' : buyPercentage.toFixed(2)}%
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
            {isNative ? '--' : sellPercentage.toFixed(2)}%
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
        {buyVolume.formattedValue}
        {sellVolume.formattedValue}
      </XStack>
    </YStack>
  );
};

export default SwapProBuySellInfo;
