import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

function ConnectionIndicatorCard({ children }: { children: ReactNode }) {
  return (
    <YStack
      borderRadius={10}
      borderCurve="continuous"
      $platform-web={{
        boxShadow: '0 1px 1px 0 rgba(0, 0, 0, 0.20)',
      }}
      // $platform-android={{ elevation: 0.1 }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      bg="$bg"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorAnimation({ children }: { children: ReactNode }) {
  return (
    <YStack
      h={320}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorContent({
  children,
  ...rest
}: {
  children: ReactNode;
} & IYStackProps) {
  return (
    <YStack
      px="$5"
      py="$4"
      borderWidth={0}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      $platform-web={{
        borderStyle: 'dashed',
      }}
      {...rest}
    >
      {children}
    </YStack>
  );
}

function ConnectionIndicatorTitle({ children }: { children: ReactNode }) {
  return <SizableText size="$bodyMdMedium">{children}</SizableText>;
}

function ConnectionIndicatorFooter({ children }: { children: ReactNode }) {
  return (
    <YStack pt="$5" pb="$2" gap="$2">
      {children}
    </YStack>
  );
}

function ConnectionIndicatorRoot({ children }: { children: ReactNode }) {
  return (
    <YStack
      $platform-web={{
        boxShadow:
          '0 1px 1px 0 rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05), 0 4px 6px 0 rgba(0, 0, 0, 0.04), 0 24px 68px 0 rgba(0, 0, 0, 0.05), 0 2px 3px 0 rgba(0, 0, 0, 0.04)',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
        bg: '$neutral4',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral4',
      }}
      overflow="hidden"
      borderRadius={10}
      borderCurve="continuous"
      bg="$bgSubdued"
      animation="quick"
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      enterStyle={{
        opacity: 0,
        x: 24,
      }}
    >
      {children}
    </YStack>
  );
}

export const ConnectionIndicator = Object.assign(ConnectionIndicatorRoot, {
  Animation: ConnectionIndicatorAnimation,
  Card: ConnectionIndicatorCard,
  Content: ConnectionIndicatorContent,
  Title: ConnectionIndicatorTitle,
  Footer: ConnectionIndicatorFooter,
});
