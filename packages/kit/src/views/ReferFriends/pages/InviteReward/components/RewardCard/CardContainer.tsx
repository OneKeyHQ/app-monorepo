import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';

import type { IYStackProps } from '@onekeyhq/components';
import { YStack } from '@onekeyhq/components';

export interface ICardContainerProps extends IYStackProps {
  children?: ReactNode;
  onPress?: () => void;
}

export function CardContainer({
  children,
  onPress,
  ...rest
}: ICardContainerProps) {
  return (
    <YStack
      gap="$4"
      px="$4"
      pt="$4"
      pb="$4"
      bg="$bgSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      onPress={onPress}
      cursor={onPress ? 'pointer' : undefined}
      {...rest}
    >
      {children}
    </YStack>
  );
}
