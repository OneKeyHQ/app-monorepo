import { memo, useCallback, useContext, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack, Tabs, XStack } from '@onekeyhq/components';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import useConfigurableChainSelector from '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ConnectedSites } from './ConnectedSites';
import { SignatureContext } from './Context';
import { SignText } from './SignText';
import { Transactions } from './Transactions';

const ListHeaderComponent = () => {
  const intl = useIntl();
  const { searchContent, setSearchContent } = useContext(SignatureContext);
  return (
    <Stack px="$4" w="100%" bg="$bgApp" pt="$2.5">
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
    focusVisibleStyle={{
      outlineWidth: 2,
      outlineColor: '$focusRing',
      outlineStyle: 'solid',
    }}
    userSelect="none"
    onPress={onPress}
  >
    <NetworkAvatar size={24} networkId={networkId} />
  </XStack>
);

const ChainSelector = memo(ChainSelectorCmp);

const PageView = () => {
  const intl = useIntl();
  const [networkId, setNetworkId] = useState<string>(
    getNetworkIdsMap().onekeyall,
  );
  const [searchContent, setSearchContent] = useState<string>('');

  const values = useMemo(
    () => ({ networkId, searchContent, setNetworkId, setSearchContent }),
    [networkId, searchContent, setNetworkId, setSearchContent],
  );

  const onShowChainSelector = useConfigurableChainSelector();
  const onPress = useCallback(() => {
    onShowChainSelector({
      defaultNetworkId: networkId,
      onSelect(network) {
        setNetworkId?.(network.id);
      },
    });
  }, [onShowChainSelector, networkId, setNetworkId]);
  const headerRight = useCallback(
    () => <ChainSelector networkId={networkId} onPress={onPress} />,
    [onPress, networkId],
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
          <Tabs.Container
            renderHeader={() => <ListHeaderComponent />}
            containerStyle={{ flex: 1 }}
            renderTabBar={(props) => <Tabs.TabBar {...props} />}
          >
            <Tabs.Tab
              name={intl.formatMessage({
                id: ETranslations.settings_transactions,
              })}
            >
              <Transactions />
            </Tabs.Tab>
            <Tabs.Tab
              name={intl.formatMessage({
                id: ETranslations.settings_sign_text,
              })}
            >
              <SignText />
            </Tabs.Tab>
            <Tabs.Tab
              name={intl.formatMessage({
                id: ETranslations.explore_dapp_connections,
              })}
            >
              <ConnectedSites />
            </Tabs.Tab>
          </Tabs.Container>
        </Page.Body>
      </SignatureContext.Provider>
    </Page>
  );
};

export default PageView;
