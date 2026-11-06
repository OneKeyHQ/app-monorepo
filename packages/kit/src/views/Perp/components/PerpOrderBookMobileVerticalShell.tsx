import type { ReactNode } from 'react';

import { type IColorTokens, YStack } from '@onekeyhq/components';

import type { LayoutChangeEvent } from 'react-native';

export function PerpOrderBookMobileVerticalShell({
  backgroundColor = '$bgApp',
  header,
  isLoading,
  loadingBody,
  onLayout,
  readyBody,
}: {
  backgroundColor?: IColorTokens;
  header: ReactNode;
  isLoading: boolean;
  loadingBody: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  readyBody: ReactNode;
}) {
  return (
    <YStack flex={1} bg={backgroundColor} gap="$1" onLayout={onLayout}>
      {header}
      {isLoading ? loadingBody : readyBody}
    </YStack>
  );
}
