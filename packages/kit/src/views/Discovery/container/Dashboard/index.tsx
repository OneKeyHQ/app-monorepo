import { Button, SearchBar, Stack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

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
