import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';

/** The pools pages' block: a subdued surface with an optional title row */
export function PoolsCard({
  title,
  right,
  children,
  testID,
  ...rest
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
  // `right` and `title` here are slots, not the style or HTML props
} & Omit<IYStackProps, 'children' | 'right' | 'title'>) {
  return (
    <YStack
      testID={testID}
      p="$5"
      gap="$4"
      borderRadius="$4"
      bg="$bgSubdued"
      {...rest}
    >
      {title || right ? (
        <XStack ai="center" jc="space-between" gap="$2">
          {title ? <SizableText size="$headingMd">{title}</SizableText> : null}
          {right}
        </XStack>
      ) : null}
      {children}
    </YStack>
  );
}
