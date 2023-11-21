import { memo, useEffect, useRef } from 'react';

import { Stack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../../../../routes/Root/Tab/Routes';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';
import { DesktopOverlay } from '../../components/WebView/DesktopOverlay';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();

  const navigation = useAppNavigation();
  const firstRender = useRef(true);
  useEffect(() => {
    if (!firstRender.current && tabs.length === 0) {
      navigation.switchTab(ETabRoutes.Discovery);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs, navigation]);

  return (
    <Stack flex={1} zIndex={3}>
      {tabs.map((t) => (
        <>
          <DesktopBrowserNavigationContainer
            key={`DesktopBrowserNavigationContainer-${t.id}`}
            id={t.id}
            activeTabId={activeTabId}
          />
          <DesktopBrowserContent
            key={t.id}
            id={t.id}
            activeTabId={activeTabId}
          />
        </>
      ))}
      <DesktopOverlay />
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
