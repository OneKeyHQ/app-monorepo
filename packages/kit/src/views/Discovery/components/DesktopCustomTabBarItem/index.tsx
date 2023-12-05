import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';

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
  const intl = useIntl();
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
              label: intl.formatMessage({
                id: tab.isBookmark
                  ? 'actionn__remove_bookmark'
                  : 'actionn__bookmark',
              }),
              icon: tab.isBookmark ? 'StarSolid' : 'StarOutline',
              onPress: () => {
                onBookmarkPress(!tab.isBookmark, tab.url, tab.title ?? '');
              },
            },
            {
              label: intl.formatMessage({
                id: tab.isPinned ? 'action__unpin' : 'action__pin',
              }),
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
              label: intl.formatMessage({
                id: tab.isPinned ? 'action__close_pin_tab' : 'form__close_tab',
              }),
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
