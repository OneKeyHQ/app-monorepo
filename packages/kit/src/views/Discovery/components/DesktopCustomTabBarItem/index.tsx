import { useCallback, useMemo } from 'react';

import { DesktopTabItem } from '@onekeyhq/components/src/Navigation/Tab/TabBar/DesktopTabItem';

import { useWebTabData } from '../../hooks/useWebTabs';
import { dispatchOverlayEvent } from '../WebView/DesktopOverlay';

function DesktopCustomTabBarItem({
  id,
  activeTabId,
  onPress,
  onBookmarkPress,
  onPinnedPress,
  onClose,
}: {
  id: string;
  activeTabId: string | null;
  onPress: (id: string) => void;
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
  onClose: (id: string) => void;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  const handleActionListOpenChange = useCallback((isOpen: boolean) => {
    dispatchOverlayEvent(isOpen);
  }, []);
  return (
    <DesktopTabItem
      key={id}
      selected={isActive}
      onPress={() => onPress(id)}
      label={tab.title}
      avatarSrc={tab?.favicon}
      onActionListOpenChange={handleActionListOpenChange}
      actionList={[
        {
          items: [
            {
              label: tab.isBookmark ? 'Delete Bookmark' : 'Bookmark',
              icon: tab.isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
              onPress: () => {
                onBookmarkPress(!tab.isBookmark, tab.url, tab.title ?? '');
              },
            },
            {
              label: tab.isPinned ? 'Un-Pin' : 'Pin',
              icon: tab.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
              onPress: () => {
                onPinnedPress(tab.id, !tab.isPinned);
              },
            },
          ],
        },
        {
          items: [
            {
              label: tab.isPinned ? 'Close Pin Tab' : 'Close Tab',
              icon: 'CrossedLargeOutline',
              onPress: () => {
                onClose(id);
              },
            },
          ],
        },
      ]}
    />
  );
}

export default DesktopCustomTabBarItem;
