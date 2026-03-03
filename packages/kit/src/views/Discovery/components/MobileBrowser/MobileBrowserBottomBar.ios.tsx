import { StyleSheet } from 'react-native';

import { IconButton, Stack } from '@onekeyhq/components';

import { BROWSER_BOTTOM_BAR_HEIGHT } from '../../config/Animation.constants';

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
          size="medium"
          icon="ChevronLeftOutline"
          disabled={disabledGoBack}
          accessible={!disabledGoBack}
          onPress={handleGoBack}
          testID="browser-bar-go-back"
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="tertiary"
          size="medium"
          icon="ChevronRightOutline"
          disabled={disabledGoForward}
          accessible={!disabledGoForward}
          onPress={handleGoForward}
          testID="browser-bar-go-forward"
        />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <TabCountButton testID="browser-bar-tabs" />
      </Stack>

      <Stack flex={1} alignItems="center" justifyContent="center">
        <RefreshButton onRefresh={handleRefresh} />
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
            size="medium"
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
