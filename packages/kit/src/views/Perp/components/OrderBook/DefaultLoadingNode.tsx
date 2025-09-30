import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const DESKTOP_ROW_HEIGHT = 18;
const MOBILE_ROW_HEIGHT = 12;

const DESKTOP_ROW_WIDTHS = [
  '100%',
  '95%',
  '90%',
  '85%',
  '80%',
  '75%',
  '72%',
  '68%',
  '66%',
  '62%',
  '57%',
  '52%',
  '48%',
  '44%',
  '40%',
  '36%',
  '32%',
  '28%',
  '100%',
  '28%',
  '32%',
  '36%',
  '40%',
  '44%',
  '48%',
  '52%',
  '57%',
  '62%',
  '66%',
  '68%',
  '72%',
  '75%',
  '80%',
  '85%',
  '90%',
  '95%',
  '100%',
];

const MOBILE_ROWS: { width: string; height: number }[] = [
  { width: '100%', height: MOBILE_ROW_HEIGHT },
  { width: '92%', height: MOBILE_ROW_HEIGHT },
  { width: '85%', height: MOBILE_ROW_HEIGHT },
  { width: '78%', height: MOBILE_ROW_HEIGHT },
  { width: '72%', height: MOBILE_ROW_HEIGHT },
  { width: '65%', height: MOBILE_ROW_HEIGHT },
  { width: '58%', height: MOBILE_ROW_HEIGHT },
  { width: '50%', height: MOBILE_ROW_HEIGHT },
  { width: '100%', height: MOBILE_ROW_HEIGHT },
  { width: '50%', height: MOBILE_ROW_HEIGHT },
  { width: '58%', height: MOBILE_ROW_HEIGHT },
  { width: '65%', height: MOBILE_ROW_HEIGHT },
  { width: '72%', height: MOBILE_ROW_HEIGHT },
  { width: '78%', height: MOBILE_ROW_HEIGHT },
  { width: '85%', height: MOBILE_ROW_HEIGHT },
  { width: '92%', height: MOBILE_ROW_HEIGHT },
  { width: '100%', height: MOBILE_ROW_HEIGHT },
];

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
  variant: 'desktop' | 'mobileVertical' | 'mobileHorizontal';
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
              ({symbol ?? '—'})
            </SizableText>
          </YStack>
        </XStack>

        <YStack gap="$1.5">
          {MOBILE_ROWS.map((row, index) => (
            <Stack
              key={index}
              h={row.height}
              borderRadius={4}
              overflow="hidden"
              w="100%"
            >
              <Skeleton w={row.width} h="100%" radius="square" />
            </Stack>
          ))}
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

      <YStack gap={1}>
        {DESKTOP_ROW_WIDTHS.map((width, index) => (
          <Stack key={index} h={DESKTOP_ROW_HEIGHT} overflow="hidden">
            <Skeleton w={width} h="100%" radius="square" />
          </Stack>
        ))}
      </YStack>
    </YStack>
  );
}
