import { memo } from 'react';

import { Divider, Stack } from '@onekeyhq/components';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withProviderWebTabs } from '../Context/contextWebTabs';

function DesktopCustomTabBar() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab } = useWebTabAction();
  return (
    <Stack>
      <Divider py="$4" />
      {tabs.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onCloseTab={(id) => {
            closeWebTab(id);
          }}
        />
      ))}
    </Stack>
  );
}

export default memo(withProviderWebTabs(DesktopCustomTabBar));
