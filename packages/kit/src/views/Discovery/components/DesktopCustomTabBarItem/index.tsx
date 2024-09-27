import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useClipboard } from '@onekeyhq/components';
import type {
  IActionListItemProps,
  IPropsWithTestId,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import { useWebTabDataById } from '../../hooks/useWebTabs';

function DesktopCustomTabBarItem({
  id,
  activeTabId,
  onPress,
  onBookmarkPress,
  onPinnedPress,
  onClose,
  displayDisconnectOption,
  onDisconnect,
  testID,
}: IPropsWithTestId<{
  id: string;
  activeTabId: string | null;
  onPress: (id: string) => void;
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
  onClose: (id: string) => void;
  displayDisconnectOption: boolean;
  onDisconnect: (url: string | undefined) => Promise<void>;
}>) {
  const intl = useIntl();
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const { copyText } = useClipboard();
  const { handleRenameTab } = useBrowserOptionsAction();
  const actionListItems = useMemo(
    () => [
      {
        items: [
          {
            label: intl.formatMessage({
              id: tab?.isBookmark
                ? ETranslations.explore_remove_bookmark
                : ETranslations.explore_add_bookmark,
            }),
            icon: tab?.isBookmark ? 'StarSolid' : 'StarOutline',
            onPress: () => {
              onBookmarkPress(!tab?.isBookmark, tab?.url, tab?.title ?? '');
            },
            testID: `action-list-item-${
              !tab?.isBookmark ? 'bookmark' : 'remove-bookmark'
            }`,
          },
          {
            label: intl.formatMessage({
              id: tab?.isPinned
                ? ETranslations.explore_unpin
                : ETranslations.explore_pin,
            }),
            icon: tab?.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
            onPress: () => {
              onPinnedPress(tab?.id, !tab?.isPinned);
            },
            testID: `action-list-item-${!tab?.isPinned ? 'pin' : 'un-pin'}`,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.explore_rename,
            }),
            icon: 'PencilOutline',
            onPress: () => {
              void handleRenameTab(tab);
            },
            testID: `action-list-item-rename`,
          },
        ].filter(Boolean) as IActionListItemProps[],
      },
      {
        items: [
          {
            label: intl.formatMessage({
              id: ETranslations.global_copy_url,
            }),
            icon: 'LinkOutline',
            onPress: () => {
              copyText(tab?.url);
            },
            testID: `action-list-item-copy`,
          },
          // {
          //   label: intl.formatMessage({
          //     id: ETranslations.explore_share,
          //   }),
          //   icon: 'ShareOutline',
          //   onPress: () => {
          //     handleShareUrl(tab?.url);
          //   },
          //   testID: `action-list-item-share`,
          // },
        ].filter(Boolean) as IActionListItemProps[],
      },
      {
        items: [
          displayDisconnectOption && {
            label: intl.formatMessage({ id: ETranslations.explore_disconnect }),
            icon: 'BrokenLinkOutline',
            onPress: () => {
              void onDisconnect(tab?.url);
            },
            testID: `action-list-item-${!tab?.isPinned ? 'pin' : 'un-pin'}`,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.explore_close_tab,
            }),
            icon: 'CrossedLargeOutline',
            onPress: () => {
              onClose(tab?.id);
            },
            testID: `action-list-item-close`,
          },
        ].filter(Boolean) as IActionListItemProps[],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      displayDisconnectOption,
      intl,
      onBookmarkPress,
      onPinnedPress,
      tab?.id,
      tab?.isBookmark,
      tab?.isPinned,
      tab?.title,
      tab?.url,
      onDisconnect,
      onClose,
      copyText,
      handleRenameTab,
    ],
  );
  return (
    <DesktopTabItem
      showAvatar
      key={id}
      selected={isActive}
      onPress={() => onPress(id)}
      label={tab?.title}
      avatarSrc={tab?.favicon}
      testID={testID}
      id={id}
      actionList={actionListItems}
    />
  );
}

export default DesktopCustomTabBarItem;
