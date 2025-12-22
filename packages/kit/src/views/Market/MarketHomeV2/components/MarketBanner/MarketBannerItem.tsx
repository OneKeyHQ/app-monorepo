import { useMemo } from 'react';

import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { TokenGroup } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

type IMarketBannerItemProps = {
  item: IMarketBannerItem;
  onPress?: (item: IMarketBannerItem) => void;
  compact?: boolean;
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

export function MarketBannerItem({
  item,
  onPress,
  compact,
}: IMarketBannerItemProps) {
  const { title, description, backgroundColor, tokenLogos } = item;
  const bgColor = convertThemeToken(backgroundColor, '$bgSubdued');
  const descriptionColor = convertThemeToken(
    description?.fontColor ?? '',
    '$textSubdued',
  );

  const tokens = useMemo(
    () => tokenLogos?.map((url) => ({ tokenImageUri: url })) ?? [],
    [tokenLogos],
  );

  const handlePress = () => {
    onPress?.(item);
  };

  const isCompact = platformEnv.isNative || compact;

  return (
    <Stack
      flexDirection={isCompact ? 'column' : 'row'}
      bg={bgColor}
      borderRadius="$3"
      p={isCompact ? '$2.5' : '$3'}
      gap="$6"
      alignItems={isCompact ? undefined : 'center'}
      justifyContent="space-between"
      onPress={handlePress}
      {...(!platformEnv.isNative && {
        animation: 'quick',
        borderWidth: 1,
        borderColor: '$transparent',
        hoverStyle: { borderColor: '$borderHover' },
      })}
      pressStyle={{ opacity: 0.7 }}
      cursor="pointer"
    >
      <YStack gap="$1" flex={isCompact ? undefined : 1}>
        <SizableText
          size={isCompact ? '$bodySm' : '$bodyMdMedium'}
          fontWeight={isCompact ? '500' : undefined}
          numberOfLines={1}
        >
          {title}
        </SizableText>
        {description ? (
          <SizableText
            size={isCompact ? '$bodyXs' : '$bodySm'}
            color={descriptionColor}
          >
            {description.text}
          </SizableText>
        ) : null}
      </YStack>
      <TokenGroup
        tokens={tokens}
        size="xs"
        maxVisible={3}
        overlapOffset={-6}
        showRemainingBadge={false}
        wrapperStyle="none"
      />
    </Stack>
  );
}
