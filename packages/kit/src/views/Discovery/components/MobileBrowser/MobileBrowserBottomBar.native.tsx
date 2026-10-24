import { memo, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  IconButton,
  LinearGradient,
  SizableText,
  Stack,
  Theme,
  XStack,
  useThemeName,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';
import { usePageTheme, withAlpha } from '../../utils/pageThemeColor';

import { AddressCapsuleTitle } from './AddressCapsuleTitle';
import {
  CAPSULE_BUTTON_HIT_SLOP,
  getBarCapsuleBottom,
  getBarReservedHeight,
  getCollapsedPillBottom,
  getCollapsedReservedHeight,
  getDisplayHostname,
  logBrowserChromeAction,
  useIsChromeCollapsed,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';
import { ChromePressable } from './ChromePressable';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';
import { useMobileBrowserOptions } from './useMobileBrowserOptions';

import type { IGlassFade } from './BrowserChromeCapsule';
import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  // Bottom-anchored so the in-flow (tablet) container can shrink to the pill
  // zone while the bar fades out above it.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_CHROME_CAPSULE_HEIGHT,
  },
  capsule: { flex: 1 },
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_COLLAPSED_PILL_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

const STRIP_FADE_HEIGHT = 16;
const PILL_HIT_SLOP = { vertical: 8, horizontal: 16 };

// Fade ranges of the bar/pill morph (progress: 1 = expanded, 0 = collapsed).
const SIDE_FADE_START = 0.4;
const CAPSULE_FADE_START = 0.25;
const PILL_FADE_END = 0.75;
// The side buttons move this far towards the center while collapsing, and
// shrink to this scale.
const SIDE_COLLAPSE_TRAVEL_X = 40;
const SIDE_COLLAPSED_SCALE = 0.5;

// Collapsed size of the address capsule, about the pill's size.
const CAPSULE_COLLAPSED_SCALE =
  BROWSER_COLLAPSED_PILL_HEIGHT / BROWSER_CHROME_CAPSULE_HEIGHT;

// Morphs the address capsule into the collapsed pill (and back), like
// Safari: the capsule shrinks and slides down to the pill's spot while the
// pill grows out of it; the side buttons shrink and fade towards the
// pill, so the whole bar draws into its center. Both
// layers overlap mid-way so it reads as one element changing shape.
function useBarMorphStyles(progress: SharedValue<number>, travelY: number) {
  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [SIDE_FADE_START, 1], [0, 1], 'clamp'),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [SIDE_COLLAPSE_TRAVEL_X, 0],
          'clamp',
        ),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [travelY, 0], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [SIDE_COLLAPSED_SCALE, 1],
          'clamp',
        ),
      },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [SIDE_FADE_START, 1], [0, 1], 'clamp'),
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-SIDE_COLLAPSE_TRAVEL_X, 0],
          'clamp',
        ),
      },
      {
        translateY: interpolate(progress.value, [0, 1], [travelY, 0], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [SIDE_COLLAPSED_SCALE, 1],
          'clamp',
        ),
      },
    ],
  }));
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [CAPSULE_FADE_START, PILL_FADE_END],
      [0, 1],
      'clamp',
    ),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [travelY, 0], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [CAPSULE_COLLAPSED_SCALE, 1],
          'clamp',
        ),
      },
    ],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [CAPSULE_FADE_START, PILL_FADE_END],
      [1, 0],
      'clamp',
    ),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [0, -travelY], 'clamp'),
      },
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [1, 1 / CAPSULE_COLLAPSED_SCALE],
          'clamp',
        ),
      },
    ],
  }));
  return { leftStyle, rightStyle, capsuleStyle, pillStyle };
}

// The translate sheet is opened from the menu; this anchor only positions the
// tablet popover, out of the layout flow so it doesn't shift the address.
const translatePopoverAnchor = <Stack position="absolute" w={1} h={1} />;

function CollapsedAddressPill({
  url,
  onPress,
  glassFade,
}: {
  url?: string;
  onPress?: () => void;
  glassFade: IGlassFade;
}) {
  const hostname = useMemo(() => getDisplayHostname(url), [url]);
  return (
    <BrowserChromeCapsule
      height={BROWSER_COLLAPSED_PILL_HEIGHT}
      px="$4"
      glassFade={glassFade}
    >
      {/* The pill is 30pt tall; extend its tap area to ~46pt and over its
        side padding. */}
      <ChromePressable onPress={onPress} hitSlop={PILL_HIT_SLOP}>
        <XStack
          h={BROWSER_COLLAPSED_PILL_HEIGHT}
          alignItems="center"
          testID={DiscoveryTestIDs.browserCollapsedHeader}
        >
          <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth={220}>
            {hostname}
          </SizableText>
        </XStack>
      </ChromePressable>
    </BrowserChromeCapsule>
  );
}

// Bar: [tabs] [back · address · reload] [menu]. Forward,
// translate, bookmark etc. live in the menu. While scrolling down the bar
// fades out and a small address pill stays above the home indicator. iOS 26
// renders the capsules as Liquid Glass.
function MobileBrowserBottomBar({ id, chrome }: IMobileBrowserBottomBarProps) {
  const {
    bottom,
    tab,
    hasConnectedAccount,
    displayHomePage,
    handleBookmarkPress,
    handlePinTab,
    handleCloseTab,
    onShare,
    onCopyUrl,
    handleDisconnect,
    handleRefresh,
    handleRequestSiteMode,
    handleGoBack,
    handleGoForward,
    handleBrowserOpen,
    disabledGoBack,
    disabledGoForward,
    isTranslated,
    handleTranslate,
    handleRetranslate,
    handleTranslateTestAIError,
  } = useMobileBrowserBottomBarData({ id });

  const { progress, onExpand, onSearchBarPress } = chrome;
  // Match the page's light/dark look (glass, icons, text), like Safari.
  const { pageColor, pageThemeName } = usePageTheme(id);
  const appThemeName = useThemeName();
  const isChromeCollapsed = useIsChromeCollapsed(progress);
  // Matches the WebView's bottom edge (see useMobileBrowserChromeAnimation).
  const stripFullHeight = getBarReservedHeight(bottom);
  const stripCollapsedHeight = getCollapsedReservedHeight(bottom);
  const stripStyle = useAnimatedStyle(() => ({
    height:
      stripCollapsedHeight +
      (stripFullHeight - stripCollapsedHeight) * progress.value,
  }));
  const pageColorStyle = useMemo(
    () => (pageColor ? { backgroundColor: pageColor } : undefined),
    [pageColor],
  );
  // Liquid Glass stops rendering for good once an ancestor's opacity reaches
  // 0, so each layer switches its glass off just before its fade does (see
  // useBarMorphStyles) and back on as it starts to fade in.
  const sideGlassFade = useMemo<IGlassFade>(
    () => ({ progress, edge: SIDE_FADE_START, direction: 'below' }),
    [progress],
  );
  const capsuleGlassFade = useMemo<IGlassFade>(
    () => ({ progress, edge: CAPSULE_FADE_START, direction: 'below' }),
    [progress],
  );
  const pillGlassFade = useMemo<IGlassFade>(
    () => ({ progress, edge: PILL_FADE_END, direction: 'above' }),
    [progress],
  );
  const pillBottom = getCollapsedPillBottom(bottom);
  const capsuleBottom = getBarCapsuleBottom(bottom);
  // Distance between the bar capsule's center and the pill's center.
  const morphTravelY =
    capsuleBottom +
    BROWSER_CHROME_CAPSULE_HEIGHT / 2 -
    (pillBottom + BROWSER_COLLAPSED_PILL_HEIGHT / 2);
  const { leftStyle, rightStyle, capsuleStyle, pillStyle } = useBarMorphStyles(
    progress,
    morphTravelY,
  );

  const [translateOpen, setTranslateOpen] = useState(false);
  const showOptions = useMobileBrowserOptions({
    isBookmark: tab?.isBookmark ?? false,
    onBookmarkPress: handleBookmarkPress,
    onShare,
    onCopyUrl,
    isPinned: tab?.isPinned ?? false,
    onPinnedPress: handlePinTab,
    onBrowserOpen: handleBrowserOpen,
    onCloseTab: handleCloseTab,
    displayDisconnectOption: hasConnectedAccount,
    onDisconnect: handleDisconnect,
    siteMode: tab?.siteMode,
    onRequestSiteMode: handleRequestSiteMode,
    canGoForward: !disabledGoForward,
    onGoForward: handleGoForward,
    isTranslated,
    // The options hook reads its props through a ref, so inline is fine.
    onTranslatePress: () => setTranslateOpen(true),
  });

  const currentUrl = tab?.displayUrl ?? tab?.url;
  const handleAddressPress = useCallback(() => {
    logBrowserChromeAction('address', 'toolbar');
    onSearchBarPress(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on tablets.
    <Theme name={pageThemeName ?? appThemeName}>
      <Stack h="100%" zIndex={1} pointerEvents="box-none">
        <Animated.View pointerEvents="none" style={[styles.strip, stripStyle]}>
          {/* The WebView ends above the bar: the strip behind the bar takes
            the page color, with a short fade above it so the page runs
            into the bar instead of stopping at a hard edge. */}
          {pageColor ? (
            <LinearGradient
              position="absolute"
              left={0}
              right={0}
              top={-STRIP_FADE_HEIGHT}
              height={STRIP_FADE_HEIGHT}
              colors={[withAlpha(pageColor, 0), pageColor]}
            />
          ) : null}
          <Stack flex={1} bg="$bgApp" style={pageColorStyle} />
        </Animated.View>
        <Animated.View
          pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
          style={[styles.bar, { bottom: capsuleBottom }]}
        >
          <XStack
            h={BROWSER_CHROME_CAPSULE_HEIGHT}
            px={BROWSER_CHROME_SIDE_PADDING}
            gap="$2"
            alignItems="center"
          >
            {/* Wallet-browser layout: tabs on the left, page navigation in
              the address capsule (back · site badge · domain · refresh), the
              page menu on the right. Account and exit live in the header. */}
            <Animated.View style={leftStyle}>
              <BrowserChromeCapsule glassFade={sideGlassFade}>
                <TabCountButton
                  testID={DiscoveryTestIDs.tabListButton}
                  onPressed={() => logBrowserChromeAction('tabs', 'toolbar')}
                />
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View style={[styles.capsule, capsuleStyle]}>
              <BrowserChromeCapsule
                flex={1}
                px="$2"
                glassFade={capsuleGlassFade}
              >
                {/* Kept in place (dimmed) when there is no history, so the
                  domain doesn't shift. */}
                <ChromePressable
                  onPress={() => {
                    logBrowserChromeAction('back', 'toolbar');
                    handleGoBack();
                  }}
                  disabled={disabledGoBack}
                  hitSlop={CAPSULE_BUTTON_HIT_SLOP}
                >
                  <IconButton
                    variant="tertiary"
                    icon="ChevronLeftOutline"
                    iconSize="$5"
                    // Android: the solid capsule left a wider gap between the
                    // narrow chevron and the site badge than to the capsule
                    // edge; pull it in (iOS glass was already even).
                    mr={platformEnv.isNativeAndroid ? -6 : undefined}
                    disabled={disabledGoBack}
                    accessible={!disabledGoBack}
                    testID={DiscoveryTestIDs.browserBackButton}
                  />
                </ChromePressable>
                <TranslatePopoverTrigger
                  isTranslated={isTranslated}
                  onTranslate={handleTranslate}
                  onRetranslate={handleRetranslate}
                  onTestAITranslateError={handleTranslateTestAIError}
                  open={translateOpen}
                  onOpenChange={setTranslateOpen}
                  trigger={translatePopoverAnchor}
                />
                <AddressCapsuleTitle
                  url={currentUrl}
                  onPress={handleAddressPress}
                />
                <RefreshButton
                  iconSize="$5"
                  onRefresh={() => {
                    logBrowserChromeAction('refresh', 'toolbar');
                    handleRefresh();
                  }}
                />
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View style={rightStyle}>
              <BrowserChromeCapsule glassFade={sideGlassFade}>
                <ChromePressable
                  onPress={() => {
                    logBrowserChromeAction('menu', 'toolbar');
                    showOptions();
                  }}
                  disabled={displayHomePage}
                  hitSlop={CAPSULE_BUTTON_HIT_SLOP}
                >
                  <IconButton
                    variant="tertiary"
                    icon="DotHorOutline"
                    disabled={displayHomePage}
                    testID="browser-bar-options"
                  />
                </ChromePressable>
              </BrowserChromeCapsule>
            </Animated.View>
          </XStack>
        </Animated.View>
        <Animated.View
          pointerEvents={isChromeCollapsed ? 'box-none' : 'none'}
          style={[styles.pillRow, { bottom: pillBottom }, pillStyle]}
        >
          <CollapsedAddressPill
            glassFade={pillGlassFade}
            url={currentUrl}
            onPress={() => {
              logBrowserChromeAction('expand', 'toolbar');
              onExpand();
            }}
          />
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserBottomBar);
