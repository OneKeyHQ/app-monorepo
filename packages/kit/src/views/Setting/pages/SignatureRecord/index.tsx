import { memo, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack, Tab, XStack } from '@onekeyhq/components';
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

const contentContainerStyle = { paddingTop: 10 };

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

const ChainSelectorCmp = ({
  networkId,
  onPress,
}: {
  networkId: string;
  onPress: () => void;
}) => (
  <XStack
    role="button"
    flexShrink={1}
    alignItems="center"
    p="$1"
    borderRadius="$2"
    hoverStyle={{
      bg: '$bgHover',
    }}
    pressStyle={{
      bg: '$bgActive',
    }}
    focusable
    focusStyle={{
      outlineWidth: 2,
      outlineColor: '$focusRing',
      outlineStyle: 'solid',
    }}
    userSelect="none"
    onPress={onPress}
  >
    {networkId ? (
      <NetworkAvatar size={24} networkId={networkId} />
    ) : (
      <AllNetworksAvatar size={24} />
    )}
  </XStack>
);

const ChainSelector = memo(ChainSelectorCmp);

const PageView = () => {
  const intl = useIntl();
  const [networkId, setNetworkId] = useState<string>('');
  const [searchContent, setSearchContent] = useState<string>('');

  const values = useMemo(
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
    () => <ChainSelector networkId={networkId} onPress={onPress} />,
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
          id: ETranslations.explore_dapp_connections,
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
      <SignatureContext.Provider value={values}>
        <Page.Body>
          <Tab.Page
            ListHeaderComponent={<ListHeaderComponent />}
            data={tabConfig}
            contentContainerStyle={contentContainerStyle}
            initialScrollIndex={0}
          />
        </Page.Body>
      </SignatureContext.Provider>
    </Page>
  );
};

export default PageView;
