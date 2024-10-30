import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, IconButton, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalShortcutsRoutes } from '@onekeyhq/shared/src/routes/shortcuts';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useActiveTabId, useWebTabDataById } from '../../hooks/useWebTabs';

import type { IWebTab } from '../../types';

export function ShortcutsActionButton() {
  const { gtMd } = useMedia();
  const { activeTabId: id } = useActiveTabId();
  const intl = useIntl();
  const { tab }: { tab: IWebTab | undefined } = useWebTabDataById(id as string);
  const navigation = useAppNavigation();
  const { result: tabDetail, run } = usePromiseResult(async () => {
    const origin = tab?.url ? new URL(tab?.url).origin : null;
    let hasConnectedAccount = false;
    if (origin) {
      const connectedAccounts =
        await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
          origin,
        );
      hasConnectedAccount = (connectedAccounts ?? []).length > 0;
    }
    return { ...tab, hasConnectedAccount };
  }, [tab]);

  const handleDisconnect = useCallback(async () => {
    const url = tab?.url;
    const { origin } = new URL(url ?? '');
    if (origin) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin,
        storageType: 'injectedProvider',
        entry: 'Browser',
      });
      setTimeout(() => run(), 200);
    }
  }, [run, tab?.url]);
  // For dApp connection state update
  useEffect(() => {
    const fn = () => setTimeout(() => run(), 200);
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [run]);
  return gtMd ? (
    <ActionList
      offset={{ mainAxis: 0, crossAxis: 18 }}
      placement="left-end"
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      sections={[
        {
          items: [
            {
              shortcutKeys: EShortcutEvents.ViewBookmark,
              label: intl.formatMessage({
                id: ETranslations.browser_bookmark,
              }),
              icon: 'BookmarkOutline',
              onPress: () => {
                navigation.pushModal(EModalRoutes.DiscoveryModal, {
                  screen: EDiscoveryModalRoutes.BookmarkListModal,
                });
              },
            },
            {
              shortcutKeys: EShortcutEvents.ViewHistory,
              label: intl.formatMessage({
                id: ETranslations.explore_history,
              }),
              icon: 'ClockTimeHistoryOutline',
              onPress: () => {
                navigation.pushModal(EModalRoutes.DiscoveryModal, {
                  screen: EDiscoveryModalRoutes.HistoryListModal,
                });
              },
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.settings_shortcuts,
              }),
              icon: 'ShortcutsCustom',
              onPress: () => {
                navigation.pushModal(EModalRoutes.ShortcutsModal, {
                  screen: EModalShortcutsRoutes.ShortcutsPreview,
                });
              },
            },
          ],
        },
        {
          items: [
            tabDetail?.hasConnectedAccount && {
              label: intl.formatMessage({
                id: ETranslations.explore_disconnect,
              }),
              icon: 'BrokenLinkOutline',
              onPress: handleDisconnect,
              testID: `action-list-item-disconnect`,
            },
          ].filter(Boolean) as IActionListItemProps[],
        },
      ]}
      renderTrigger={
        <IconButton
          ml="$2"
          flex={1}
          icon="DotHorOutline"
          backgroundColor="$bgApp"
        />
      }
    />
  ) : null;
}
