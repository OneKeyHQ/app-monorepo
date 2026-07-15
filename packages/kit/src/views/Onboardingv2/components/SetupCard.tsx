import type { PropsWithChildren, ReactNode } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import { SizableText, YStack } from '@onekeyhq/components';

export interface ISetupCardProps extends PropsWithChildren<IYStackProps> {
  elevated?: boolean;
  title?: string;
  titleColor?: string;
  backgroundSlot?: ReactNode;
}

export function SetupCard({
  backgroundSlot,
  children,
  elevated,
  title,
  titleColor = '$text',
  ...rest
}: ISetupCardProps) {
  return (
    <YStack
      position="relative"
      overflow="hidden"
      borderRadius="$5"
      borderCurve="continuous"
      borderWidth={elevated ? 1 : 0}
      borderColor={elevated ? '$borderSubdued' : '$transparent'}
      bg={elevated ? '$bgSubdued' : '$transparent'}
      {...rest}
    >
      {backgroundSlot}
      {title ? (
        <SizableText
          px="$5"
          pt="$5"
          pb={children ? '$3' : '$5'}
          size="$headingSm"
          color={titleColor}
        >
          {title}
        </SizableText>
      ) : null}
      {children}
    </YStack>
  );
}

export function SetupCardBody({
  children,
  ...rest
}: PropsWithChildren<IYStackProps>) {
  return (
    <YStack px="$5" pb="$5" {...rest}>
      {children}
    </YStack>
  );
}
