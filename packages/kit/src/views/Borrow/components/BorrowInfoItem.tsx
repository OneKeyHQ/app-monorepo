import type { ReactNode } from 'react';

import { XStack } from '@onekeyhq/components';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

export function BorrowInfoItem({
  title,
  children,
}: {
  title: ReactNode | string;
  children?: ReactNode;
}) {
  const titleContent =
    typeof title === 'string' ? (
      <EarnText text={{ text: title }} color="$textSubdued" size="$bodyMd" />
    ) : (
      title
    );

  return (
    <XStack ai="flex-start" gap="$1" jc="space-between">
      {titleContent}
      <XStack ai="center" gap="$3">
        {children}
      </XStack>
    </XStack>
  );
}
