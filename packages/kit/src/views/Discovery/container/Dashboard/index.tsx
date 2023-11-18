import { Button, SearchBar, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { EDiscoveryModalRoutes } from '../../router/Routes';

function Dashboard() {
  const navigation = useAppNavigation();
  return (
    <YStack p="$2" alignItems="center" justifyContent="center">
      <SearchBar
        onPress={() => {
          console.log('onPress');
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      />
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
