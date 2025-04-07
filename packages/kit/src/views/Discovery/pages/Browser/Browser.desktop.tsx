import { memo, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/native';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EMultiTabBrowserRoutes,
  IMultiTabBrowserParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

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

import type { RouteProp } from '@react-navigation/native';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab: activeTab } = useWebTabDataById(activeTabId ?? '');
  const isHomeType = activeTab?.type === 'home';
  const { addBrowserHomeTab } = useBrowserTabActions().current;
  const route =
    useRoute<
      RouteProp<
        IMultiTabBrowserParamList,
        EMultiTabBrowserRoutes.MultiTabBrowser
      >
    >();

  useEffect(() => {
    if (route.params?.action === 'create_new_tab' && platformEnv.isDesktop) {
      addBrowserHomeTab();
    }
  }, [route.params, addBrowserHomeTab]);

  const navigation = useAppNavigation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (
      !firstRender.current &&
      // unpin == 0
      tabs.filter((x) => !x.isPinned).length === 0 &&
      // pin & active == 0
      tabs.filter((x) => x.isPinned && x.isActive).length === 0
    ) {
      navigation.switchTab(ETabRoutes.Discovery);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs, navigation]);

  useDAppNotifyChanges({ tabId: activeTabId });

  // Sort tabs by id to maintain stable order and prevent re-renders
  const orderTabs = useMemo(
    () => [...tabs].sort((a, b) => a.id.localeCompare(b.id)),
    [tabs],
  );

  return (
    <Page>
      <Page.Header
        // @ts-expect-error
        headerTitle={
          !isHomeType ? DesktopBrowserNavigationContainer : undefined
        }
        // @ts-expect-error
        headerRight={!isHomeType ? HeaderRightToolBar : HistoryIconButton}
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
