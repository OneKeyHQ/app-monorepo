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

import type { IBrowserChromeCapsuleProps } from './BrowserChromeCapsule';
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
  pillRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_COLLAPSED_PILL_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

// Collapsed size of the address capsule, about the pill's size.
const CAPSULE_COLLAPSED_SCALE =
  BROWSER_COLLAPSED_PILL_HEIGHT / BROWSER_CHROME_CAPSULE_HEIGHT;

// Morphs the address capsule into the collapsed pill (and back), like
// Safari: the capsule shrinks and slides down to the pill's spot while the
// pill grows out of it; the side buttons fade and slide outwards. Both
// layers overlap mid-way so it reads as one element changing shape.
//
// Opacity is returned apart from the transforms: Liquid Glass breaks under a
// translucent ancestor (once faded to 0 it doesn't come back), so on glass the
// fade applies to the capsule contents and the glass itself (de)materializes
// natively; elsewhere the whole capsule fades.
function useBarMorphStyles(progress: SharedValue<number>, travelY: number) {
  const sideOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
  }));
  const capsuleOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [0, 1], 'clamp'),
  }));
  const pillOpacityStyle = useAnimatedStyle(() => ({
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
  const pillStyle = useAnimatedStyle(() => ({
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
  return {
    leftStyle,
    rightStyle,
    capsuleStyle,
    pillStyle,
    sideOpacityStyle,
    capsuleOpacityStyle,
    pillOpacityStyle,
  };
}

// The translate sheet is opened from the menu; this anchor only positions the
// tablet popover, out of the layout flow so it doesn't shift the address.
const translatePopoverAnchor = <Stack position="absolute" w={1} h={1} />;

function CollapsedAddressPill({
  url,
  onPress,
  glassHidden,
  contentStyle,
}: {
  url?: string;
  onPress?: () => void;
} & Pick<IBrowserChromeCapsuleProps, 'glassHidden' | 'contentStyle'>) {
  const hostname = useMemo(() => getDisplayHostname(url), [url]);
  return (
    <BrowserChromeCapsule
      height={BROWSER_COLLAPSED_PILL_HEIGHT}
      px="$4"
      glassHidden={glassHidden}
      contentStyle={contentStyle}
    >
      <ChromePressable onPress={onPress}>
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
    pillStyle,
    sideOpacityStyle,
    capsuleOpacityStyle,
    pillOpacityStyle,
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
          pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
          style={[styles.bar, { bottom: capsuleBottom }]}
        >
          <XStack
            h={BROWSER_CHROME_CAPSULE_HEIGHT}
            px={BROWSER_CHROME_SIDE_PADDING}
            gap="$2"
            alignItems="center"
          >
            <Animated.View
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
            <Animated.View
              style={
                isGlass
                  ? [styles.capsule, capsuleStyle]
                  : [styles.capsule, capsuleStyle, capsuleOpacityStyle]
              }
            >
              <BrowserChromeCapsule
                flex={1}
                px="$2"
                glassHidden={isChromeCollapsed}
                contentStyle={isGlass ? capsuleOpacityStyle : undefined}
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
              </BrowserChromeCapsule>
            </Animated.View>
            <Animated.View
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
        <Animated.View
          pointerEvents={isChromeCollapsed ? 'box-none' : 'none'}
          style={
            isGlass
              ? [styles.pillRow, { bottom: pillBottom }, pillStyle]
              : [
                  styles.pillRow,
                  { bottom: pillBottom },
                  pillStyle,
                  pillOpacityStyle,
                ]
          }
        >
          <CollapsedAddressPill
            url={currentUrl}
            glassHidden={!isChromeCollapsed}
            contentStyle={isGlass ? pillOpacityStyle : undefined}
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
