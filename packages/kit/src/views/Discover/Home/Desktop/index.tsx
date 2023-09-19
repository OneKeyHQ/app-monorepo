import { Box } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { useOnTabChange, useTabConfig } from '../config';

import { Header } from './header';

export const Desktop = () => {
  const tabConfig = useTabConfig();
  const onIndexChange = useOnTabChange();
  return (
    <Box
      flex="1"
      flexDirection="column"
      bg="background-default"
      alignItems="center"
      py="8"
    >
      <Box flex="1" w="full" maxW="998px">
        <Tabs.Container
          headerHeight={114}
          stickyTabBar
          onIndexChange={onIndexChange}
          headerView={<Header />}
        >
          {tabConfig.map((tab) => (
            <Tabs.Tab key={tab.name} name={tab.name} label={tab.label}>
              <Tabs.ScrollView>{tab.component}</Tabs.ScrollView>
            </Tabs.Tab>
          ))}
        </Tabs.Container>
      </Box>
    </Box>
  );
};
