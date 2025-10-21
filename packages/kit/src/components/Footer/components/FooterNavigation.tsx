import type { ReactNode } from 'react';

import { XStack } from '@onekeyhq/components';

export interface IFooterNavigationProps {
  children: ReactNode;
}

export function FooterNavigation({ children }: IFooterNavigationProps) {
  return (
    <XStack gap="$2" alignItems="center">
      {children}
    </XStack>
  );
}
