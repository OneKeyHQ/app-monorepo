import { useCallback } from 'react';

import { Button, SearchBar, Stack, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { ETabRoutes } from '../../../../routes/Root/Tab/Routes';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { onItemSelect as onDAppItemSelect } from '../../utils/gotoSite';

import { mockData } from './dataSource';

import type { IDAppItemType } from '../../types';

type IProps = { onItemSelect?: (item: IDAppItemType) => void };

function Dashboard() {
  const navigation = useAppNavigation();
  return (
    <YStack p="$2" alignItems="center" justifyContent="center">
      {/* <Stack
        h="auto"
        w="80%"
        onPress={() => {
          console.log('onPress');
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      > */}
      <SearchBar
        onPress={() => {
          console.log('onPress');
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      />
      {/* </Stack> */}
      <Button
        onPress={() => {
          console.log('onPress');
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      >
        Search Modal
      </Button>
    </YStack>
  );
}

export default Dashboard;
