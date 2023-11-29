import { useCallback, useMemo } from 'react';

import { DesktopTabItem } from '@onekeyhq/components/src/Navigation/Tab/TabBar/DesktopTabItem';

import { useWebTabDataById } from '../../hooks/useWebTabs';
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
  const { tab } = useWebTabDataById(id);
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
              label: tab.isBookmark ? 'Remove Bookmark' : 'Bookmark',
              icon: tab.isBookmark ? 'StarSolid' : 'StarOutline',
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
