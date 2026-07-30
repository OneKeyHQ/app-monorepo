import { memo, useCallback, useEffect, useMemo } from 'react';

import { Page, Stack } from '@onekeyhq/components';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import type {
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import CustomInjectedToolbar from '../../components/CustomInjectedToolbar';
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
import { webviewRefs } from '../../utils/explorerUtils';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const isHomeType = activeTab?.type === 'home';
  const { addBrowserHomeTab, setWebTabData } = useBrowserTabActions().current;

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

  const selectCustomInjectedProtocol = useCallback(
    (
      protocol: ICustomInjectedProtocol,
      customSession: ICustomInjectedSession,
    ) => {
      if (!activeTab?.id || !activeTab.customInjected) {
        return;
      }
      const shouldRemountWebView =
        activeTab.customInjected.preloadUrl !== customSession.preloadUrl;
      setWebTabData({
        id: activeTab.id,
        url: protocol.url,
        title: protocol.name,
        customInjected: {
          sessionId: customSession.sessionId,
          protocolId: protocol.id,
          preloadUrl: customSession.preloadUrl,
          bundleSha256: customSession.bundleSha256,
          registrySha256: customSession.registrySha256,
        },
      });
      if (!shouldRemountWebView) {
        webviewRefs[activeTab.id]?.loadURL(protocol.url);
      }
    },
    [activeTab, setWebTabData],
  );

  const reloadCustomInjectedWebView = useCallback(
    (customSession: ICustomInjectedSession) => {
      if (!activeTab?.id || !activeTab.customInjected) {
        return;
      }
      const protocol = customSession.protocols.find(
        (candidate) => candidate.id === activeTab.customInjected?.protocolId,
      );
      if (!protocol) {
        return;
      }
      const shouldRemountWebView =
        activeTab.customInjected.preloadUrl !== customSession.preloadUrl;
      setWebTabData({
        id: activeTab.id,
        url: protocol.url,
        title: protocol.name,
        customInjected: {
          ...activeTab.customInjected,
          preloadUrl: customSession.preloadUrl,
          bundleSha256: customSession.bundleSha256,
          registrySha256: customSession.registrySha256,
        },
      });
      if (!shouldRemountWebView) {
        webviewRefs[activeTab.id]?.reload();
      }
    },
    [activeTab, setWebTabData],
  );

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
        <Stack flex={1}>
          {orderTabs.map((t) => (
            <DesktopBrowserContent
              key={t.id}
              id={t.id}
              activeTabId={activeTabId}
            />
          ))}
        </Stack>
        {activeTab?.customInjected ? (
          <CustomInjectedToolbar
            activeBundleSha256={activeTab.customInjected.bundleSha256}
            selectedProtocolId={activeTab.customInjected.protocolId}
            sessionId={activeTab.customInjected.sessionId}
            onReload={reloadCustomInjectedWebView}
            onSelectProtocol={selectCustomInjectedProtocol}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
