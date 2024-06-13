import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type {
  IActionListItemProps,
  IPropsWithTestId,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const buildActionListItems = useCallback(
    () =>
      [
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
        displayDisconnectOption && {
          label: intl.formatMessage({ id: ETranslations.explore_disconnect }),
          icon: 'BrokenLinkOutline',
          onPress: () => {
            void onDisconnect(tab?.url);
          },
          testID: `action-list-item-${!tab?.isPinned ? 'pin' : 'un-pin'}`,
        },
      ].filter(Boolean) as IActionListItemProps[],
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
      actionList={[
        {
          items: buildActionListItems(),
        },
        {
          items: [
            {
              label: intl.formatMessage({
                id: tab?.isPinned
                  ? ETranslations.explore_close_pin_tab
                  : ETranslations.explore_close_tab,
              }),
              icon: 'CrossedLargeOutline',
              onPress: () => {
                onClose(id);
              },
              testID: `action-list-item-close-${
                tab?.isPinned ? 'close-pin-tab' : 'close-tab'
              }`,
            },
          ],
        },
      ]}
    />
  );
}

export default DesktopCustomTabBarItem;
