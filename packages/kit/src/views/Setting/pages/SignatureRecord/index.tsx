import { useCallback, useContext, useMemo, useState } from 'react';

import { Button, Page, SearchBar, Stack, Tab } from '@onekeyhq/components';
import {
  AllNetworksAvatar,
  NetworkAvatar,
} from '@onekeyhq/kit/src/components/NetworkAvatar';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';

import { ConnectedSites } from './ConnectedSites';
import { SignatureContext } from './Context';
import { SignText } from './SignText';
import { Transactions } from './Transactions';

const ListHeaderComponent = () => {
  const { searchContent, setSearchContent } = useContext(SignatureContext);
  return (
    <Stack px="$4" w="100%">
      <SearchBar
        value={searchContent}
        onChangeText={setSearchContent}
        placeholder="Enter the address to search"
      />
    </Stack>
  );
};

const PageView = () => {
  const [networkId, setNetworkId] = useState<string>('');
  const [searchContent, setSearchContent] = useState<string>('');

  const memo = useMemo(
    () => ({ networkId, searchContent, setNetworkId, setSearchContent }),
    [networkId, searchContent, setNetworkId, setSearchContent],
  );

  const onShowChainSelector = useConfigurableChainSelector();
  const onPress = useCallback(() => {
    onShowChainSelector({
      defaultNetworkId: networkId,
      enableDangerNetwork: true,
      onSelect(network) {
        if (network.id === dangerAllNetworkRepresent.id) {
          setNetworkId('');
        } else {
          setNetworkId?.(network.id);
        }
      },
    });
  }, [onShowChainSelector, networkId, setNetworkId]);
  const headerRight = useCallback(
    () => (
      <Button onPress={onPress} variant="tertiary">
        {networkId ? (
          <NetworkAvatar size={24} networkId={networkId} />
        ) : (
          <AllNetworksAvatar size={24} />
        )}
      </Button>
    ),
    [onPress, networkId],
  );

  const tabConfig = useMemo(
    () => [
      { title: 'Transactions', page: Transactions },
      { title: 'Sign Text', page: SignText },
      { title: 'Connected Sites', page: ConnectedSites },
    ],
    [],
  );

  return (
    <Page>
      <Page.Header title="Signature Record" headerRight={headerRight} />
      <SignatureContext.Provider value={memo}>
        <Page.Body>
          <Tab.Page
            ListHeaderComponent={<ListHeaderComponent />}
            data={tabConfig}
            initialScrollIndex={0}
          />
        </Page.Body>
      </SignatureContext.Provider>
    </Page>
  );
};

export default PageView;
