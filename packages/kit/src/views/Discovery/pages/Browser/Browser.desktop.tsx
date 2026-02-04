import { memo, useCallback, useEffect, useMemo } from 'react';

import { Page } from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const isHomeType = activeTab?.type === 'home';
  const { addBrowserHomeTab } = useBrowserTabActions().current;

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.CreateNewBrowserTab, addBrowserHomeTab);
    return () => {
      appEventBus.off(EAppEventBusNames.CreateNewBrowserTab, addBrowserHomeTab);
    };
  }, [addBrowserHomeTab]);

  useDAppNotifyChanges({ tabId: activeTabId });

  // Sort tabs by id to maintain stable order and prevent re-renders
  const orderTabs = useMemo(
    () => tabs.toSorted((a, b) => a.id.localeCompare(b.id)),
    [tabs],
  );

  const renderHeaderRight = useCallback(() => {
    if (isHomeType) {
      return <HistoryIconButton />;
    }
    return <HeaderRightToolBar />;
  }, [isHomeType]);

  return (
    <Page>
      <Page.Header
        // @ts-expect-error
        headerTitle={
          !isHomeType ? DesktopBrowserNavigationContainer : undefined
        }
        headerRight={renderHeaderRight}
        headerRightContainerStyle={{
          flexBasis: 'auto',
          flexGrow: 0,
        }}
        headerTitleContainerStyle={{
          maxWidth: '100%',
          flex: 1,
        }}
      />
      <Page.Body>
        {orderTabs.map((t) => (
          <DesktopBrowserContent
            key={t.id}
            id={t.id}
            activeTabId={activeTabId}
          />
        ))}
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
