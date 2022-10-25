import React, { FC, useLayoutEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Empty, ScrollView, VStack } from '@onekeyhq/components';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';

import { NetworkAccountSelectorTrigger } from '../../components/NetworkAccountSelector';
import { useActiveWalletAccount, useDebounce } from '../../hooks';

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
  const [filters, setFilters] = useState(defaultFilter);
  const [addressOrName, setAddressOrName] = useState<string>('');
  const { networkId, network } = useActiveWalletAccount();

  const keyword = useDebounce(addressOrName, 600);

  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Box pr="6">
          <NetworkAccountSelectorTrigger />
        </Box>
      ),
    });
  }, [navigation]);

  const content = useMemo(() => {
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
  }, [networkId, filters, intl, network, keyword]);

  return (
    <ScrollView
      contentContainerStyle={{
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <Center flex="1" pb="108px">
        <RevokeHeader onAddressChange={setAddressOrName} />
        <VStack maxW="1030px" w="100%">
          <FilterBar {...filters} onChange={setFilters} />
          {content}
        </VStack>
      </Center>
    </ScrollView>
  );
};

export default RevokePage;
