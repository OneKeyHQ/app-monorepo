import { memo, useEffect, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { StatusBar, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import {
  IconButton,
  Stack,
  Theme,
  XStack,
  isLiquidGlassAvailable,
  setSystemBarsOverride,
  useSafeAreaInsets,
  useThemeName,
} from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';
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
import {
  BrowserChromeCapsule,
  useCapsuleFadeStyle,
} from './BrowserChromeCapsule';

import type { IMobileBrowserChrome } from './browserChrome';
import type { ICapsuleFade } from './BrowserChromeCapsule';

const HEADER_EDGE_INSET = 16;
// IconButton's medium padding ($1.5), so the glyph itself sits at the inset.
const MINIMIZE_BUTTON_PADDING = 6;
const ACCOUNT_CHIP_HEIGHT = 36;
const CLOSE_BUTTON_HIT_SLOP = { top: 5, bottom: 5, left: 8, right: 8 };
const CLOSE_ICON_PROPS = { color: '$icon' } as const;
// Concentric with the 24pt account avatar (4pt corners) inset 6pt: a rounded
// square chip instead of a pill, so the chip and avatar read as one shape.
const ACCOUNT_CHIP_RADIUS = 10;
const HEADER_BOTTOM_GAP = 6;

const styles = StyleSheet.create({
  // The header row, laid over the page right below the status bar and slid
  // up under it to collapse. Not clipped, so a pressed glass capsule's
  // growth shows in full.
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
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
const BROWSER_SYSTEM_BARS_OWNER = 'discovery-browser';

// System bars matching the page color while the browser is focused. Android
// pins the appearance module's override. iOS pushes a status bar stack entry
// (a <StatusBar> element would lose to pages mounted later, since the newest
// entry wins), re-pushed whenever the page theme changes.
function usePageStatusBarStyle(
  pageThemeName: 'light' | 'dark' | undefined,
  pageColor: string | undefined,
  appThemeName: string,
) {
  const isFocused = useIsFocused();
  // Android: the system bars (status bar surface and icons up to Android 14,
  // the window behind the edge-to-edge bars from 15, and the navigation bar)
  // are owned by the appearance module. Pin them to the page's color and
  // variant while the browser is foreground, in the browser's own slot (so
  // releasing it can't clear onboarding's), and release it after. Updated in
  // place on color changes rather than released and re-pinned.
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return;
    }
    setSystemBarsOverride(
      BROWSER_SYSTEM_BARS_OWNER,
      isFocused && pageThemeName
        ? { variant: pageThemeName, color: pageColor }
        : null,
    );
  }, [isFocused, pageThemeName, pageColor]);
  useEffect(
    () => () => {
      if (platformEnv.isNativeAndroid) {
        setSystemBarsOverride(BROWSER_SYSTEM_BARS_OWNER, null);
      }
    },
    [],
  );
  useEffect(() => {
    if (platformEnv.isNativeAndroid || !isFocused || !pageThemeName) {
      return;
    }
    const barStyle =
      pageThemeName === 'dark' ? 'light-content' : 'dark-content';
    const entry = StatusBar.pushStackEntry({ barStyle, animated: true });
    // Imperative writers (StatusBar.setBarStyle, e.g. the app appearance
    // module) bypass the stack and leave its cached value stale, so a later
    // push of the same style is skipped as "unchanged" and the wrong style
    // stays on screen. Re-assert once things settle (after a closing modal
    // or a late page-color update, or an app theme change, which repaints
    // the bar for the app theme) so the bar always ends on the page style.
    const timer = setTimeout(() => {
      StatusBar.setBarStyle(barStyle, true);
    }, STATUS_BAR_REASSERT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      StatusBar.popStackEntry(entry);
    };
  }, [isFocused, pageThemeName, appThemeName]);
}

// A 36pt header control: a Liquid Glass capsule when given a fade (iOS 26),
// else a plain box with an optional translucent fill. `chip` gives the
// account chip its concentric corners (avatar radius plus its inset) instead
// of a pill, which wouldn't match the square-ish avatar inside.
function HeaderChip({
  fade,
  px,
  bg,
  chip,
  children,
}: PropsWithChildren<{
  fade?: ICapsuleFade;
  px?: IXStackProps['px'];
  bg?: string;
  chip?: boolean;
}>) {
  if (fade) {
    return (
      <BrowserChromeCapsule
        height={ACCOUNT_CHIP_HEIGHT}
        px={px}
        fade={fade}
        borderRadius={chip ? ACCOUNT_CHIP_RADIUS : undefined}
      >
        {children}
      </BrowserChromeCapsule>
    );
  }
  return (
    <XStack
      h={ACCOUNT_CHIP_HEIGHT}
      px={px}
      bg={bg}
      borderRadius={ACCOUNT_CHIP_RADIUS}
      borderCurve="continuous"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </XStack>
  );
}

// The address lives in the bottom bar, so the header only keeps exit (back to
// the wallet, tabs kept) and the account. It collapses fully on scroll down.
// Once settled the page starts below it, not under it: dApps commonly pin a
// fixed header with their Connect button at the top. While it moves, the row
// is an overlay that only slides; its room in the layout follows
// layoutExpanded (see useMobileBrowserChromeAnimation).
function MobileBrowserHeader({
  chrome,
  onGoBackHome,
}: IMobileBrowserHeaderProps) {
  const { top } = useSafeAreaInsets();
  const { progress, layoutExpanded } = chrome;
  const isCollapsed = useIsChromeCollapsed(progress);
  // The row fades out in the first half of a collapse while it slides up
  // under the status bar. iOS 26: the exit button and the account chip are
  // Liquid Glass capsules, like the bottom bar; glass must not sit under a
  // fading parent, so there the row only slides and each capsule fades its
  // own glass and contents (same range).
  const isGlass = isLiquidGlassAvailable();
  const fade = useMemo<ICapsuleFade>(
    () => ({ progress, range: [BROWSER_CHROME_CROSSFADE_POINT, 1] }),
    [progress],
  );
  const rowFadeStyle = useCapsuleFadeStyle(isGlass ? undefined : fade);
  const rowSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -BROWSER_HEADER_HEIGHT * (1 - progress.value) }],
  }));
  const spacerStyle = useAnimatedStyle(() => ({
    height: BROWSER_HEADER_HEIGHT * layoutExpanded.value,
  }));
  // Tint like Safari: take the page's color, and switch icons/text/status bar
  // to the matching light or dark theme.
  const { activeTabId } = useActiveTabId();
  const { pageColor, pageThemeName } = usePageTheme(activeTabId);
  // Keep the Theme wrapper mounted (falling back to the app theme) so the
  // header subtree isn't remounted when the page color arrives.
  const appThemeName = useThemeName();
  usePageStatusBarStyle(pageThemeName, pageColor, appThemeName);
  // A translucent fill over the header color (the page's, or the app
  // background when the page reports none), so the chip takes on the page's
  // hue instead of a fixed gray that clashes with colored pages. Light
  // backgrounds need a stronger fill than dark ones to read as clearly.
  const chromeThemeName = pageThemeName ?? appThemeName;
  const pageColorStyle = pageColor ? { backgroundColor: pageColor } : undefined;
  const accountChipBg =
    chromeThemeName === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  const closeButton = (
    <IconButton
      variant="tertiary"
      m={0}
      // Leaves the browser for the wallet; tabs stay open.
      icon="CrossedLargeOutline"
      // 36pt button: extend to the 46pt header row and a bit sideways for an
      // easier target.
      hitSlop={CLOSE_BUTTON_HIT_SLOP}
      iconProps={CLOSE_ICON_PROPS}
      onPress={() => {
        // 'minimize' kept for analytics continuity.
        logBrowserChromeAction('minimize', 'header');
        onGoBackHome();
      }}
      testID={DiscoveryTestIDs.browserMinimizeButton}
    />
  );

  return (
    <Theme name={chromeThemeName}>
      <Stack
        pt={top}
        bg="$bgApp"
        // Above the page, so a pressed glass capsule's growth isn't covered.
        zIndex={1}
        style={pageColorStyle}
      >
        <Animated.View style={spacerStyle} />
        <Animated.View
          pointerEvents={isCollapsed ? 'none' : 'box-none'}
          style={[styles.overlay, { top }, rowSlideStyle, rowFadeStyle]}
        >
          <Stack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            bg="$bgApp"
            style={pageColorStyle}
          />
          {/* Tighter than the bottom bar, like a navigation bar: the exit
              glyph (or its glass circle) and the chip's right edge sit 16pt
              from the screen edges, in line with typical page content. */}
          <XStack
            flex={1}
            pl={
              isGlass
                ? HEADER_EDGE_INSET
                : HEADER_EDGE_INSET - MINIMIZE_BUTTON_PADDING
            }
            pr={HEADER_EDGE_INSET}
            alignItems="center"
            justifyContent="space-between"
          >
            {/* No padding: the 36pt button alone fills the 36pt capsule, so
                the glass is a circle. */}
            <HeaderChip fade={isGlass ? fade : undefined} px="$0">
              {closeButton}
            </HeaderChip>
            {/* One compact chip for every account state (connected,
                not connected, no wallet), so the right side keeps the same
                shape instead of switching between loose triggers. */}
            <HeaderChip
              fade={isGlass ? fade : undefined}
              px="$1"
              bg={accountChipBg}
              chip
            >
              {accountToolbar}
            </HeaderChip>
          </XStack>
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserHeader);
