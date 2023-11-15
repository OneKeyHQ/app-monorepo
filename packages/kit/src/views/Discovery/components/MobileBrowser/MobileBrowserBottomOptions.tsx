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
      title="More"
      renderTrigger={children}
      items={[
        {
          label: isBookmark ? '取消收藏' : '收藏',
          icon: 'PlaceholderOutline',
          onPress: () => onBookmarkPress(!isBookmark),
        },
        {
          label: '刷新',
          icon: 'PlaceholderOutline',
          onPress: () => onRefresh(),
        },
        {
          label: '分享',
          icon: 'PlaceholderOutline',
          onPress: () => onShare(),
        },
        {
          label: isPined ? '取消固定标签页' : '固定标签页',
          icon: 'PlaceholderOutline',
          onPress: () => onPinedPress(!isPined),
        },
        {
          label: '复制网址',
          icon: 'PlaceholderOutline',
          onPress: () => onCopyUrl(),
        },
        {
          label: '在浏览器打开',
          icon: 'PlaceholderOutline',
          onPress: () => onBrowserOpen(),
        },
        {
          label: '返回首页',
          icon: 'PlaceholderOutline',
          onPress: () => onGoBackHomePage(),
        },
      ]}
    />
  );
}

export default MobileBrowserBottomOptions;
