import type { ReactNode } from 'react';

import { YStack } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

export function PerpOrderBookMobileVerticalShell({
  header,
  isLoading,
  loadingBody,
  onLayout,
  readyBody,
}: {
  header: ReactNode;
  isLoading: boolean;
  loadingBody: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  readyBody: ReactNode;
}) {
  return (
    <YStack flex={1} bg="$bgApp" gap="$1" onLayout={onLayout}>
      {header}
      {isLoading ? loadingBody : readyBody}
    </YStack>
  );
}
