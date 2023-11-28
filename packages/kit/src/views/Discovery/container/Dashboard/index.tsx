import { Button, SearchBar, Stack, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { EDiscoveryModalRoutes } from '../../router/Routes';

function Dashboard() {
  const navigation = useAppNavigation();
  return (
    <YStack p="$2" alignItems="center" justifyContent="center">
      <Stack
        $md={{
          width: '100%',
        }}
        onPress={() => {
          console.log('onPress');
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      >
        <SearchBar readonly />
      </Stack>

      <Button
        testID="fake-search-modal"
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
