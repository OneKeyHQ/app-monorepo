import { useCallback, useRef, useState } from 'react';

import {
  Divider,
  XStack,
  YStack,
  useIsNativeTabletRealWidthMediaHeld,
  useIsSplitView,
} from '@onekeyhq/components';
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
  // Onboarding sets its open atom from a passive effect through async global
  // state, so on its own the main pane stays visible while onboarding first
  // lays out in the half-width detail pane. The real-width hold is acquired in
  // a layout effect, which hides the pane before that frame is painted.
  const isRealWidthMediaHeld = useIsNativeTabletRealWidthMediaHeld();
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  const layoutWidths = useRef({ container: 0, detail: 0 });
  const display =
    isLandscape &&
    !isOnBoardingOpen &&
    !isRealWidthMediaHeld &&
    !isDetailFullscreen
      ? 'flex'
      : 'none';
  const updateDetailOffset = useCallback(() => {
    const { container, detail } = layoutWidths.current;
    // Hidden/fullscreen layout events must not erase the last split geometry.
    if (display === 'flex' && detail > 0 && container > detail) {
      setDetailOffset(container - detail);
    }
  }, [display]);
  const onContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layoutWidths.current.container = event.nativeEvent.layout.width;
      updateDetailOffset();
    },
    [updateDetailOffset],
  );
  const onDetailLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (display !== 'flex') return;
      layoutWidths.current.detail = event.nativeEvent.layout.width;
      updateDetailOffset();
    },
    [display, updateDetailOffset],
  );
  return (
    <XStack
      flex={1}
      onLayout={platformEnv.isNativeAndroid ? onContainerLayout : undefined}
    >
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
