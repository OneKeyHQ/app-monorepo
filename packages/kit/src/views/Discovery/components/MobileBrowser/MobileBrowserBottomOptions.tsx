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
              testId: 'browser-options-reload',
              onPress: () => onRefresh(),
            },
            {
              label: isBookmark ? 'Remove Bookmark' : 'Bookmark',
              icon: isBookmark ? 'StarSolid' : 'StarOutline',
              testId: `browser-options-${
                isBookmark ? 'remove-bookmark' : 'bookmark'
              }`,
              onPress: () => onBookmarkPress(!isBookmark),
            },
            {
              label: isPinned ? 'Un-Pin' : 'Pin',
              icon: isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
              testId: `browser-options-${isPinned ? 'un-pin' : 'pin'}`,
              onPress: () => onPinnedPress(!isPinned),
            },
            {
              label: 'Share',
              icon: 'ShareOutline',
              testId: 'browser-options-share',
              onPress: () => onShare(),
            },
            {
              label: 'Open in Browser',
              testId: 'browser-options-open-in-browser',
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
