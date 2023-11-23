import type { PropsWithChildren } from 'react';

import { ActionList } from '@onekeyhq/components';

import type { IMobileBottomOptionsProps } from '../../types';

function MobileBrowserBottomOptions({
  children,
  isBookmark,
  onBookmarkPress,
  onRefresh,
  onShare,
  isPinned,
  onPinnedPress,
  onBrowserOpen,
  onGoBackHomePage,
}: PropsWithChildren<IMobileBottomOptionsProps>) {
  return (
    <ActionList
      title="Options"
      renderTrigger={children}
      sections={[
        {
          items: [
            {
              label: 'Reload',
              icon: 'RotateClockwiseOutline',
              onPress: () => onRefresh(),
            },
            {
              label: isBookmark ? 'Delete Bookmark' : 'Bookmark',
              icon: isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
              onPress: () => onBookmarkPress(!isBookmark),
            },
            {
              label: isPinned ? 'Un-Pin' : 'Pin',
              icon: isPinned ? 'PinSolid' : 'PinOutline',
              onPress: () => onPinnedPress(!isPinned),
            },
            {
              label: 'Share',
              icon: 'ShareOutline',
              onPress: () => onShare(),
            },
            {
              label: 'Open in Browser',
              icon: 'CompassCircleOutline',
              onPress: () => onBrowserOpen(),
            },
          ],
        },
        {
          items: [
            {
              label: 'Back to Home',
              icon: 'HomeOpenOutline',
              onPress: () => onGoBackHomePage(),
            },
          ],
        },
      ]}
    />
  );
}

export default MobileBrowserBottomOptions;
