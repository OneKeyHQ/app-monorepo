import { memo } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  IconButton,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_HEADER_HEIGHT,
} from '../../config/Animation.constants';
import { DiscoveryTestIDs } from '../../testIDs';
import HeaderRightToolBar from '../HeaderRightToolBar';

import { useChromeExpandedStyle, useIsChromeCollapsed } from './browserChrome';

import type { IMobileBrowserChrome } from './browserChrome';

const headerHeight = BROWSER_HEADER_HEIGHT;
const ACCOUNT_CHIP_HEIGHT = 36;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  // Anchored to the bottom so the row slides up under the status bar while the
  // container shrinks, instead of being squashed.
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: headerHeight,
  },
});

interface IMobileBrowserHeaderProps {
  chrome: IMobileBrowserChrome;
  onGoBackHome: () => void;
}

// Safari-style: the address lives in the bottom bar, so the header only keeps
// "back to Explore" and the account. It collapses fully while scrolling down.
// It stays in the layout (the page starts below it) rather than floating:
// dApps commonly pin a fixed header with their Connect button at the top,
// which a floating header would cover.
function MobileBrowserHeader({
  chrome,
  onGoBackHome,
}: IMobileBrowserHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { progress } = chrome;
  const isCollapsed = useIsChromeCollapsed(progress);
  const expandedStyle = useChromeExpandedStyle(progress, {
    hiddenOffsetY: -8,
  });
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, headerHeight], 'clamp'),
  }));

  return (
    <Stack pt={top} bg="$bgApp">
      <Animated.View style={[styles.container, containerAnimatedStyle]}>
        <Animated.View
          pointerEvents={isCollapsed ? 'none' : 'box-none'}
          style={[styles.content, expandedStyle]}
        >
          {/* A plain toolbar, not glass: the header sits on the app
              background above the page, where glass would only show its
              shadow halo. Glass is kept for the bar that floats over content.
              Edges line up with the bottom bar: same side padding, and the
              minimize icon sits in a capsule-sized slot so it shares a column
              with the back button below; the chip's right edge matches the
              tabs button. */}
          <XStack
            flex={1}
            px={BROWSER_CHROME_SIDE_PADDING}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack
              w={BROWSER_CHROME_CAPSULE_HEIGHT}
              h={BROWSER_CHROME_CAPSULE_HEIGHT}
              alignItems="center"
              justifyContent="center"
            >
              <IconButton
                variant="tertiary"
                m={0}
                icon="MinimizeOutline"
                iconProps={{ color: '$icon' }}
                onPress={() => {
                  defaultLogger.discovery.browser.browserToolbarAction({
                    action: 'minimize',
                    entry: 'header',
                  });
                  onGoBackHome();
                }}
                testID={DiscoveryTestIDs.browserMinimizeButton}
              />
            </Stack>
            {/* One compact chip for every account state (connected,
                not connected, no wallet), so the right side keeps the same
                shape instead of switching between loose triggers. */}
            <XStack
              h={ACCOUNT_CHIP_HEIGHT}
              px="$1"
              bg="$bgSubdued"
              borderRadius="$full"
              borderCurve="continuous"
              alignItems="center"
            >
              <HeaderRightToolBar variant="mobileBrowser" />
            </XStack>
          </XStack>
        </Animated.View>
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserHeader);
