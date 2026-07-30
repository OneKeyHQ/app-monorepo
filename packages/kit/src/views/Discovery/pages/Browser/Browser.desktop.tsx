import { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
import {
  getActiveCustomInjectedWorkspace,
  setActiveCustomInjectedWorkspace,
  subscribeActiveCustomInjectedWorkspace,
} from '@onekeyhq/kit/src/utils/customInjectedWorkspaceRuntime';

import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import CustomInjectedToolbar from '../../components/CustomInjectedToolbar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import {
  useActiveTabId,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { HistoryIconButton } from '../components/HistoryIconButton';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const isHomeType = activeTab?.type === 'home';
  const { addBrowserHomeTab, setWebTabData } = useBrowserTabActions().current;
  const [customSession, setCustomSession] = useState(
    getActiveCustomInjectedWorkspace,
  );
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>();

  useEffect(
    () =>
      subscribeActiveCustomInjectedWorkspace((session) => {
        setCustomSession(session);
      }),
    [],
  );

  useEffect(() => {
    let mounted = true;
    void globalThis.desktopApiProxy.webview
      .getActiveCustomInjectedWorkspace()
      .then((session) => {
        if (mounted) {
          setActiveCustomInjectedWorkspace(session ?? undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedProtocolId((currentProtocolId) => {
      if (
        currentProtocolId &&
        customSession?.protocols.some(
          (protocol) => protocol.id === currentProtocolId,
        )
      ) {
        return currentProtocolId;
      }
      return (
        customSession?.protocols.find(
          (protocol) => protocol.manualReview.state === 'pending',
        )?.id ?? customSession?.protocols[0]?.id
      );
    });
  }, [customSession]);

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
      nextCustomSession: ICustomInjectedSession,
    ) => {
      if (!activeTab?.id) {
        return;
      }
      const shouldRemountWebView =
        customSession?.preloadUrl !== nextCustomSession.preloadUrl;
      setActiveCustomInjectedWorkspace(nextCustomSession);
      setSelectedProtocolId(protocol.id);
      setWebTabData({
        id: activeTab.id,
        url: protocol.url,
        title: protocol.name,
      });
      if (!shouldRemountWebView) {
        webviewRefs[activeTab.id]?.loadURL(protocol.url);
      }
    },
    [activeTab?.id, customSession?.preloadUrl, setWebTabData],
  );

  const reloadCustomInjectedWebView = useCallback(
    (nextCustomSession: ICustomInjectedSession) => {
      if (!activeTab?.id) {
        return;
      }
      const shouldRemountWebView =
        customSession?.preloadUrl !== nextCustomSession.preloadUrl;
      setActiveCustomInjectedWorkspace(nextCustomSession);
      if (!shouldRemountWebView) {
        webviewRefs[activeTab.id]?.reload();
      }
    },
    [activeTab?.id, customSession?.preloadUrl],
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
              desktopPreloadUrl={customSession?.preloadUrl}
            />
          ))}
        </Stack>
        {customSession && selectedProtocolId ? (
          <CustomInjectedToolbar
            activeBundleSha256={customSession.bundleSha256}
            selectedProtocolId={selectedProtocolId}
            sessionId={customSession.sessionId}
            onReload={reloadCustomInjectedWebView}
            onSelectProtocol={selectCustomInjectedProtocol}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
