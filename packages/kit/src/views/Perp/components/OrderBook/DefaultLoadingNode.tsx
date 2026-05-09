import { useIntl } from 'react-intl';

import {
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatLocalizedNumberString } from '@onekeyhq/shared/src/utils/numberUtils';
import { getOrderBookSizeDisplaySymbol } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { IOrderBookVariant } from './types';

const MOBILE_HORIZONTAL_ROW_HEIGHT = 24;
const MOBILE_VERTICAL_ROW_HEIGHT = 20;
const MOBILE_VERTICAL_SPREAD_ROW_HEIGHT = 60;
const MOBILE_VERTICAL_EMPTY_ROW_COUNT = 7;
const WEB_ORDER_BOOK_HEADER_SIDE_PADDING = 8;

function MobileVerticalEmptyRow({
  priceColor,
}: {
  priceColor: '$red11' | '$green11';
}) {
  return (
    <XStack
      h={MOBILE_VERTICAL_ROW_HEIGHT}
      px="$1"
      alignItems="center"
      justifyContent="space-between"
    >
      <SizableText
        fontSize={11}
        lineHeight={14}
        fontFamily="$monoRegular"
        fontVariant={['tabular-nums']}
        color={priceColor}
      >
        --
      </SizableText>
      <SizableText
        fontSize={11}
        lineHeight={14}
        fontFamily="$monoRegular"
        fontVariant={['tabular-nums']}
        color="$textSubdued"
      >
        --
      </SizableText>
    </XStack>
  );
}

function MobileHorizontalEmptyRow() {
  return (
    <XStack h={MOBILE_HORIZONTAL_ROW_HEIGHT} gap="$1" alignItems="center">
      <XStack flex={1} px="$1" justifyContent="space-between">
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          color="$textSubdued"
        >
          --
        </SizableText>
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          color="$green11"
        >
          --
        </SizableText>
      </XStack>
      <XStack flex={1} px="$1" justifyContent="space-between">
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          color="$red11"
        >
          --
        </SizableText>
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          color="$textSubdued"
        >
          --
        </SizableText>
      </XStack>
    </XStack>
  );
}

export type IDefaultLoadingNodeProps = {
  variant: IOrderBookVariant;
  symbol?: string;
  isSpot?: boolean;
  spotUniverse?: Pick<ISpotUniverse, 'baseName'> | null;
  midPrice?: string;
  maxLevelsPerSide?: number;
};

export function DefaultLoadingNode({
  variant,
  symbol,
  isSpot = false,
  spotUniverse,
  midPrice,
  maxLevelsPerSide = MOBILE_VERTICAL_EMPTY_ROW_COUNT,
}: IDefaultLoadingNodeProps) {
  const intl = useIntl();
  const sizeDisplaySymbol =
    getOrderBookSizeDisplaySymbol({
      coin: symbol,
      isSpot,
      spotUniverse,
    }) || '—';
  const midPriceNumber = Number.parseFloat(midPrice ?? '');
  const midPriceDisplay =
    Number.isFinite(midPriceNumber) && midPriceNumber > 0
      ? formatLocalizedNumberString(midPrice ?? '')
      : '--';

  if (variant === 'mobileHorizontal') {
    const mobileHorizontalEmptyRowIndexes = Array.from(
      { length: maxLevelsPerSide },
      (_, index) => index,
    );

    return (
      <YStack flex={1} w="100%" gap={1} p="0">
        {mobileHorizontalEmptyRowIndexes.map((index) => (
          <MobileHorizontalEmptyRow key={index} />
        ))}
      </YStack>
    );
  }

  if (variant === 'mobileVertical') {
    const mobileVerticalEmptyRowIndexes = Array.from(
      { length: maxLevelsPerSide },
      (_, index) => index,
    );

    return (
      <YStack flex={1} w="100%" gap="$2">
        <XStack jc="space-between">
          <YStack gap="$0.5">
            <SizableText
              fontSize={11}
              lineHeight={14}
              fontWeight="500"
              textTransform="uppercase"
              letterSpacing={0.8}
              color="$textSubdued"
            >
              {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
            </SizableText>
            <SizableText fontSize={10} lineHeight={12} color="$textSubdued">
              (USD)
            </SizableText>
          </YStack>
          <YStack gap="$0.5" ai="flex-end">
            <SizableText
              fontSize={11}
              lineHeight={14}
              fontWeight="500"
              textTransform="uppercase"
              letterSpacing={0.8}
              color="$textSubdued"
            >
              {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
            </SizableText>
            <SizableText fontSize={10} lineHeight={12} color="$textSubdued">
              ({sizeDisplaySymbol})
            </SizableText>
          </YStack>
        </XStack>

        <YStack flex={1}>
          {mobileVerticalEmptyRowIndexes.map((index) => (
            <MobileVerticalEmptyRow key={`ask-${index}`} priceColor="$red11" />
          ))}
          <YStack
            h={MOBILE_VERTICAL_SPREAD_ROW_HEIGHT}
            py="$1.5"
            justifyContent="center"
          >
            <SizableText
              fontSize={20}
              lineHeight={24}
              fontWeight="600"
              fontFamily="$monoRegular"
              fontVariant={['tabular-nums']}
              color="$text"
            >
              {midPriceDisplay}
            </SizableText>
            <SizableText
              fontSize={10}
              lineHeight={14}
              fontFamily="$monoRegular"
              fontVariant={['tabular-nums']}
              color="$textSubdued"
            >
              --
            </SizableText>
          </YStack>
          {mobileVerticalEmptyRowIndexes.map((index) => (
            <MobileVerticalEmptyRow
              key={`bid-${index}`}
              priceColor="$green11"
            />
          ))}
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} w="100%" gap="$2">
      <XStack>
        <Stack w="33%" ai="flex-start" pl={WEB_ORDER_BOOK_HEADER_SIDE_PADDING}>
          <SizableText
            fontSize={12}
            lineHeight={24}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing={0.8}
            w="100%"
            textAlign="left"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
          </SizableText>
        </Stack>
        <Stack w="30%" ai="flex-end">
          <SizableText
            fontSize={12}
            lineHeight={24}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing={0.8}
            w="100%"
            textAlign="right"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
          </SizableText>
        </Stack>
        <Stack w="37%" ai="flex-end" pr={WEB_ORDER_BOOK_HEADER_SIDE_PADDING}>
          <SizableText
            fontSize={12}
            lineHeight={24}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing={0.8}
            w="100%"
            textAlign="right"
            color="$textSubdued"
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_total })}
          </SizableText>
        </Stack>
      </XStack>

      <YStack gap={1} justifyContent="center" alignItems="center" flex={1}>
        <Spinner size="large" />
      </YStack>
    </YStack>
  );
}
