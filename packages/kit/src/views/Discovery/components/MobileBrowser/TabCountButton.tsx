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

import { ChromePressable } from './ChromePressable';

interface ITabCountButtonProps {
  testID: string;
  size?: 'medium' | 'large';
}

// Snapshot the current page for its tab card, then open the tab list.
function useShowMobileTabList() {
  const { displayHomePage } = useDisplayHomePageFlag();
  const { activeTabId } = useActiveTabId();
  const takeScreenshot = useTakeScreenshot(activeTabId);
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  return useCallback(async () => {
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
}

function TabCountButton({ testID, size = 'medium' }: ITabCountButtonProps) {
  const { displayHomePage } = useDisplayHomePageFlag();
  const { tabs } = useWebTabs();
  const tabCount = useMemo(() => tabs.length, [tabs]);
  const isLarge = size === 'large';
  // Inside a Liquid Glass capsule the glass owns the shape and press feedback.
  const inGlass = useInGlassHeader();
  let padding: '$2' | '$3' | '$3.5' = isLarge ? '$3.5' : '$3';
  if (inGlass) {
    padding = '$2';
  }
  const handleShowTabList = useShowMobileTabList();

  if (displayHomePage && tabCount === 0) {
    return null;
  }

  return (
    <ChromePressable
      onPress={() => {
        void handleShowTabList();
      }}
    >
      <Stack
        p={padding}
        borderRadius="$full"
        pressStyle={inGlass ? undefined : { bg: '$bgActive' }}
        testID={testID}
      >
        <Stack
          minWidth={isLarge ? '$6' : '$5'}
          minHeight={isLarge ? '$6' : '$5'}
          borderRadius="$1"
          borderWidth="$0.5"
          // Same contrast bump IconButton applies on glass.
          borderColor={inGlass ? '$text' : '$iconSubdued'}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText
            size="$bodySmMedium"
            color={inGlass ? '$text' : '$iconSubdued'}
          >
            {tabCount}
          </SizableText>
        </Stack>
      </Stack>
    </ChromePressable>
  );
}

export default TabCountButton;
