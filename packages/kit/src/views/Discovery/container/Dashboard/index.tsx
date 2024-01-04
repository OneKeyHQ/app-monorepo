import { useState } from 'react';

import {
  Button,
  Input,
  Page,
  SearchBar,
  Stack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { ERootRoutes } from '../../../../routes/enum';
import { EWalletConnectPages } from '../../../WalletConnect/router';
import { EDiscoveryModalRoutes } from '../../router/Routes';

function Dashboard() {
  const navigation = useAppNavigation();
  const [walletConnectUri, setWalletConnectUri] = useState('');
  const onConnect = async () => {
    console.log('walletConnectUri', walletConnectUri);
    await backgroundApiProxy.walletConnect.initialize();
    await backgroundApiProxy.walletConnect.connect(walletConnectUri);
  };
  return (
    <Page>
      <Page.Body>
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
          <YStack p="$4" space="$4">
            <Input
              value={walletConnectUri}
              onChangeText={setWalletConnectUri}
            />
            <Button onPress={onConnect}>Wallet Connect</Button>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default Dashboard;
