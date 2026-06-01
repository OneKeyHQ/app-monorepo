import type { ReactNode } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export interface IWebAccountPanelSectionTitleProps extends IXStackProps {
  children: ReactNode;
}

export function WebAccountPanelSectionTitle({
  children,
  ...stackProps
}: IWebAccountPanelSectionTitleProps) {
  return (
    <XStack ai="center" pb="$3" px="$5" w="100%" {...stackProps}>
      <SizableText flex={1} size="$bodyMd" color="$textSubdued">
        {children}
      </SizableText>
    </XStack>
  );
}
