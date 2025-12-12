import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBannerItem } from '@onekeyhq/shared/types/marketV2';

type IMarketBannerItemProps = {
  item: IMarketBannerItem;
  onPress?: (item: IMarketBannerItem) => void;
  compact?: boolean;
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
          <Token size="xs" tokenImageUri={logoUrl} />
        </Stack>
      ))}
    </XStack>
  );
}

export function MarketBannerItem({
  item,
  onPress,
  compact,
}: IMarketBannerItemProps) {
  const { title, description, backgroundColor, tokenLogos } = item;
  const bgColor = convertBackgroundColor(backgroundColor);

  const descriptionColor = description?.fontColor || '$textSubdued';

  const handlePress = () => {
    onPress?.(item);
  };

  // Compact layout: Native or (md screens with 3+ banners)
  if (platformEnv.isNative || compact) {
    return (
      <YStack
        bg={bgColor}
        borderRadius="$3"
        p="$2.5"
        flex={1}
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
        <YStack gap="$1">
          <SizableText
            size="$bodySm"
            fontWeight="500"
            numberOfLines={2}
            maxWidth="$80"
            $md={{
              maxWidth: '$40',
            }}
          >
            {title}
          </SizableText>
          {description ? (
            <SizableText size="$bodyXs" color={descriptionColor}>
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
      flex={1}
      onPress={handlePress}
      animation="quick"
      borderWidth={1}
      borderColor="$transparent"
      hoverStyle={{ borderColor: '$borderHover' }}
      pressStyle={{ opacity: 0.7 }}
      cursor="pointer"
    >
      <YStack gap="$1" flex={1}>
        <SizableText size="$bodyMdMedium" numberOfLines={2} maxWidth="$40">
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
