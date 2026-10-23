import { useCallback, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  GlassView,
  IconButton,
  SizableText,
  Stack,
  XStack,
  isLiquidGlassAvailable,
} from '@onekeyhq/components';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  BROWSER_COLLAPSED_PILL_HEIGHT,
  BROWSER_HEADER_CROSSFADE_POINT,
} from '../../config/Animation.constants';
import { getCollapsedPillBottom } from '../../hooks/useMobileBottomBarAnimation';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';
import CustomHeaderTitle from '../CustomHeaderTitle';

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
  pillGlass: {
    height: BROWSER_COLLAPSED_PILL_HEIGHT,
    borderRadius: 9999,
  },
});

function CollapsedAddressPill({
  url,
  onPress,
}: {
  url?: string;
  onPress?: () => void;
}) {
  const hostname = uriUtils.safeParseURL(url ?? '')?.hostname || url;
  const label = (
    <XStack
      h={BROWSER_COLLAPSED_PILL_HEIGHT}
      px="$4"
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
      testID={DiscoveryTestIDs.browserCollapsedHeader}
    >
      <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth={220}>
        {hostname}
      </SizableText>
    </XStack>
  );
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        isInteractive
        glassEffectStyle="regular"
        style={styles.pillGlass}
      >
        {label}
      </GlassView>
    );
  }
  return (
    <Stack bg="$bgStrong" borderRadius="$full" borderCurve="continuous">
      {label}
    </Stack>
  );
}

// Safari-style compact bar: [back] [menu · address · reload] [tabs].
// Forward / translate / bookmark etc. live in the menu. While scrolling down
// the bar fades out and a small address pill stays above the home indicator.
function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
  chromeProgress,
  isChromeCollapsed = false,
  onExpandChrome,
  onSearchBarPress,
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
  const progress = chromeProgress ?? fallbackProgress;

  const [translateOpen, setTranslateOpen] = useState(false);
  const handleTranslatePress = useCallback(() => {
    setTranslateOpen(true);
  }, []);

  const currentUrl = tab?.displayUrl ?? tab?.url;
  const handleAddressPress = useCallback(() => {
    onSearchBarPress?.(currentUrl ?? '');
  }, [onSearchBarPress, currentUrl]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [BROWSER_HEADER_CROSSFADE_POINT, 1],
      [0, 1],
      'clamp',
    ),
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [16, 0], 'clamp'),
      },
      {
        scale: interpolate(progress.value, [0, 1], [0.92, 1], 'clamp'),
      },
    ],
  }));
  const pillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, BROWSER_HEADER_CROSSFADE_POINT],
      [1, 0],
      'clamp',
    ),
  }));

  return (
    // Fills the container: a fixed full-height box on phones, an animated
    // in-flow height on iPad.
    <Stack h="100%" zIndex={1} pointerEvents="box-none" {...rest}>
      <Animated.View
        pointerEvents={isChromeCollapsed ? 'none' : 'box-none'}
        style={[styles.bar, { bottom }, barAnimatedStyle]}
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
            {/* Opened from the menu; the anchor only positions the iPad popover. */}
            <TranslatePopoverTrigger
              isTranslated={isTranslated}
              onTranslate={handleTranslate}
              onRetranslate={handleRetranslate}
              onTestAITranslateError={handleTranslateTestAIError}
              open={translateOpen}
              onOpenChange={setTranslateOpen}
              trigger={<Stack w={1} h={1} />}
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
          pillAnimatedStyle,
        ]}
      >
        <CollapsedAddressPill url={currentUrl} onPress={onExpandChrome} />
      </Animated.View>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
