import { memo, useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useClipboard } from '@onekeyhq/components';
import type {
  IActionListItemProps,
  IPropsWithTestId,
} from '@onekeyhq/components';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';

function DesktopCustomTabBarItem({
  id,
  shortcutKey,
  onPress,
  onBookmarkPress,
  onPinnedPress,
  onClose,
  onDisconnect,
  testID,
}: IPropsWithTestId<{
  id: string;
  shortcutKey?: EShortcutEvents;
  onPress: (id: string) => void;
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
  onClose: (id: string) => void;
  onDisconnect: (url: string | undefined) => Promise<void>;
}>) {
  const intl = useIntl();
  const { tab } = useWebTabDataById(id);
  const isHomeTab = tab?.type === 'home';

  const {
    result: displayDisconnectOption,
    run: refreshDisplayDisconnectOptionStatus,
  } = usePromiseResult(async () => {
    const origin = tab?.url ? new URL(tab.url).origin : null;
    if (origin) {
      const connectedAccounts =
        await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
          origin,
        );
      return (connectedAccounts ?? []).length > 0;
    }
    return false;
  }, [tab?.url]);

  useEffect(() => {
    const handler = () => {
      void refreshDisplayDisconnectOptionStatus({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, handler);
    };
  }, [refreshDisplayDisconnectOptionStatus, tab]);

  const { copyText } = useClipboard();
  const { handleRenameTab } = useBrowserOptionsAction();
  const { activeTabId } = useActiveTabId();
  const isActive = activeTabId === id;
  const closeTab = useCallback(() => {
    if (tab?.id) {
      onClose?.(tab?.id);
    }
  }, [onClose, tab?.id]);
  const actionListItems = useMemo(
    () =>
      [
        !isHomeTab && {
          items: [
            {
              shortcutKeys: EShortcutEvents.AddOrRemoveBookmark,
              label: intl.formatMessage({
                id: tab?.isBookmark
                  ? ETranslations.explore_remove_bookmark
                  : ETranslations.explore_add_bookmark,
              }),
              icon: tab?.isBookmark ? 'StarSolid' : 'StarOutline',
              onPress: () => {
                if (tab) {
                  onBookmarkPress(!tab?.isBookmark, tab?.url, tab?.title ?? '');
                }
              },
              testID: `action-list-item-${
                !tab?.isBookmark ? 'bookmark' : 'remove-bookmark'
              }`,
            },
            {
              shortcutKeys: EShortcutEvents.PinOrUnpinTab,
              label: intl.formatMessage({
                id: tab?.isPinned
                  ? ETranslations.explore_unpin
                  : ETranslations.explore_pin,
              }),
              icon: tab?.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
              onPress: () => {
                if (tab) {
                  onPinnedPress(tab?.id, !tab?.isPinned);
                }
              },
              testID: `action-list-item-${!tab?.isPinned ? 'pin' : 'un-pin'}`,
            },
            {
              label: intl.formatMessage({
                id: ETranslations.explore_rename,
              }),
              icon: 'PencilOutline',
              onPress: () => {
                if (tab) {
                  void handleRenameTab(tab);
                }
              },
              testID: `action-list-item-rename`,
            },
          ].filter(Boolean) as IActionListItemProps[],
        },
        !isHomeTab && {
          items: [
            {
              shortcutKeys: EShortcutEvents.CopyAddressOrUrl,
              label: intl.formatMessage({
                id: ETranslations.global_copy_url,
              }),
              icon: 'LinkOutline',
              onPress: () => {
                if (tab?.url) {
                  copyText(tab.url);
                }
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
              label: intl.formatMessage({
                id: ETranslations.explore_disconnect,
              }),
              icon: 'BrokenLinkOutline',
              onPress: () => {
                void onDisconnect(tab?.url);
              },
              testID: `action-list-item-disconnect`,
            },
            !tab?.isPinned && {
              shortcutKeys: EShortcutEvents.CloseTab,
              label: intl.formatMessage({
                id: ETranslations.explore_close_tab,
              }),
              icon: 'CrossedLargeOutline',
              onPress: closeTab,
              testID: `action-list-item-close`,
            },
          ].filter(Boolean) as IActionListItemProps[],
        },
      ].filter(Boolean),
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
      closeTab,
      isHomeTab,
    ],
  );
  if (!tab) {
    return null;
  }

  return (
    <DesktopTabItem
      size="small"
      showAvatar={!isHomeTab}
      icon={isHomeTab ? 'Ai3StarOutline' : undefined}
      shortcutKey={shortcutKey}
      key={id}
      selected={isActive}
      onPress={() => onPress(id)}
      label={
        (tab?.customTitle?.length ?? 0) > 0 ? tab?.customTitle : tab?.title
      }
      avatarSrc={tab?.favicon}
      testID={testID}
      id={id}
      actionList={actionListItems}
      onClose={closeTab}
    />
  );
}

export default memo(
  DesktopCustomTabBarItem,
  (prevProps, nextProps) => prevProps.id === nextProps.id,
);
