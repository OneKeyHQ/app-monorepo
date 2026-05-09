import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
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

const MOBILE_SKELETON_ROW_HEIGHT = 12;
const MOBILE_VERTICAL_ROW_HEIGHT = 20;
const MOBILE_VERTICAL_SPREAD_ROW_HEIGHT = 60;
const MOBILE_VERTICAL_EMPTY_ROW_COUNT = 7;
const MOBILE_VERTICAL_EMPTY_ROW_INDEXES = Array.from(
  { length: MOBILE_VERTICAL_EMPTY_ROW_COUNT },
  (_, index) => index,
);
const WEB_ORDER_BOOK_HEADER_SIDE_PADDING = 8;

const MOBILE_HORIZONTAL_WIDTHS = [
  '6.4%',
  '11.3%',
  '20.6%',
  '32.6%',
  '43.3%',
  '56.7%',
  '67.4%',
  '73.0%',
  '83.7%',
  '91.5%',
  '100%',
];

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

export type IDefaultLoadingNodeProps = {
  variant: IOrderBookVariant;
  symbol?: string;
  isSpot?: boolean;
  spotUniverse?: Pick<ISpotUniverse, 'baseName'> | null;
  markPrice?: string;
};

export function DefaultLoadingNode({
  variant,
  symbol,
  isSpot = false,
  spotUniverse,
  markPrice,
}: IDefaultLoadingNodeProps) {
  const intl = useIntl();
  const sizeDisplaySymbol =
    getOrderBookSizeDisplaySymbol({
      coin: symbol,
      isSpot,
      spotUniverse,
    }) || '—';
  const markPriceNumber = Number.parseFloat(markPrice ?? '');
  const markPriceDisplay =
    Number.isFinite(markPriceNumber) && markPriceNumber > 0
      ? formatLocalizedNumberString(markPrice ?? '')
      : '--';

  if (variant === 'mobileHorizontal') {
    return (
      <YStack flex={1} w="100%" gap="$2" p="0">
        <XStack w="100%" alignItems="center" justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_buy })}
          </SizableText>
          <XStack alignItems="center" gap="$1">
            <Skeleton w={50} h={16} />
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_sell })}
          </SizableText>
        </XStack>

        <XStack w="100%" gap="$1" alignItems="flex-start">
          {[0, 1].map((columnIdx) => {
            const widths = MOBILE_HORIZONTAL_WIDTHS;
            const alignItems = columnIdx === 0 ? 'flex-end' : 'flex-start';
            return (
              <YStack key={columnIdx} flex={1} gap={1} alignItems={alignItems}>
                {widths.map((width, index) => (
                  <Stack
                    key={`${columnIdx}-${index}`}
                    h={MOBILE_SKELETON_ROW_HEIGHT}
                    overflow="hidden"
                    w={width}
                  >
                    <Skeleton w="100%" h="100%" radius="square" />
                  </Stack>
                ))}
              </YStack>
            );
          })}
        </XStack>
      </YStack>
    );
  }

  if (variant === 'mobileVertical') {
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
          {MOBILE_VERTICAL_EMPTY_ROW_INDEXES.map((index) => (
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
              color="$red11"
            >
              {markPriceDisplay}
            </SizableText>
          </YStack>
          {MOBILE_VERTICAL_EMPTY_ROW_INDEXES.map((index) => (
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
