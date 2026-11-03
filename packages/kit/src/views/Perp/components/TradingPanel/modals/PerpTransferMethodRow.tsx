import type { ReactNode } from 'react';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

export function PerpTransferMethodRow({
  testID,
  icon,
  title,
  subtitle,
  hint,
  onPress,
  disabled,
}: {
  testID: string;
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  subtitle: string;
  hint?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      testID={testID}
      variant="tertiary"
      childrenAsText={false}
      alignSelf="stretch"
      height="auto"
      minHeight="$14"
      borderRadius="$3"
      mx="$-2"
      px="$2"
      py="$3"
      cursor="pointer"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      disabled={disabled}
    >
      <XStack flex={1} alignSelf="stretch" alignItems="center" gap="$2.5">
        <Stack width="$7" alignItems="flex-start">
          <Icon name={icon} color="$icon" size="$6" />
        </Stack>
        <YStack flex={1} minWidth={0} alignItems="flex-start" gap="$1">
          <SizableText
            width="100%"
            size="$bodyMdMedium"
            color="$text"
            textAlign="left"
            numberOfLines={1}
          >
            {title}
          </SizableText>
          <SizableText
            width="100%"
            size="$bodySm"
            color="$textSubdued"
            textAlign="left"
            numberOfLines={2}
          >
            {subtitle}
          </SizableText>
        </YStack>
        <XStack alignItems="center" gap="$1">
          {hint}
          <Icon
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
            size="$4"
          />
        </XStack>
      </XStack>
    </Button>
  );
}
