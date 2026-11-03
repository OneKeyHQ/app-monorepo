import { memo, useCallback } from 'react';

import BigNumber from 'bignumber.js';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { PnlCell } from '../components/PnlCell';

interface IPortfolioItemSmallProps {
  item: IMarketAccountPortfolioDisplayItem;
  onPress?: (item: IMarketAccountPortfolioDisplayItem) => void;
  isStock?: boolean;
}

function PortfolioItemSmallBase({
  item,
  onPress,
  isStock = false,
}: IPortfolioItemSmallProps) {
  const pnl = item.pnl;
  const isPnlSupported = pnl?.isPnlSupported ?? false;
  const handlePress = useCallback(() => onPress?.(item), [item, onPress]);

  if (isStock) {
    const pnlValue = new BigNumber(pnl?.unrealizedPnlUsd ?? NaN);
    let pnlColor = '$textSubdued';
    if (pnlValue.gt(0)) pnlColor = '$textSuccess';
    if (pnlValue.lt(0)) pnlColor = '$textCritical';

    return (
      <XStack
        px="$5"
        py="$2"
        gap="$3"
        alignItems="center"
        onPress={onPress ? handlePress : undefined}
      >
        <Token
          size="md"
          tokenImageUri={item.tokenLogoUrl}
          networkImageUri={item.networkLogoUrl}
          networkId={item.networkId}
          showNetworkIcon={Boolean(item.networkId)}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {item.symbol}
          </SizableText>
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="balance"
            numberOfLines={1}
          >
            {item.amount}
          </NumberSizeableText>
        </YStack>
        <YStack alignItems="flex-end" gap="$1" flexShrink={0}>
          <Currency
            size="$bodyLgMedium"
            formatter="value"
            sourceCurrency={item.currency ?? USD_CURRENCY_ID}
            numberOfLines={1}
          >
            {displayOrUnavailable(item.totalPrice)}
          </Currency>
          {isPnlSupported && !pnlValue.isNaN() ? (
            <NumberSizeableText
              size="$bodySm"
              color={pnlColor}
              formatter="priceChange"
              formatterOptions={{ showPlusMinusSigns: true }}
              numberOfLines={1}
            >
              {pnl?.unrealizedPnlPercent}
            </NumberSizeableText>
          ) : null}
        </YStack>
      </XStack>
    );
  }

  return (
    <XStack
      mx="$2"
      px="$3"
      py="$2.5"
      borderRadius="$3"
      alignItems="center"
      onPress={onPress ? handlePress : undefined}
      cursor={onPress ? 'pointer' : undefined}
    >
      <YStack w={100} minWidth={0} alignItems="flex-start">
        <Currency
          size="$bodySm"
          color="$text"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
          sourceCurrency={item.currency ?? USD_CURRENCY_ID}
        >
          {displayOrUnavailable(item.totalPrice)}
        </Currency>
        <NumberSizeableText
          size="$bodySm"
          color="$textSubdued"
          autoFormatter="price-marketCap"
          autoFormatterThreshold={1000}
        >
          {item.amount}
        </NumberSizeableText>
      </YStack>

      <PnlCell
        usdValue={pnl?.unrealizedPnlUsd ?? '0'}
        percent={pnl?.unrealizedPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        flex={1}
      />

      <PnlCell
        usdValue={pnl?.totalPnlUsd ?? '0'}
        percent={pnl?.totalPnlPercent ?? '0'}
        isSupported={isPnlSupported}
        columnWidth={110}
      />
    </XStack>
  );
}

const PortfolioItemSmall = memo(PortfolioItemSmallBase);

export { PortfolioItemSmall };
