import { StyleSheet } from 'react-native';

import type {
  ISizableTextProps,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  SizableText,
  XStack,
  YStack,
  withStaticProperties,
} from '@onekeyhq/components';

function CardHeader({ children }: IXStackProps) {
  return (
    <XStack alignItems="center" p="$5" gap="$3" bg="$neutral2">
      {children}
    </XStack>
  );
}

function CardTitle({ children, ...rest }: ISizableTextProps) {
  return (
    <SizableText size="$bodyMdMedium" {...rest}>
      {children}
    </SizableText>
  );
}

function CardBody({ children, ...rest }: IYStackProps) {
  return (
    <YStack
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$neutral3"
      p="$5"
      {...rest}
    >
      {children}
    </YStack>
  );
}

function CardRoot({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      $theme-dark={{
        borderWidth: 1,
        borderColor: '$borderSubdued',
      }}
      borderRadius="$5"
      borderCurve="continuous"
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-web={{
        boxShadow:
          '0 0.5px 0.5px 0 rgba(255, 255, 255, 0.1) inset, 0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

export const Card = withStaticProperties(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
});
