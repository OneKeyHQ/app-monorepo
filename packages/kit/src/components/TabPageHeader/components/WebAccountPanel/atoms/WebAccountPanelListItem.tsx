import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export interface IWebAccountPanelListItemProps extends IXStackProps {
  renderLeft?: ReactNode;
  renderRight?: ReactNode;
}

export function WebAccountPanelListItem({
  renderLeft,
  renderRight,
  onPress,
  ...stackProps
}: IWebAccountPanelListItemProps) {
  const interactive = !!onPress;
  return (
    <XStack
      gap="$3"
      ai="center"
      minHeight={38}
      mx="$2.5"
      px="$2.5"
      py="$1.5"
      onPress={onPress}
      borderRadius="$3"
      role={interactive ? 'button' : undefined}
      cursor={interactive ? 'pointer' : undefined}
      hoverStyle={interactive ? { bg: '$bgHover' } : undefined}
      pressStyle={interactive ? { bg: '$bgActive' } : undefined}
      {...stackProps}
    >
      <YStack flex={1} minWidth={0} overflow="hidden" ai="flex-start">
        {typeof renderLeft === 'string' ? (
          <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
            {renderLeft}
          </SizableText>
        ) : (
          renderLeft
        )}
      </YStack>
      {renderRight ? (
        <XStack ai="center" overflow="hidden" flexShrink={0}>
          {renderRight}
        </XStack>
      ) : null}
    </XStack>
  );
}
