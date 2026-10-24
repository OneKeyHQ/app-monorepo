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
  setSystemBarsOverride,
  useSafeAreaInsets,
  useThemeName,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BROWSER_CHROME_CROSSFADE_POINT,
  BROWSER_HEADER_HEIGHT,
} from '../../config/Animation.constants';
import { useActiveTabId } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';
import { usePageTheme } from '../../utils/pageThemeColor';
import HeaderRightToolBar from '../HeaderRightToolBar';

import { logBrowserChromeAction, useIsChromeCollapsed } from './browserChrome';

import type { IMobileBrowserChrome } from './browserChrome';

const HEADER_EDGE_INSET = 16;
// IconButton's medium padding ($1.5), so the glyph itself sits at the inset.
const MINIMIZE_BUTTON_PADDING = 6;
const ACCOUNT_CHIP_HEIGHT = 36;
// Concentric with the 24pt account avatar (4pt corners) inset 6pt: a rounded
// square chip instead of a pill, so the chip and avatar read as one shape.
const ACCOUNT_CHIP_RADIUS = 10;
const HEADER_BOTTOM_GAP = 6;

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
    // The status bar area above already leaves room, so the row sits high
    // and keeps a clear gap between the account chip and the page below.
    paddingBottom: HEADER_BOTTOM_GAP,
  },
});

// Hoisted: the same element across renders lets React skip the heavy account
// subtree when the header re-renders on collapse or page-theme changes.
const accountToolbar = <HeaderRightToolBar variant="mobileBrowser" />;

interface IMobileBrowserHeaderProps {
  chrome: IMobileBrowserChrome;
  onGoBackHome: () => void;
}

const STATUS_BAR_REASSERT_DELAY_MS = 400;

// System bars matching the page color while the browser is focused. Android
// pins the appearance module's override. iOS pushes a status bar stack entry
// (a <StatusBar> element would lose to pages mounted later, since the newest
// entry wins), re-pushed whenever the page theme changes.
function usePageStatusBarStyle(pageThemeName: 'light' | 'dark' | undefined) {
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || !pageThemeName) {
      return;
    }
    // Android: the system bars (status bar icons, navigation bar, and the
    // window behind edge-to-edge bars) have one owner, the appearance
    // module; pin it to the page's variant while the browser is foreground,
    // like onboarding does, and hand it back after.
    if (platformEnv.isNativeAndroid) {
      setSystemBarsOverride(pageThemeName);
      return () => {
        setSystemBarsOverride(null);
      };
    }
    const barStyle =
      pageThemeName === 'dark' ? 'light-content' : 'dark-content';
    const entry = StatusBar.pushStackEntry({ barStyle, animated: true });
    // Imperative writers (StatusBar.setBarStyle, e.g. the app appearance
    // module) bypass the stack and leave its cached value stale, so a later
    // push of the same style is skipped as "unchanged" and the wrong style
    // stays on screen. Re-assert once things settle (after a closing modal
    // or a late page-color update) so the bar always ends on the page style.
    const timer = setTimeout(() => {
      StatusBar.setBarStyle(barStyle, true);
    }, STATUS_BAR_REASSERT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      StatusBar.popStackEntry(entry);
    };
  }, [isFocused, pageThemeName]);
}

// The address lives in the bottom bar, so the header only keeps exit (back to
// the wallet, tabs kept) and the account. It collapses fully on scroll down.
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
  // A translucent fill over the header color (the page's, or the app
  // background when the page reports none), so the chip takes on the page's
  // hue instead of a fixed gray that clashes with colored pages. Light
  // backgrounds need a stronger fill than dark ones to read as clearly.
  const chromeThemeName = pageThemeName ?? appThemeName;
  const accountChipBg =
    chromeThemeName === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [0, BROWSER_HEADER_HEIGHT],
      'clamp',
    ),
  }));

  return (
    <Theme name={chromeThemeName}>
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
              Tighter than the bottom bar, like a navigation bar: the
              exit glyph and the chip's right edge sit 16pt from the
              screen edges, in line with typical page content. */}
            <XStack
              flex={1}
              pl={HEADER_EDGE_INSET - MINIMIZE_BUTTON_PADDING}
              pr={HEADER_EDGE_INSET}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack
                h={ACCOUNT_CHIP_HEIGHT}
                alignItems="center"
                justifyContent="center"
              >
                <IconButton
                  variant="tertiary"
                  m={0}
                  // Leaves the browser for the wallet; tabs stay open.
                  icon="CrossedLargeOutline"
                  // 36pt button: extend to the 46pt header row and a bit
                  // sideways for an easier target.
                  hitSlop={{ top: 5, bottom: 5, left: 8, right: 8 }}
                  iconProps={{ color: '$icon' }}
                  onPress={() => {
                    // 'minimize' kept for analytics continuity.
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
                {accountToolbar}
              </XStack>
            </XStack>
          </Animated.View>
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserHeader);
