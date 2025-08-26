import type { ReactNode } from 'react';

import { Page } from '@onekeyhq/components';

interface ITabPageHeaderContainerProps {
  children: ReactNode;
}

export function TabPageHeaderContainer({
  children,
}: ITabPageHeaderContainerProps) {
  return (
    <>
      <Page.Header headerTitle={() => children} />
    </>
  );
}
