import { memo, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Haptics,
  IconButton,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
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
  useChromeCrossfadeStyles,
  useIsChromeCollapsed,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';
import { ChromePressable } from './ChromePressable';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';
import { useMobileBrowserOptions } from './useMobileBrowserOptions';

import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';

const styles = StyleSheet.create({
  // Bottom-anchored so the in-flow (tablet) container can shrink to the pill
  // zone while the bar fades out above it.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BROWSER_BOTTOM_BAR_HEIGHT,
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

// The translate sheet is opened from the menu; this anchor only positions the
// tablet popover.
const translatePopoverAnchor = <Stack w={1} h={1} />;

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
  const { expandedStyle, collapsedStyle } = useChromeCrossfadeStyles(progress, {
    hiddenOffsetY: 16,
  });

  const [translateOpen, setTranslateOpen] = useState(false);
  const handleTranslatePress = useCallback(() => {
    setTranslateOpen(true);
  }, []);

  const showOptions = useMobileBrowserOptions({
    isBookmark: tab?.isBookmark ?? false,
    onBookmarkPress: handleBookmarkPress,
    onRefresh: handleRefresh,
    onShare,
    onCopyUrl,
    isPinned: tab?.isPinned ?? false,
    onPinnedPress: handlePinTab,
    onBrowserOpen: handleBrowserOpen,
    onGoBackHomePage,
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
        style={[styles.bar, { bottom }, expandedStyle]}
      >
        <XStack
          h={BROWSER_BOTTOM_BAR_HEIGHT}
          px="$4"
          gap="$2"
          alignItems="center"
        >
          <BrowserChromeCapsule>
            <ChromePressable onPress={handleGoBack} disabled={disabledGoBack}>
              <IconButton
                variant="tertiary"
                icon="ChevronLeftOutline"
                disabled={disabledGoBack}
                accessible={!disabledGoBack}
                testID={DiscoveryTestIDs.browserBackButton}
              />
            </ChromePressable>
          </BrowserChromeCapsule>
          <BrowserChromeCapsule flex={1} px="$1.5">
            <ChromePressable onPress={showOptions} disabled={displayHomePage}>
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
            <RefreshButton onRefresh={handleRefresh} />
          </BrowserChromeCapsule>
          <BrowserChromeCapsule>
            <TabCountButton testID={DiscoveryTestIDs.tabListButton} />
          </BrowserChromeCapsule>
        </XStack>
      </Animated.View>
      <Animated.View
        pointerEvents={isChromeCollapsed ? 'box-none' : 'none'}
        style={[
          styles.pillRow,
          { bottom: getCollapsedPillBottom(bottom) },
          collapsedStyle,
        ]}
      >
        <CollapsedAddressPill url={currentUrl} onPress={onExpand} />
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserBottomBar);
