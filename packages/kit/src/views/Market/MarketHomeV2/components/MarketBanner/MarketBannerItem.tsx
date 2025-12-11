import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

type IMarketBannerItemProps = {
  item: IMarketBannerItem;
  onPress?: (item: IMarketBannerItem) => void;
};

function convertBackgroundColor(backgroundColor: string): string {
  // Convert "bg/subdued" format to "$bgSubdued" Tamagui token
  if (!backgroundColor) {
    return '$bgSubdued';
  }
  const parts = backgroundColor.split('/');
  if (parts.length === 2) {
    const [prefix, suffix] = parts;
    // Capitalize first letter of suffix
    const capitalizedSuffix = suffix.charAt(0).toUpperCase() + suffix.slice(1);
    return `$${prefix}${capitalizedSuffix}`;
  }
  return `$${backgroundColor}`;
}

function TokenIconsStack({ tokenLogos }: { tokenLogos?: string[] }) {
  const logos = tokenLogos?.slice(0, 3) ?? [];

  if (logos.length === 0) {
    return null;
  }

  return (
    <XStack>
      {logos.map((logoUrl, index) => (
        <Stack
          key={logoUrl}
          p="$0.5"
          bg="$bgApp"
          borderRadius="$full"
          {...(index !== 0 && { ml: '$-3' })}
        >
          <Token size="sm" tokenImageUri={logoUrl} />
        </Stack>
      ))}
    </XStack>
  );
}

export function MarketBannerItem({ item, onPress }: IMarketBannerItemProps) {
  const { title, description, backgroundColor, tokenLogos } = item;
  const bgColor = convertBackgroundColor(backgroundColor);

  const descriptionColor = description?.fontColor || '$textSubdued';

  const handlePress = () => {
    onPress?.(item);
  };

  // Mobile layout: YStack (vertical)
  if (platformEnv.isNative) {
    return (
      <YStack
        bg={bgColor}
        borderRadius="$3"
        p="$3"
        gap="$2"
        minWidth={140}
        onPress={handlePress}
        pressStyle={{ opacity: 0.7 }}
        cursor="pointer"
      >
        <YStack gap="$1">
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {title}
          </SizableText>
          {description ? (
            <SizableText size="$bodySm" color={descriptionColor}>
              {description.text}
            </SizableText>
          ) : null}
        </YStack>
        <TokenIconsStack tokenLogos={tokenLogos} />
      </YStack>
    );
  }

  // Desktop layout: XStack (horizontal)
  return (
    <XStack
      bg={bgColor}
      borderRadius="$3"
      p="$3"
      gap="$4"
      alignItems="center"
      justifyContent="space-between"
      minWidth={180}
      onPress={handlePress}
      pressStyle={{ opacity: 0.7 }}
      cursor="pointer"
    >
      <YStack gap="$1" flex={1}>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {title}
        </SizableText>
        {description ? (
          <SizableText size="$bodySm" color={descriptionColor}>
            {description.text}
          </SizableText>
        ) : null}
      </YStack>
      <TokenIconsStack tokenLogos={tokenLogos} />
    </XStack>
  );
}

export function MarketBannerItemSkeleton() {
  // Mobile layout
  if (platformEnv.isNative) {
    return (
      <YStack bg="$bgSubdued" borderRadius="$3" p="$3" gap="$2" minWidth={140}>
        <YStack gap="$1">
          <Skeleton w="$20" h="$4" />
          <Skeleton w="$12" h="$3" />
        </YStack>
        <XStack>
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              w="$6"
              h="$6"
              radius="round"
              {...(i !== 0 && { ml: '$-3' })}
            />
          ))}
        </XStack>
      </YStack>
    );
  }

  // Desktop layout
  return (
    <XStack
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      gap="$4"
      alignItems="center"
      justifyContent="space-between"
      minWidth={180}
    >
      <YStack gap="$1">
        <Skeleton w="$20" h="$4" />
        <Skeleton w="$12" h="$3" />
      </YStack>
      <XStack>
        {[0, 1, 2].map((i) => (
          <Skeleton
            key={i}
            w="$6"
            h="$6"
            radius="round"
            {...(i !== 0 && { ml: '$-3' })}
          />
        ))}
      </XStack>
    </XStack>
  );
}
