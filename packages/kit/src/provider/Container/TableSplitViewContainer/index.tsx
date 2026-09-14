import { useCallback, useState } from 'react';

import { Divider, XStack, YStack, useIsSplitView } from '@onekeyhq/components';
import { useIsOnBoardingOpenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SplitViewDetailFullscreenProvider } from './SplitViewDetailFullscreenContext';
import { SplitViewDetailOffsetProvider } from './SplitViewDetailOffsetContext';

import type { LayoutChangeEvent } from 'react-native';

export { useSetSplitViewDetailFullscreen } from './SplitViewDetailFullscreenContext';

export function TableSplitViewContainer({
  mainRouter,
  detailRouter,
}: {
  mainRouter: React.ReactNode;
  detailRouter: React.ReactNode;
}) {
  const isLandscape = useIsSplitView();
  const [isOnBoardingOpen] = useIsOnBoardingOpenAtom();
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  const onDetailLayout = useCallback((event: LayoutChangeEvent) => {
    setDetailOffset(event.nativeEvent.layout.x);
  }, []);
  const display =
    isLandscape && !isOnBoardingOpen && !isDetailFullscreen ? 'flex' : 'none';
  return (
    <XStack flex={1}>
      <YStack flex={1} display={display}>
        {mainRouter}
      </YStack>
      <Divider vertical display={display} />
      <YStack
        flex={1}
        onLayout={platformEnv.isNativeAndroid ? onDetailLayout : undefined}
      >
        <SplitViewDetailFullscreenProvider value={setIsDetailFullscreen}>
          <SplitViewDetailOffsetProvider
            value={
              platformEnv.isNativeAndroid && display === 'flex'
                ? detailOffset
                : 0
            }
          >
            {detailRouter}
          </SplitViewDetailOffsetProvider>
        </SplitViewDetailFullscreenProvider>
      </YStack>
    </XStack>
  );
}
