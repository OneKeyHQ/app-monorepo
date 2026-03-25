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
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import type { IOrderBookVariant } from './types';

const MOBILE_ROW_HEIGHT = 12;

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

export type IDefaultLoadingNodeProps = {
  variant: IOrderBookVariant;
  symbol?: string;
};

export function DefaultLoadingNode({
  variant,
  symbol,
}: IDefaultLoadingNodeProps) {
  const intl = useIntl();

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
                    h={MOBILE_ROW_HEIGHT}
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
              ({symbol ? parseDexCoin(symbol).displayName : '—'})
            </SizableText>
          </YStack>
        </XStack>

        <YStack gap="$1.5" flex={1}>
          <XStack w="100%" h={MOBILE_ROW_HEIGHT}>
            <Skeleton w="100%" h="100%" radius="round" />
          </XStack>
          <XStack w="80%" h={MOBILE_ROW_HEIGHT}>
            <Skeleton w="100%" h="100%" radius="round" />
          </XStack>
          <XStack w="60%" h={MOBILE_ROW_HEIGHT}>
            <Skeleton w="100%" h="100%" radius="round" />
          </XStack>
          <XStack w="40%" h={MOBILE_ROW_HEIGHT}>
            <Skeleton w="100%" h="100%" radius="round" />
          </XStack>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} w="100%" gap="$2">
      <XStack>
        <Stack w="33%" ai="flex-start">
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
        <Stack w="37%" ai="flex-end">
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
