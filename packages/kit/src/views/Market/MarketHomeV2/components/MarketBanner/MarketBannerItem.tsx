import { memo, useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

type IMarketBannerItemProps = {
  item: IMarketBannerItem;
  onPress?: (item: IMarketBannerItem) => void;
};

function convertThemeToken(token: string, defaultValue: string): string {
  // Convert "prefix/suffix" format to "$prefixSuffix" Tamagui token
  // e.g., "bg/subdued" -> "$bgSubdued", "text/success" -> "$textSuccess"
  // Also handles hyphenated suffixes: "bg/info-subdued" -> "$bgInfoSubdued"
  if (!token) {
    return defaultValue;
  }
  const parts = token.split('/');
  if (parts.length === 2) {
    const [prefix, suffix] = parts;
    // Convert hyphenated suffix to camelCase: "info-subdued" -> "InfoSubdued"
    const camelCaseSuffix = suffix
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return `$${prefix}${camelCaseSuffix}`;
  }
  return token.startsWith('$') ? token : `$${token}`;
}

function BannerTokenGroupComponent({ tokenLogos }: { tokenLogos?: string[] }) {
  if (!tokenLogos?.length) return null;

  const visibleTokens = tokenLogos.slice(0, 3);

  return (
    <XStack>
      {visibleTokens.map((url, index) => (
        <Stack
          key={url || index}
          borderRadius="$full"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$neutral3"
          bg="$bgStrong"
          overflow="hidden"
          {...(index !== 0 && { ml: '$-1.5' })}
        >
          <Image
            size="$5"
            borderRadius="$full"
            source={{ uri: url }}
            fallback={
              <Stack
                w="$5"
                h="$5"
                bg="$gray5"
                borderRadius="$full"
                alignItems="center"
                justifyContent="center"
              >
                <Icon size="$4" name="CryptoCoinOutline" color="$iconSubdued" />
              </Stack>
            }
          />
        </Stack>
      ))}
    </XStack>
  );
}

const BannerTokenGroup = memo(BannerTokenGroupComponent);

function MarketBannerItemComponent({ item, onPress }: IMarketBannerItemProps) {
  const { title, description, backgroundColor, tokenLogos } = item;
  const bgColor = convertThemeToken(backgroundColor, '$bgSubdued');
  const descriptionColor = convertThemeToken(
    description?.fontColor ?? '',
    '$textSubdued',
  );

  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [onPress, item]);

  return (
    <Stack
      flexDirection="column"
      bg={bgColor}
      borderRadius="$3"
      px="$3"
      py="$3.5"
      width="$32"
      alignItems="flex-start"
      justifyContent="space-between"
      onPress={handlePress}
      animation="quick"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      hoverStyle={{ borderColor: '$neutral4' }}
      pressStyle={{ borderColor: '$neutral5' }}
      h={118}
      userSelect="none"
      $gtMd={{
        flexDirection: 'row',
        flex: 1,
        flexBasis: 0,
        minWidth: 180,
        maxWidth: 256,
        width: 'auto',
        h: '100%',
        p: '$4',
        gap: '$3',
        alignItems: 'center',
      }}
    >
      <YStack gap="$0.5" flex={1} $gtMd={{ flex: 1 }}>
        <SizableText size="$headingSm" numberOfLines={2}>
          {title}
        </SizableText>
        {description ? (
          <SizableText size="$bodyMdMedium" color={descriptionColor}>
            {description.text}
          </SizableText>
        ) : null}
      </YStack>
      <BannerTokenGroup tokenLogos={tokenLogos} />
    </Stack>
  );
}

export const MarketBannerItem = memo(MarketBannerItemComponent);
