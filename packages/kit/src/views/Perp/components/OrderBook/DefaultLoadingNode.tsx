import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ROW_HEIGHT = 24;

const rowWidths = [
  '100%',
  '95%',
  '90%',
  '72%',
  '66%',
  '57%',
  '44%',
  '32%',
  '100%',
  '32%',
  '44%',
  '57%',
  '66%',
  '72%',
  '90%',
  '95%',
  '100%',
];

export function DefaultLoadingNode() {
  const intl = useIntl();
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
            {intl.formatMessage({
              id: ETranslations.perp_orderbook_price,
            })}
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
            {intl.formatMessage({
              id: ETranslations.perp_orderbook_size,
            })}
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
            {intl.formatMessage({
              id: ETranslations.perp_orderbook_total,
            })}
          </SizableText>
        </Stack>
      </XStack>

      <YStack gap="$2">
        {rowWidths.map((width, index) => (
          <Stack key={index} h={ROW_HEIGHT} borderRadius={4} overflow="hidden">
            <Skeleton w={width} h="100%" />
          </Stack>
        ))}
      </YStack>
    </YStack>
  );
}
