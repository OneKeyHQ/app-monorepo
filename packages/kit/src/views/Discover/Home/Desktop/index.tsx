import { useCallback, useRef } from 'react';

import type { ForwardRefHandle } from '@onekeyhq/app/src/views/NestedTabView/NestedTabView';
import { Box } from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';

import { useOnTabChange, usePressTagEffect, useTabConfig } from '../config';
import { discoverUIEventBus } from '../eventBus';

import { Header } from './header';

export const Desktop = () => {
  const ref = useRef<ForwardRefHandle>(null);
  usePressTagEffect({ ref });
  const tabConfig = useTabConfig();
  const onIndexChange = useOnTabChange();
  const onScroll = useCallback(() => {
    discoverUIEventBus.emit('scroll');
  }, []);
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
          ref={ref}
          onScroll={onScroll}
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
