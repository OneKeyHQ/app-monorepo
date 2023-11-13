import { memo } from 'react';

import { Stack } from '@onekeyhq/components';

import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';
import { withBrowserProvider } from './WithBrowserProvider';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
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
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopBrowser));
