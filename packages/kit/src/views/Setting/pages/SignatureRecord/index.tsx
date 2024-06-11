import { useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SearchBar, Stack, Tab } from '@onekeyhq/components';
import {
  AllNetworksAvatar,
  NetworkAvatar,
} from '@onekeyhq/kit/src/components/NetworkAvatar';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ConnectedSites } from './ConnectedSites';
import { SignatureContext } from './Context';
import { SignText } from './SignText';
import { Transactions } from './Transactions';

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { searchContent, setSearchContent } = useContext(SignatureContext);
  return (
    <Stack px="$4" w="100%">
      <SearchBar
        value={searchContent}
        onChangeText={setSearchContent}
        placeholder={intl.formatMessage({
          id: ETranslations.global_search_address,
        })}
      />
    </Stack>
  );
};

const PageView = () => {
  const intl = useIntl();
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
      {
        title: intl.formatMessage({ id: ETranslations.settings_transactions }),
        page: Transactions,
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_sign_text }),
        page: SignText,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_connected_sites,
        }),
        page: ConnectedSites,
      },
    ],
    [intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_signature_record,
        })}
        headerRight={headerRight}
      />
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
