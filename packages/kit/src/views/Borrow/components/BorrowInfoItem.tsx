import type { ReactNode } from 'react';

import { XStack } from '@onekeyhq/components';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

export function BorrowInfoItem({
  title,
  children,
  variant = 'default',
  gap = '$3',
}: {
  title: ReactNode | string;
  children?: ReactNode;
  gap?: string | number;
  variant?: 'default' | 'highlight';
}) {
  const isHighlight = variant === 'highlight';
  const titleContent =
    typeof title === 'string' ? (
      <EarnText
        text={{ text: title }}
        color={isHighlight ? '$text' : '$textSubdued'}
        size="$bodyMd"
      />
    ) : (
      title
    );

  return (
    <XStack ai="flex-start" gap="$1" jc="space-between">
      <XStack flexShrink={0}>{titleContent}</XStack>
      <XStack
        ai="center"
        jc="flex-end"
        gap={gap}
        flexWrap="wrap"
        flexGrow={1}
        flexShrink={1}
        flexBasis={0}
        minWidth={0}
      >
        {children}
      </XStack>
    </XStack>
  );
}
