import { memo, useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import { IconButton, SizableText, Stack, XStack } from '@onekeyhq/components';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
} from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';
import CustomHeaderTitle from '../CustomHeaderTitle';

import {
  getCollapsedPillBottom,
  getDisplayHostname,
  useChromeCrossfadeStyles,
  useIsChromeCollapsed,
} from './browserChrome';
import { BrowserChromeCapsule } from './BrowserChromeCapsule';
import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';

import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';

const styles = StyleSheet.create({
  // Bottom-anchored so the in-flow (iPad) container can shrink to the pill
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
// iPad popover.
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
      <XStack
        h="100%"
        alignItems="center"
        onPress={onPress}
        testID={DiscoveryTestIDs.browserCollapsedHeader}
      >
        <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth={220}>
          {hostname}
        </SizableText>
      </XStack>
    </BrowserChromeCapsule>
  );
}

// Safari-style compact bar: [back] [menu · address · reload] [tabs].
// Forward / translate / bookmark etc. live in the menu. While scrolling down
// the bar fades out and a small address pill stays above the home indicator.
function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  chrome,
  ...rest
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

  // Without a driver (e.g. the bar is rendered standalone) stay expanded.
  const fallbackProgress = useSharedValue(1);
  const progress = chrome?.progress ?? fallbackProgress;
  const isChromeCollapsed = useIsChromeCollapsed(progress);
  const { expandedStyle, collapsedStyle } = useChromeCrossfadeStyles(progress, {
    hiddenOffsetY: 16,
  });

  const [translateOpen, setTranslateOpen] = useState(false);
  const handleTranslatePress = useCallback(() => {
    setTranslateOpen(true);
  }, []);

  const currentUrl = tab?.displayUrl ?? tab?.url;
  const onSearchBarPress = chrome?.onSearchBarPress;
  const handleAddressPress = useCallback(() => {
    onSearchBarPress?.(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on iPad.
    <Stack h="100%" zIndex={1} pointerEvents="box-none" {...rest}>
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
            <IconButton
              variant="tertiary"
              icon="ChevronLeftOutline"
              disabled={disabledGoBack}
              accessible={!disabledGoBack}
              onPress={handleGoBack}
              testID={DiscoveryTestIDs.browserBackButton}
            />
          </BrowserChromeCapsule>
          <BrowserChromeCapsule flex={1} px="$1.5">
            <MobileBrowserBottomOptions
              disabled={displayHomePage}
              isBookmark={tab?.isBookmark ?? false}
              onBookmarkPress={handleBookmarkPress}
              onRefresh={handleRefresh}
              onShare={onShare}
              onCopyUrl={onCopyUrl}
              isPinned={tab?.isPinned ?? false}
              onPinnedPress={handlePinTab}
              onBrowserOpen={handleBrowserOpen}
              onGoBackHomePage={onGoBackHomePage}
              onCloseTab={handleCloseTab}
              displayDisconnectOption={!!hasConnectedAccount}
              onDisconnect={handleDisconnect}
              siteMode={tab?.siteMode}
              onRequestSiteMode={handleRequestSiteMode}
              canGoForward={!disabledGoForward}
              onGoForward={handleGoForward}
              isTranslated={isTranslated}
              onTranslatePress={handleTranslatePress}
            >
              <IconButton
                variant="tertiary"
                icon="MenuOutline"
                disabled={displayHomePage}
                testID="browser-bar-options"
              />
            </MobileBrowserBottomOptions>
            <TranslatePopoverTrigger
              isTranslated={isTranslated}
              onTranslate={handleTranslate}
              onRetranslate={handleRetranslate}
              onTestAITranslateError={handleTranslateTestAIError}
              open={translateOpen}
              onOpenChange={setTranslateOpen}
              trigger={translatePopoverAnchor}
            />
            <CustomHeaderTitle
              embedded
              handleSearchBarPress={handleAddressPress}
            />
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
        <CollapsedAddressPill url={currentUrl} onPress={chrome?.onExpand} />
      </Animated.View>
    </Stack>
  );
}

export default memo(MobileBrowserBottomBar);
