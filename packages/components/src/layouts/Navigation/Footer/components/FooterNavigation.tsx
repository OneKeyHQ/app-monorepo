import type { ReactNode } from 'react';

import { XStack } from '@onekeyhq/components/src/primitives';

export interface IFooterNavigationProps {
  children: ReactNode;
}

export function FooterNavigation({ children }: IFooterNavigationProps) {
  return (
    <XStack gap="$3.75" alignItems="center">
      {children}
    </XStack>
  );
}
