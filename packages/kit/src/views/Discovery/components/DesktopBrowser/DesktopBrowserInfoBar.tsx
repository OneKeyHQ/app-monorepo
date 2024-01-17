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
  onSearch,
}: IWebTab & {
  goBack: () => void;
  goForward: () => void;
  stopLoading: () => void;
  reload: () => void;
  isBookmark: boolean;
  onBookmarkPress: (bookmark: boolean) => void;
  isPinned: boolean;
  onPinnedPress: (pinned: boolean) => void;
  onSearch: () => void;
}) {
  return (
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
      onSearch={onSearch}
    />
  );
}

export default DesktopBrowserInfoBar;
