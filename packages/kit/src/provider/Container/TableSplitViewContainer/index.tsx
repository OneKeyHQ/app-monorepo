import { useEffect, useState } from 'react';

import { Dimensions } from 'react-native';

import { Divider, XStack, YStack, useIsSplitView } from '@onekeyhq/components';
import { useIsOnBoardingOpenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding';
import {
  createOk60835TabBarLogInstance,
  ok60835TabBarLog,
} from '@onekeyhq/shared/src/utils/debug/ok60835TabBarLog';

export function TableSplitViewContainer({
  mainRouter,
  detailRouter,
}: {
  mainRouter: React.ReactNode;
  detailRouter: React.ReactNode;
}) {
  const [debugInstanceId] = useState(() =>
    createOk60835TabBarLogInstance('table-split-container'),
  );
  const isLandscape = useIsSplitView('TableSplitViewContainer');
  const [isOnBoardingOpen] = useIsOnBoardingOpenAtom();
  const display = isLandscape && !isOnBoardingOpen ? 'flex' : 'none';

  useEffect(() => {
    const windowDimensions = Dimensions.get('window');
    const screenDimensions = Dimensions.get('screen');
    ok60835TabBarLog('split-container-decision', {
      instance: debugInstanceId,
      isLandscape,
      isOnBoardingOpen,
      mainDisplay: display,
      windowWidth: windowDimensions.width,
      windowHeight: windowDimensions.height,
      screenWidth: screenDimensions.width,
      screenHeight: screenDimensions.height,
    });
  }, [debugInstanceId, display, isLandscape, isOnBoardingOpen]);

  return (
    <XStack flex={1}>
      <YStack flex={1} display={display}>
        {mainRouter}
      </YStack>
      <Divider vertical display={display} />
      <YStack flex={1}>{detailRouter}</YStack>
    </XStack>
  );
}
