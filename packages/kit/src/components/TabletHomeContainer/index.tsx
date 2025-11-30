import type { PropsWithChildren } from 'react';

import { Image, SizableText, YStack } from '@onekeyhq/components';

import { useIsTabletDetailView } from '../../hooks/useTabletMode';

export function TabletHomeContainer({ children }: PropsWithChildren) {
  const isDetailView = useIsTabletDetailView();

  if (isDetailView) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
        <Image source={require('@onekeyhq/kit/assets/logo.png')} size={124} />
        <SizableText size="$heading5xl">OneKey</SizableText>
      </YStack>
    );
  }

  return children;
}
