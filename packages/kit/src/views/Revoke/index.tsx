import React, {
  FC,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Empty,
  ScrollView,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount, useDebounce } from '../../hooks';
import { useCreateExternalAccount } from '../ExternalAccount/useCreateExternalAccount';

import FilterBar, { AssetType } from './FilterBar';
import RevokeHeader from './Header';
import { ERC20TokenList } from './List/ERC20TokenList';
import { ERC721TokenList } from './List/ERC721TokenList';

const defaultFilter = {
  assetType: AssetType.tokens,
  includeUnverifiedTokens: false,
  includeZeroBalancesTokens: false,
};

const RevokePage: FC = () => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const [filters, setFilters] = useState(defaultFilter);
  const [addressOrName, setAddressOrName] = useState<string>('');
  const {
    network,
    account,
    networkId: activeNetworkId,
  } = useActiveWalletAccount();
  const [networkId, setNetworkId] = useState<string>(
    activeNetworkId ?? OnekeyNetwork.eth,
  );
  const { createExternalAccount } = useCreateExternalAccount({
    networkId,
  });

  const keyword = useDebounce(addressOrName, 600);

  const navigation = useNavigation();

  const walletConnectButton = useMemo(() => {
    if (!platformEnv.isWeb || account?.id) {
      return null;
    }
    return (
      <Button onPress={createExternalAccount} mr={6}>
        {intl.formatMessage({ id: 'action__connect_wallet' })}
      </Button>
    );
  }, [intl, createExternalAccount, account?.id]);

  const handleNetworkChange = useCallback((id: string) => {
    setNetworkId(id);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => {
        if (!account?.id) {
          return walletConnectButton;
        }
        if (isVertical) {
          return <NetworkAccountSelectorTrigger />;
        }
        return (
          <Box pr="6">
            <NetworkAccountSelectorTrigger />
          </Box>
        );
      },
    });
  }, [navigation, isVertical, account?.id, walletConnectButton]);

  const content = useMemo(() => {
    if (!addressOrName) {
      return (
        <Empty
          emoji="💁‍♀️️"
          title={intl.formatMessage({
            id: 'title__enter_address_or_connect_wallet',
          })}
          subTitle={intl.formatMessage({
            id: 'title__enter_address_or_connect_wallet_desc',
          })}
        />
      );
    }
    if (network?.impl !== IMPL_EVM) {
      return (
        <Empty
          emoji="🤷‍♀️"
          title={intl.formatMessage(
            {
              id: 'title__str_network_is_not_supported_yet',
            },
            {
              chain: network?.shortName ?? '',
            },
          )}
          subTitle={intl.formatMessage({
            id: 'title__str_network_is_not_supported_yet_desc',
          })}
        />
      );
    }

    return filters.assetType === AssetType.tokens ? (
      <ERC20TokenList
        networkId={networkId}
        addressOrName={keyword}
        filters={filters}
      />
    ) : (
      <ERC721TokenList
        networkId={networkId}
        addressOrName={keyword}
        filters={filters}
      />
    );
  }, [networkId, filters, intl, network, keyword, addressOrName]);

  return (
    <ScrollView
      contentContainerStyle={{
        justifyContent: 'center',
        padding: isVertical ? 16 : 32,
      }}
    >
      <Center flex="1" pb="108px">
        <RevokeHeader
          networkId={networkId}
          onAddressChange={setAddressOrName}
          onNetworkChange={handleNetworkChange}
        />
        <VStack maxW="1030px" w="100%">
          <FilterBar {...filters} onChange={setFilters} />
          {content}
        </VStack>
      </Center>
    </ScrollView>
  );
};

export default RevokePage;
