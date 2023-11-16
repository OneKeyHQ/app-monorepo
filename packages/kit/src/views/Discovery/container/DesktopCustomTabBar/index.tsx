import { memo, useMemo } from 'react';

import { Button, Divider, Stack, Text, YStack } from '@onekeyhq/components';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

function DesktopCustomTabBar() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab, setPinnedTab, closeAllWebTab } =
    useWebTabAction();
  const data = useMemo(() => (tabs ?? []).filter((t) => !t.isPinned), [tabs]);
  const pinnedData = useMemo(
    () => (tabs ?? []).filter((t) => t.isPinned),
    [tabs],
  );
  return (
    <Stack>
      {pinnedData.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onCloseTab={(id) => {
            void closeWebTab(id);
          }}
          onLongPress={(id) => {
            void setPinnedTab({ id, pinned: false });
          }}
        />
      ))}
      <Divider py="$4" />
      {data.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onCloseTab={(id) => {
            void closeWebTab(id);
          }}
          onLongPress={(id) => {
            void setPinnedTab({ id, pinned: true });
          }}
        />
      ))}
      <YStack>
        <Button
          onPress={() => {
            void closeAllWebTab();
          }}
        >
          <Text>CloseAll</Text>
        </Button>
      </YStack>
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
