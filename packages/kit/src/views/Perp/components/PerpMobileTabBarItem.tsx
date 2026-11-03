import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

export const PerpMobileTabBarItem = memo(
  ({
    label,
    isFocused,
    onPress,
    testID,
  }: {
    label: string;
    isFocused: boolean;
    onPress: () => void;
    testID?: string;
  }) => (
    <XStack
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      py="$2"
      borderBottomWidth={1.5}
      borderBottomColor={isFocused ? '$borderActive' : 'transparent'}
      onPress={onPress}
      cursor="pointer"
    >
      <SizableText
        size="$headingXs"
        textTransform="none"
        letterSpacing={0}
        color={isFocused ? '$text' : '$textSubdued'}
        pr="$0.5"
      >
        {label}
      </SizableText>
    </XStack>
  ),
);

PerpMobileTabBarItem.displayName = 'PerpMobileTabBarItem';
