import type { ReactNode } from 'react';

import { ActionList } from '@onekeyhq/components';

import type { IMobileBottomOptionsProps } from '../../types';

function MobileBrowserBottomOptions({
  children,
  open,
  onOpenChange,
  isBookmark,
  onBookmarkPress,
  onRefresh,
  onShare,
  isPined,
  onPinedPress,
  onCopyUrl,
  onBrowserOpen,
  onGoBackHomePage,
}: {
  children?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & IMobileBottomOptionsProps) {
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
              label: 'Reload',
              icon: 'RotateClockwiseOutline',
              onPress: () => onRefresh(),
            },
            {
              label: isBookmark ? '取消收藏' : 'Bookmark',
              icon: isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
              onPress: () => onBookmarkPress(!isBookmark),
            },
            {
              label: isPined ? 'Un-Pin' : 'Pin',
              icon: isPined ? 'PinSolid' : 'PinOutline',
              onPress: () => onPinedPress(!isPined),
            },
            {
              label: 'Share',
              icon: 'ShareOutline',
              onPress: () => onShare(),
            },
            {
              label: '复制网址',
              icon: 'PlaceholderOutline',
              onPress: () => onCopyUrl(),
            },
            {
              label: 'Open in Browser',
              icon: 'CompassOutline',
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
