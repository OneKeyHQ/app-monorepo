import { useCallback, useMemo } from 'react';

import { SizableText, Stack, useInGlassHeader } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useTakeScreenshot } from '../../hooks/useTakeScreenshot';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabs,
} from '../../hooks/useWebTabs';

interface ITabCountButtonProps {
  testID: string;
  size?: 'medium' | 'large';
}

function TabCountButton({ testID, size = 'medium' }: ITabCountButtonProps) {
  const { displayHomePage } = useDisplayHomePageFlag();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const tabCount = useMemo(() => tabs.length, [tabs]);
  const isLarge = size === 'large';
  // Inside a Liquid Glass capsule the glass owns the shape and press feedback.
  const inGlass = useInGlassHeader();
  let padding: '$2' | '$3' | '$3.5' = isLarge ? '$3.5' : '$3';
  if (inGlass) {
    padding = '$2';
  }
  const takeScreenshot = useTakeScreenshot(activeTabId);

  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const handleShowTabList = useCallback(async () => {
    if (!displayHomePage) {
      await Promise.race([
        takeScreenshot(),
        timerUtils.setTimeoutPromised(undefined, 2000),
      ]);
    }
    navigation.pushModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.MobileTabList,
    });
  }, [takeScreenshot, navigation, displayHomePage]);

  if (displayHomePage && tabCount === 0) {
    return null;
  }

  return (
    <Stack
      p={padding}
      borderRadius="$full"
      pressStyle={
        inGlass
          ? undefined
          : {
              bg: '$bgActive',
            }
      }
      onPress={() => {
        void handleShowTabList();
      }}
      testID={testID}
    >
      <Stack
        minWidth={isLarge ? '$6' : '$5'}
        minHeight={isLarge ? '$6' : '$5'}
        borderRadius="$1"
        borderWidth="$0.5"
        borderColor="$iconSubdued"
        alignItems="center"
        justifyContent="center"
      >
        <SizableText size="$bodySmMedium" color="$iconSubdued">
          {tabCount}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export default TabCountButton;
