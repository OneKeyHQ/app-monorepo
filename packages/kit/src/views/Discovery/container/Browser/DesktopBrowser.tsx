import { memo } from 'react';

import { Stack } from '@onekeyhq/components';

import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withProviderWebTabs } from '../../store/contextWebTabs';

import DesktopBrowserContent from './DesktopBrowserContent';
import DesktopBrowserNavigationContainer from './DesktopBrowserNavigationContainer';

function DesktopBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  return (
    <Stack flex={1} zIndex={3}>
      {tabs.map((t) => (
        <>
          <DesktopBrowserNavigationContainer
            id={t.id}
            activeTabId={activeTabId}
          />
          <DesktopBrowserContent id={t.id} activeTabId={activeTabId} />
        </>
      ))}
    </Stack>
  );
}

export default memo(withProviderWebTabs(DesktopBrowser));
