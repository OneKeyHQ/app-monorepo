import type { PropsWithChildren, ReactNode } from 'react';

import { ActionList } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

import type { IMobileTabListOptionsProps } from '../../types';

function MobileTabItemOptions({
  id,
  children,
  onBookmarkPress,
  onShare,
  onPinnedPress,
  onClose,
}: PropsWithChildren<
  {
    id: string | null;
  } & IMobileTabListOptionsProps
>) {
  const { tab } = useWebTabData(id ?? '');

  if (!id || !tab) {
    return null;
  }

  return (
    <ActionList
      title="Options"
      renderTrigger={children}
      sections={[
        {
          items: [
            {
              label: tab.isBookmark ? 'Delete Bookmark' : 'Bookmark',
              icon: tab.isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
              onPress: () =>
                onBookmarkPress(!tab.isBookmark, tab.url, tab.title ?? ''),
            },
            {
              label: tab.isPinned ? 'Un-Pin' : 'Pin',
              icon: tab.isPinned ? 'PinSolid' : 'PinOutline',
              onPress: () => onPinnedPress(id, !tab.isPinned),
            },
            {
              label: 'Share',
              icon: 'ShareOutline',
              onPress: () => onShare(tab.url),
            },
          ],
        },
        {
          items: [
            {
              label: tab.isPinned ? 'Close Pin Tab' : 'Close Tab',
              icon: 'CrossedLargeOutline',
              onPress: () => onClose(id),
            },
          ],
        },
      ]}
    />
  );
}

export default MobileTabItemOptions;
