import { useState } from 'react';

import { Divider, XStack, YStack, useIsSplitView } from '@onekeyhq/components';
import { useIsOnBoardingOpenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding';

import { SplitViewDetailFullscreenProvider } from './SplitViewDetailFullscreenContext';

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
  const display =
    isLandscape && !isOnBoardingOpen && !isDetailFullscreen ? 'flex' : 'none';
  return (
    <XStack flex={1}>
      <YStack flex={1} display={display}>
        {mainRouter}
      </YStack>
      <Divider vertical display={display} />
      <YStack flex={1}>
        <SplitViewDetailFullscreenProvider value={setIsDetailFullscreen}>
          {detailRouter}
        </SplitViewDetailFullscreenProvider>
      </YStack>
    </XStack>
  );
}
