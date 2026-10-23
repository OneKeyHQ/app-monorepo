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

const TABULAR_NUMS = { fontVariant: ['tabular-nums' as const] };

interface ITabCountButtonProps {
  testID: string;
  size?: 'medium' | 'large';
  // Called on press, before the tab list opens (e.g. for analytics).
  onPressed?: () => void;
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

function TabCountButton({
  testID,
  size = 'medium',
  onPressed,
}: ITabCountButtonProps) {
  const { displayHomePage } = useDisplayHomePageFlag();
  const { tabs } = useWebTabs();
  const tabCount = useMemo(() => tabs.length, [tabs]);
  const isLarge = size === 'large';
  const badgeSize = isLarge ? 24 : 22;
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
        onPressed?.();
        void handleShowTabList();
      }}
    >
      <Stack
        p={padding}
        borderRadius="$full"
        pressStyle={inGlass ? undefined : { bg: '$bgActive' }}
        testID={testID}
      >
        {/* Drawn like an SF Symbol: a square with a 1.5pt stroke and
            continuous corners, sized so two-digit counts fit inside it. */}
        <Stack
          minWidth={badgeSize}
          h={badgeSize}
          px={tabCount > 99 ? 3 : 0}
          borderRadius={6}
          borderCurve="continuous"
          borderWidth={1.5}
          // Same contrast bump IconButton applies on glass.
          borderColor={inGlass ? '$text' : '$iconSubdued'}
          alignItems="center"
          justifyContent="center"
        >
          <SizableText
            size="$bodySmMedium"
            fontWeight="600"
            style={TABULAR_NUMS}
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
