import { memo, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  IconButton,
  SizableText,
  Stack,
  Theme,
  XStack,
  isLiquidGlassAvailable,
  useThemeName,
} from '@onekeyhq/components';

import {
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';
import { usePageTheme } from '../../utils/pageThemeColor';

import { AddressCapsuleTitle } from './AddressCapsuleTitle';
import {
  getBarCapsuleBottom,
  getCollapsedPillBottom,
  getDisplayHostname,
  logBrowserChromeAction,
  useIsChromeCollapsed,
  useIsFloatingBrowserChrome,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';
import { ChromePressable } from './ChromePressable';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';
import { useMobileBrowserOptions } from './useMobileBrowserOptions';

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
  capsuleContent: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

// Collapsed size of the address capsule, about the pill's size.
const CAPSULE_COLLAPSED_SCALE =
  BROWSER_COLLAPSED_PILL_HEIGHT / BROWSER_CHROME_CAPSULE_HEIGHT;
const PILL_FONT_SIZE = Math.round(14 / CAPSULE_COLLAPSED_SCALE);
const PILL_LINE_HEIGHT = Math.round(20 / CAPSULE_COLLAPSED_SCALE);

// Morphs the address capsule into the collapsed pill (and back), like
// Safari: one capsule shrinks and slides down to the pill's spot while its
// contents fade over to the pill's domain; the side buttons fade and slide
// outwards. A single glass shape (not a capsule and a pill fading over each other)
// keeps it reading as one element and avoids two glass layers overlapping.
//
// Opacity is returned apart from the transforms: Liquid Glass breaks under a
// translucent ancestor (once faded to 0 it doesn't come back), so on glass the
// side buttons fade their contents and the glass (de)materializes natively;
// elsewhere the whole button fades.
function useBarMorphStyles(progress: SharedValue<number>, travelY: number) {
  const sideOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
  }));
  const capsuleContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [0, 1], 'clamp'),
  }));
  const pillContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [1, 0], 'clamp'),
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-16, 0], 'clamp') },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1], 'clamp') },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [16, 0], 'clamp') },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1], 'clamp') },
    ],
  }));
  const capsuleStyle = useAnimatedStyle(() => ({
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
  return {
    leftStyle,
    rightStyle,
    capsuleStyle,
    sideOpacityStyle,
    capsuleContentStyle,
    pillContentStyle,
  };
}

// The translate sheet is opened from the menu; this anchor only positions the
// tablet popover, out of the layout flow so it doesn't shift the address.
const translatePopoverAnchor = <Stack position="absolute" w={1} h={1} />;

// Safari-style bar: [back] [menu · address · reload] [tabs]. Forward,
// translate, bookmark etc. live in the menu. While scrolling down the bar
// fades out and a small address pill stays above the home indicator. iOS 26
// renders the capsules as Liquid Glass.
function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  chrome,
}: IMobileBrowserBottomBarProps) {
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
  } = useMobileBrowserBottomBarData({ id, onGoBackHomePage });

  const { progress, onExpand, onSearchBarPress } = chrome;
  // Match the page's light/dark look (glass, icons, text), like Safari.
  const { pageColor, pageThemeName } = usePageTheme(id);
  const appThemeName = useThemeName();
  const isFloatingBrowserChrome = useIsFloatingBrowserChrome();
  const isChromeCollapsed = useIsChromeCollapsed(progress);
  const pillBottom = getCollapsedPillBottom(bottom);
  const capsuleBottom = getBarCapsuleBottom(bottom);
  // Distance between the bar capsule's center and the pill's center.
  const morphTravelY =
    capsuleBottom +
    BROWSER_CHROME_CAPSULE_HEIGHT / 2 -
    (pillBottom + BROWSER_COLLAPSED_PILL_HEIGHT / 2);
  const {
    leftStyle,
    rightStyle,
    capsuleStyle,
    sideOpacityStyle,
    capsuleContentStyle,
    pillContentStyle,
  } = useBarMorphStyles(progress, morphTravelY);
  const isGlass = isLiquidGlassAvailable();

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
    displayDisconnectOption: !!hasConnectedAccount,
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
  const hostname = useMemo(() => getDisplayHostname(currentUrl), [currentUrl]);
  const handleAddressPress = useCallback(() => {
    logBrowserChromeAction('address', 'toolbar');
    onSearchBarPress(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on tablets.
    <Theme name={pageThemeName ?? appThemeName}>
      <Stack
        h="100%"
        zIndex={1}
        pointerEvents="box-none"
        // When the WebView resizes instead of running under the bar (Android,
        // iOS < 26), the strip behind the bar takes the page color too.
        style={
          !isFloatingBrowserChrome && pageColor
            ? { backgroundColor: pageColor }
            : undefined
        }
      >
        <Animated.View
          pointerEvents="box-none"
          style={[styles.bar, { bottom: capsuleBottom }]}
        >
          <XStack
            h={BROWSER_CHROME_CAPSULE_HEIGHT}
            px={BROWSER_CHROME_SIDE_PADDING}
            gap="$2"
            alignItems="center"
            pointerEvents="box-none"
          >
            <Animated.View
              pointerEvents={isChromeCollapsed ? 'none' : 'auto'}
              style={isGlass ? leftStyle : [leftStyle, sideOpacityStyle]}
            >
              <BrowserChromeCapsule
                glassHidden={isChromeCollapsed}
                contentStyle={isGlass ? sideOpacityStyle : undefined}
              >
                <ChromePressable
                  onPress={() => {
                    logBrowserChromeAction('back', 'toolbar');
                    handleGoBack();
                  }}
                  disabled={disabledGoBack}
                >
                  <IconButton
                    variant="tertiary"
                    icon="ChevronLeftOutline"
                    disabled={disabledGoBack}
                    accessible={!disabledGoBack}
                    testID={DiscoveryTestIDs.browserBackButton}
                  />
                </ChromePressable>
              </BrowserChromeCapsule>
            </Animated.View>
            {/* Same edge inset as the round buttons, so icons line up. */}
            <Animated.View style={[styles.capsule, capsuleStyle]}>
              <BrowserChromeCapsule flex={1} px="$2">
                <Animated.View
                  pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
                  style={[styles.capsuleContent, capsuleContentStyle]}
                >
                  <ChromePressable
                    onPress={() => {
                      logBrowserChromeAction('menu', 'toolbar');
                      showOptions();
                    }}
                    disabled={displayHomePage}
                  >
                    <IconButton
                      variant="tertiary"
                      icon="MenuOutline"
                      iconSize="$5"
                      disabled={displayHomePage}
                      testID="browser-bar-options"
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
                </Animated.View>
                {/* The collapsed pill's domain, drawn inside the same capsule
                  and sized up so it reads at 14pt once the capsule is scaled
                  down to the pill. */}
                <Animated.View
                  pointerEvents={isChromeCollapsed ? 'auto' : 'none'}
                  style={[styles.pillContent, pillContentStyle]}
                >
                  <ChromePressable
                    fill
                    onPress={() => {
                      logBrowserChromeAction('expand', 'toolbar');
                      onExpand();
                    }}
                  >
                    <XStack
                      flex={1}
                      alignItems="center"
                      justifyContent="center"
                      testID={DiscoveryTestIDs.browserCollapsedHeader}
                    >
                      <SizableText
                        size="$bodyMdMedium"
                        fontSize={PILL_FONT_SIZE}
                        lineHeight={PILL_LINE_HEIGHT}
                        numberOfLines={1}
                      >
                        {hostname}
                      </SizableText>
                    </XStack>
                  </ChromePressable>
                </Animated.View>
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View
              pointerEvents={isChromeCollapsed ? 'none' : 'auto'}
              style={isGlass ? rightStyle : [rightStyle, sideOpacityStyle]}
            >
              <BrowserChromeCapsule
                glassHidden={isChromeCollapsed}
                contentStyle={isGlass ? sideOpacityStyle : undefined}
              >
                <TabCountButton
                  testID={DiscoveryTestIDs.tabListButton}
                  onPressed={() => logBrowserChromeAction('tabs', 'toolbar')}
                />
              </BrowserChromeCapsule>
            </Animated.View>
          </XStack>
        </Animated.View>
      </Stack>
    </Theme>
  );
}

export default memo(MobileBrowserBottomBar);
