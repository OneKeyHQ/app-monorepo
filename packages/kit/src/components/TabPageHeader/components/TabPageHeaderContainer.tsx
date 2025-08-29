import type { ReactNode } from 'react';

import { Page, XStack } from '@onekeyhq/components';

interface ITabPageHeaderContainerProps {
  children: ReactNode;
}

export function TabPageHeaderContainer({
  children,
}: ITabPageHeaderContainerProps) {
  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        width="100%"
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        h="$11"
      >
        {children}
      </XStack>
    </>
  );
}
