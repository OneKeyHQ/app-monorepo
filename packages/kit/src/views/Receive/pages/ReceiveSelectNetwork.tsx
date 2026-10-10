import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
  IReceiveNetworkSelection,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ReceiveNetworkList } from '../components/ReceiveNetworkList';
import { ReceiveTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';

// Switch target of a QR page entered by network: the same list as the
// Receive network tab in selector mode (no drill-in chevron, no Lightning).
function ReceiveSelectNetwork() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalReceiveParamList,
        EModalReceiveRoutes.ReceiveSelectNetwork
      >
    >();
  const { walletId, indexedAccountId, accountId, onSelect } = route.params;
  const [searchText, setSearchText] = useState('');

  const handleSelect = useCallback(
    (selection: IReceiveNetworkSelection) => {
      void onSelect(selection);
      navigation.pop();
    },
    [navigation, onSelect],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_select_network })}
      />
      <Page.Body testID={ReceiveTestIDs.SelectNetworkPage}>
        <Stack px="$5" pb="$3">
          <SearchBar
            testID={ReceiveTestIDs.SelectNetworkSearchBar}
            size={platformEnv.isNative ? 'large' : undefined}
            placeholder={intl.formatMessage({
              id: ETranslations.form_search_network_placeholder,
            })}
            value={searchText}
            onChangeText={setSearchText}
          />
        </Stack>
        <ReceiveNetworkList
          testID={ReceiveTestIDs.SelectNetworkList}
          mode="selector"
          walletId={walletId}
          indexedAccountId={indexedAccountId}
          accountId={accountId}
          searchText={searchText}
          onSelectNetwork={handleSelect}
        />
      </Page.Body>
    </Page>
  );
}

export default function ReceiveSelectNetworkWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReceiveSelectNetwork />
    </AccountSelectorProviderMirror>
  );
}
