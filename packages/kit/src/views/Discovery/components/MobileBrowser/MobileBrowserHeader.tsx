import { memo, useEffect } from 'react';

import { useIsFocused } from '@react-navigation/native';
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

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_HEADER_HEIGHT,
} from '../../config/Animation.constants';
import { useActiveTabId } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';
import { usePageTheme } from '../../utils/pageThemeColor';
import HeaderRightToolBar from '../HeaderRightToolBar';

import { logBrowserChromeAction, useIsChromeCollapsed } from './browserChrome';

import type { IMobileBrowserChrome } from './browserChrome';

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
    height: BROWSER_HEADER_HEIGHT,
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
// Status bar text matching the page color. A <StatusBar> element would lose to
// pages mounted later (other tabs, lazily mounted screens) since the newest
// stack entry wins, so push an entry while the browser is focused and
// re-push whenever the page theme changes.
function usePageStatusBarStyle(pageThemeName: 'light' | 'dark' | undefined) {
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || !pageThemeName) {
      return;
    }
    const entry = StatusBar.pushStackEntry({
      barStyle: pageThemeName === 'dark' ? 'light-content' : 'dark-content',
      animated: true,
    });
    return () => {
      StatusBar.popStackEntry(entry);
    };
  }, [isFocused, pageThemeName]);
}

function MobileBrowserHeader({
  chrome,
  onGoBackHome,
}: IMobileBrowserHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { progress } = chrome;
  const isCollapsed = useIsChromeCollapsed(progress);
  // Fades out (with a small upward slide) in the first half of a collapse,
  // so the row is gone before its height reaches zero.
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BROWSER_CHROME_CROSSFADE_POINT, 1],
      [0, 1],
      'clamp',
    ),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [-8, 0], 'clamp') },
    ],
  }));
  // Tint like Safari: take the page's color, and switch icons/text/status bar
  // to the matching light or dark theme.
  const { activeTabId } = useActiveTabId();
  const { pageColor, pageThemeName } = usePageTheme(activeTabId);
  // Keep the Theme wrapper mounted (falling back to the app theme) so the
  // header subtree isn't remounted when the page color arrives.
  const appThemeName = useThemeName();
  usePageStatusBarStyle(pageThemeName);
  // A translucent fill over the page color, so the chip takes on the page's
  // hue instead of a fixed gray that clashes with colored pages.
  let accountChipBg = '$bgSubdued';
  if (pageThemeName) {
    accountChipBg =
      pageThemeName === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  }
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [0, BROWSER_HEADER_HEIGHT],
      'clamp',
    ),
  }));

  return (
    <Theme name={pageThemeName ?? appThemeName}>
      <Stack
        pt={top}
        bg="$bgApp"
        style={pageColor ? { backgroundColor: pageColor } : undefined}
      >
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
                    logBrowserChromeAction('minimize', 'header');
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
                bg={accountChipBg}
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
