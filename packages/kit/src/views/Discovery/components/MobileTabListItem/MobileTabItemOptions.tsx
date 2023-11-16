import type { ReactNode } from 'react';

import { ActionList } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

import type { IMobileTabListOptionsProps } from '../../types';

function MobileTabItemOptions({
  id,
  children,
  open,
  onOpenChange,
  onBookmarkPress,
  onShare,
  onPinnedPress,
  onClose,
}: {
  id: string | null;
  children?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & IMobileTabListOptionsProps) {
  const { tab } = useWebTabData(id ?? '');

  if (!id || !tab) {
    return null;
  }

  return (
    <ActionList
      open={open}
      onOpenChange={onOpenChange}
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
              onPress: () => onShare(),
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
