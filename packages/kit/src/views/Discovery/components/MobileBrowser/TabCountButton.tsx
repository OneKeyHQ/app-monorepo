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

// Drawn to match the 24pt outline icons around it (back chevron, history
// clock): a 20pt rounded square with the same 2pt stroke, in a 24pt slot.
const GLYPH_SLOT = 24;
const GLYPH_SIZE = 20;
const GLYPH_STROKE = 2;

function TabCountButton({ testID, onPressed }: ITabCountButtonProps) {
  const { displayHomePage } = useDisplayHomePageFlag();
  const { tabs } = useWebTabs();
  const tabCount = useMemo(() => tabs.length, [tabs]);
  // Inside a Liquid Glass capsule the glass owns the shape and press feedback;
  // elsewhere it sits like a tertiary header IconButton (same padding and
  // negative margin), so it spaces evenly next to one.
  const inGlass = useInGlassHeader();
  const color = inGlass ? '$text' : '$iconSubdued';
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
        p={inGlass ? '$2' : '$1.5'}
        m={inGlass ? undefined : -7}
        borderRadius="$full"
        testID={testID}
      >
        <Stack
          minWidth={GLYPH_SLOT}
          h={GLYPH_SLOT}
          alignItems="center"
          justifyContent="center"
        >
          <Stack
            minWidth={GLYPH_SIZE}
            h={GLYPH_SIZE}
            px={tabCount > 99 ? 3 : 0}
            borderRadius={5}
            borderCurve="continuous"
            borderWidth={GLYPH_STROKE}
            borderColor={color}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText
              fontSize={tabCount > 9 ? 11 : 12}
              lineHeight={14}
              fontWeight="600"
              // Tight tracking so two digits read as one count, not as two
              // separate characters.
              letterSpacing={tabCount > 9 ? -0.8 : 0}
              color={color}
            >
              {tabCount}
            </SizableText>
          </Stack>
        </Stack>
      </Stack>
    </ChromePressable>
  );
}

export default TabCountButton;
