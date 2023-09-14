import { useCallback, useMemo } from 'react';

import { Box } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useTabConfig } from '../config';

import { Header } from './header';

export const Mobile = () => {
  const tabConfig = useTabConfig();
  const onIndexChange = useCallback(() => {}, []);
  const containerStyle = useMemo(
    () => ({
      flex: 1,
    }),
    [],
  );
  const contentContainerStyle = useMemo(
    () => (!platformEnv.isWeb ? { paddingBottom: 60 } : undefined),
    [],
  );
  return (
    <Box flex="1" bg="background-default">
      <Tabs.Container
        headerHeight={114}
        stickyTabBar
        onIndexChange={onIndexChange}
        headerView={<Header />}
        containerStyle={containerStyle}
        disableRefresh
      >
        {tabConfig.map((tab) => (
          <Tabs.Tab key={tab.name} name={tab.name} label={tab.label}>
            <Tabs.ScrollView contentContainerStyle={contentContainerStyle}>
              {tab.component}
            </Tabs.ScrollView>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    </Box>
  );
};
