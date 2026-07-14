import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import { XStack, YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';

import { useThemeVariant } from '../../../hooks/useThemeVariant';

type IReceiveCardProps = {
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  testID?: string;
} & IYStackProps;

export function ReceiveCardCell({ children, ...rest }: IYStackProps) {
  const themeVariant = useThemeVariant();
  return (
    <YStack
      bg={themeVariant === 'dark' ? '$whiteA1' : '$bg'}
      borderRadius="$2.5"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      width="100%"
      {...rest}
    >
      {children}
    </YStack>
  );
}

export function ReceiveCard({
  headerLeft,
  headerRight,
  children,
  testID,
  ...rest
}: IReceiveCardProps) {
  return (
    <YStack
      testID={testID}
      bg="$bgSubdued"
      borderRadius={14}
      borderCurve="continuous"
      p="$1"
      gap="$1"
      width="100%"
      {...rest}
    >
      {headerLeft || headerRight ? (
        <XStack
          h={40}
          px="$3"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
        >
          {headerLeft}
          {headerRight}
        </XStack>
      ) : null}
      {children}
    </YStack>
  );
}
