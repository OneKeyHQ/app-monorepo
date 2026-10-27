import type { ComponentProps, PropsWithChildren } from 'react';

import { YStack } from '@onekeyhq/components';

export function AppPagerContent({
  children,
  style,
}: PropsWithChildren<{ style?: ComponentProps<typeof YStack>['style'] }>) {
  return (
    <YStack flex={1} style={style}>
      {children}
    </YStack>
  );
}
