import { memo, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  Haptics,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBrowserToolbarAction } from '@onekeyhq/shared/src/logger/scopes/discovery/scenes/browser';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  BROWSER_CHROME_CAPSULE_HEIGHT,
  BROWSER_CHROME_SIDE_PADDING,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { DiscoveryTestIDs } from '../../testIDs';

import { AddressCapsuleTitle } from './AddressCapsuleTitle';
import { AddressSwipeArea } from './AddressSwipeArea';
import {
  getCollapsedPillBottom,
  getDisplayHostname,
  useIsChromeCollapsed,
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
    height: BROWSER_BOTTOM_BAR_HEIGHT,
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

function logToolbarAction(action: IBrowserToolbarAction) {
  defaultLogger.discovery.browser.browserToolbarAction({
    action,
    entry: 'toolbar',
  });
}

// Collapsed size of the address capsule, about the pill's size.
const CAPSULE_COLLAPSED_SCALE =
  BROWSER_COLLAPSED_PILL_HEIGHT / BROWSER_CHROME_CAPSULE_HEIGHT;

// Morphs the address capsule into the collapsed pill (and back), like
// Safari: the capsule shrinks and slides down to the pill's spot while the
// pill grows out of it; the side buttons fade and slide outwards. Both
// layers overlap mid-way so it reads as one element changing shape.
function useBarMorphStyles(progress: SharedValue<number>, travelY: number) {
  const leftStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-16, 0], 'clamp') },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1], 'clamp') },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 1], [0, 1], 'clamp'),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [16, 0], 'clamp') },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1], 'clamp') },
    ],
  }));
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.25, 0.75], [0, 1], 'clamp'),
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
    opacity: interpolate(progress.value, [0.25, 0.75], [1, 0], 'clamp'),
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
}: {
  url?: string;
  onPress?: () => void;
}) {
  const hostname = useMemo(() => getDisplayHostname(url), [url]);
  return (
    <BrowserChromeCapsule height={BROWSER_COLLAPSED_PILL_HEIGHT} px="$4">
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
// translate, bookmark etc. live in the menu; swiping the address switches
// tabs. While scrolling down the bar fades out and a small address pill stays
// above the home indicator. iOS 26 renders the capsules as Liquid Glass.
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
  const isChromeCollapsed = useIsChromeCollapsed(progress);
  const pillBottom = getCollapsedPillBottom(bottom);
  // Distance between the bar capsule's center and the pill's center.
  const morphTravelY =
    bottom +
    BROWSER_BOTTOM_BAR_HEIGHT / 2 -
    (pillBottom + BROWSER_COLLAPSED_PILL_HEIGHT / 2);
  const { leftStyle, rightStyle, capsuleStyle, pillStyle } = useBarMorphStyles(
    progress,
    morphTravelY,
  );

  const [translateOpen, setTranslateOpen] = useState(false);
  const handleTranslatePress = useCallback(() => {
    setTranslateOpen(true);
  }, []);

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
    onTranslatePress: handleTranslatePress,
  });

  const currentUrl = tab?.displayUrl ?? tab?.url;
  const handleAddressPress = useCallback(() => {
    logToolbarAction('address');
    onSearchBarPress(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab } = useBrowserTabActions().current;
  const handleSwipeTab = useCallback(
    (direction: 1 | -1) => {
      const index = tabs.findIndex((t) => t.id === activeTabId);
      const target = index < 0 ? undefined : tabs[index + direction];
      if (target) {
        logToolbarAction('swipeTab');
        Haptics.selection();
        setCurrentWebTab(target.id);
      }
    },
    [tabs, activeTabId, setCurrentWebTab],
  );

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on tablets.
    <Stack h="100%" zIndex={1} pointerEvents="box-none">
      <Animated.View
        pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
        style={[styles.bar, { bottom }]}
      >
        <XStack
          h={BROWSER_BOTTOM_BAR_HEIGHT}
          px={BROWSER_CHROME_SIDE_PADDING}
          gap="$2"
          alignItems="center"
        >
          <Animated.View style={leftStyle}>
            <BrowserChromeCapsule>
              <ChromePressable
                onPress={() => {
                  logToolbarAction('back');
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
            <BrowserChromeCapsule flex={1}>
              <ChromePressable
                onPress={() => {
                  logToolbarAction('menu');
                  showOptions();
                }}
                disabled={displayHomePage}
              >
                <IconButton
                  variant="tertiary"
                  icon="MenuOutline"
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
              <AddressSwipeArea onSwipe={handleSwipeTab}>
                <AddressCapsuleTitle
                  url={currentUrl}
                  onPress={handleAddressPress}
                />
              </AddressSwipeArea>
              <RefreshButton
                onRefresh={() => {
                  logToolbarAction('refresh');
                  handleRefresh();
                }}
              />
            </BrowserChromeCapsule>
          </Animated.View>
          <Animated.View style={rightStyle}>
            <BrowserChromeCapsule>
              <TabCountButton
                testID={DiscoveryTestIDs.tabListButton}
                onPressed={() => logToolbarAction('tabs')}
              />
            </BrowserChromeCapsule>
          </Animated.View>
        </XStack>
      </Animated.View>
      <Animated.View
        pointerEvents={isChromeCollapsed ? 'box-none' : 'none'}
        style={[styles.pillRow, { bottom: pillBottom }, pillStyle]}
      >
        <CollapsedAddressPill
          url={currentUrl}
          onPress={() => {
            logToolbarAction('expand');
            onExpand();
          }}
        />
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserBottomBar);
