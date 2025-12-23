import type { ReactNode } from 'react';

import { Page, XStack, useSafeAreaInsets } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface ITabPageHeaderContainerProps {
  children: ReactNode;
}

export function TabPageHeaderContainer({
  children,
}: ITabPageHeaderContainerProps) {
  const { top } = useSafeAreaInsets();

  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        h="$12"
        {...(top || platformEnv.isNativeAndroid ? { mt: top || '$2' } : {})}
      >
        {children}
      </XStack>
    </>
  );
}
