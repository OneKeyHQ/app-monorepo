import type { ReactNode } from 'react';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';

/**
 * A titled section's head on the phone home, the row Trending tokens and
 * Fixed Income have (AvailableAssetsFlatList): the chevron hugs the title and
 * the whole row opens the section's page. Without a page to open there is no
 * chevron and nothing to press. Anything trailing sits on the right
 */
export function EarnPhoneSectionTitle({
  title,
  testID,
  onPress,
  trailing,
}: {
  title: string;
  testID: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <XStack
      testID={testID}
      role={onPress ? 'button' : undefined}
      minHeight="$12"
      px="$pagePadding"
      py="$1"
      ai="center"
      gap="$1"
      cursor={onPress ? 'pointer' : undefined}
      userSelect="none"
      pressStyle={onPress ? { opacity: 0.5 } : undefined}
      onPress={onPress}
    >
      <SizableText size="$headingLg" pointerEvents="none">
        {title}
      </SizableText>
      {onPress ? (
        <Icon
          name="ChevronRightSmallOutline"
          size="$5"
          color="$iconSubdued"
          pointerEvents="none"
        />
      ) : null}
      {trailing ? (
        <Stack flex={1} ai="flex-end" pointerEvents="none">
          {trailing}
        </Stack>
      ) : null}
    </XStack>
  );
}
