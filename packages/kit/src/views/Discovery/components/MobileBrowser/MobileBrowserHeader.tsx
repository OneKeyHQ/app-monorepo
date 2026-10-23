import { memo } from 'react';

import { StatusBar, StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  IconButton,
  Stack,
  Theme,
  XStack,
  useSafeAreaInsets,
  useThemeName,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_HEADER_HEIGHT,
} from '../../config/Animation.constants';
import { useActiveTabId } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';
import { isDarkColor, usePageThemeColor } from '../../utils/pageThemeColor';
import HeaderRightToolBar from '../HeaderRightToolBar';

import { useChromeExpandedStyle, useIsChromeCollapsed } from './browserChrome';

import type { IMobileBrowserChrome } from './browserChrome';

const headerHeight = BROWSER_HEADER_HEIGHT;
const ACCOUNT_CHIP_HEIGHT = 36;
// Concentric with the 24pt account avatar (4pt corners) inset 6pt: a rounded
// square chip instead of a pill, so the chip and avatar read as one shape.
const ACCOUNT_CHIP_RADIUS = 10;

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
  // Tint like Safari: take the page's color, and switch icons/text/status bar
  // to the matching light or dark theme.
  const { activeTabId } = useActiveTabId();
  const pageColor = usePageThemeColor(activeTabId);
  // Keep the Theme wrapper mounted (falling back to the app theme) so the
  // header subtree isn't remounted when the page color arrives.
  const appThemeName = useThemeName();
  let pageThemeName: 'light' | 'dark' | undefined;
  if (pageColor) {
    pageThemeName = isDarkColor(pageColor) ? 'dark' : 'light';
  }
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, headerHeight], 'clamp'),
  }));

  return (
    <Theme name={pageThemeName ?? appThemeName}>
      <Stack
        pt={top}
        bg="$bgApp"
        style={pageColor ? { backgroundColor: pageColor } : undefined}
      >
        {pageThemeName ? (
          <StatusBar
            animated
            barStyle={
              pageThemeName === 'dark' ? 'light-content' : 'dark-content'
            }
          />
        ) : null}
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
                h={ACCOUNT_CHIP_HEIGHT}
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
                borderRadius={ACCOUNT_CHIP_RADIUS}
                borderCurve="continuous"
                alignItems="center"
              >
                <HeaderRightToolBar variant="mobileBrowser" />
              </XStack>
            </XStack>
          </Animated.View>
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserHeader);
