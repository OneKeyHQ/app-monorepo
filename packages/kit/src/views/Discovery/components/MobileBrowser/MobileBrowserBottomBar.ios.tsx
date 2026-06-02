import { StyleSheet } from 'react-native';

import { IconButton, Stack } from '@onekeyhq/components';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';
import { TranslatePopoverTrigger } from '../../hooks/usePageTranslation';
import { DiscoveryTestIDs } from '../../testIDs';

import MobileBrowserBottomOptions from './MobileBrowserBottomOptions';
import RefreshButton from './RefreshButton';
import TabCountButton from './TabCountButton';
import { useMobileBrowserBottomBarData } from './useMobileBrowserBottomBarData';

import type { IMobileBrowserBottomBarProps } from './useMobileBrowserBottomBarData';

function MobileBrowserBottomBar({
  id,
  onGoBackHomePage,
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

  return (
    <Stack
      flexDirection="row"
      bg="$bgApp"
      h={BROWSER_BOTTOM_BAR_HEIGHT + bottom}
      zIndex={1}
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
      pb={bottom}
      {...rest}
    >
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="large"
          icon="ChevronLeftOutline"
          disabled={disabledGoBack}
          accessible={!disabledGoBack}
          onPress={handleGoBack}
          testID={DiscoveryTestIDs.browserBackButton}
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="large"
          icon="ChevronRightOutline"
          disabled={disabledGoForward}
          accessible={!disabledGoForward}
          onPress={handleGoForward}
          testID={DiscoveryTestIDs.browserForwardButton}
        />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <TabCountButton size="large" testID={DiscoveryTestIDs.tabListButton} />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <RefreshButton size="large" onRefresh={handleRefresh} />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <TranslatePopoverTrigger
          isTranslated={isTranslated}
          onTranslate={handleTranslate}
          onRetranslate={handleRetranslate}
          onTestAITranslateError={handleTranslateTestAIError}
          size="large"
        />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
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
        >
          <IconButton
            variant="tertiary"
            size="large"
            icon="DotHorOutline"
            disabled={displayHomePage}
            testID="browser-bar-options"
          />
        </MobileBrowserBottomOptions>
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
