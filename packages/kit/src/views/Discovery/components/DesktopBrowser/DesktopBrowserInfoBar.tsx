import { DesktopDragZoneBox, IconButton, XStack } from '@onekeyhq/components';

import HeaderLeftToolBar from '../HeaderLeftToolBar';

import type { IWebTab } from '../../types';

function DesktopBrowserInfoBar({
  url,
  canGoBack,
  canGoForward,
  loading,
  goBack,
  goForward,
  stopLoading,
  reload,
  isBookmark,
  onBookmarkPress,
  isPinned,
  onPinnedPress,
}: IWebTab & {
  goBack: () => void;
  goForward: () => void;
  stopLoading: () => void;
  reload: () => void;
  isBookmark: boolean;
  onBookmarkPress: (bookmark: boolean) => void;
  isPinned: boolean;
  onPinnedPress: (pinned: boolean) => void;
}) {
  return (
    <DesktopDragZoneBox>
      <XStack w="100%" h={52} px="$5" bg="$bgApp">
        <XStack w="100%" alignItems="center" justifyContent="space-between">
          <HeaderLeftToolBar
            url={url}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            loading={loading}
            goBack={goBack}
            goForward={goForward}
            stopLoading={stopLoading}
            reload={reload}
            isBookmark={isBookmark}
            onBookmarkPress={onBookmarkPress}
            isPinned={isPinned}
            onPinnedPress={onPinnedPress}
          />
          <XStack space="$6">
            <IconButton
              size="medium"
              variant="tertiary"
              icon="PlaceholderOutline"
            />
            <IconButton
              size="medium"
              variant="tertiary"
              icon="PlaceholderOutline"
            />
          </XStack>
        </XStack>
      </XStack>
    </DesktopDragZoneBox>
  );
}

export default DesktopBrowserInfoBar;
