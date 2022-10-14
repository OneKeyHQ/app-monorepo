import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  Empty,
  HStack,
  List,
  ListItem,
  Modal,
  Searchbar,
  Spinner,
  Switch,
  Typography,
} from '@onekeyhq/components';
import type { ChainListConfig } from '@onekeyhq/engine/src/managers/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks } from '../../../hooks';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.Listing
>;

export const ManageNetworkQuickAdd: FC = () => {
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const { allNetworks } = useManageNetworks();
  const [loading, setLoading] = useState(false);
  const [chains, setChains] = useState<ChainListConfig[]>([]);
  const [showTestNet, setShowTestNet] = useState(false);
  const navigation = useNavigation<NavigationProps>();

  const { serviceNetwork } = backgroundApiProxy;

  const toggleShowTestNet = useCallback(() => {
    setShowTestNet(!showTestNet);
  }, [showTestNet]);

  const clearSearch = useCallback(() => {
    setSearch('');
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await serviceNetwork.fetchChainList();
      setChains(
        list.filter(
          (item) => !allNetworks.find((n) => n.id === `evm--${item.chainId}`),
        ),
      );
    } catch (error) {
      // pass
    }
    setLoading(false);
  }, [allNetworks, serviceNetwork]);

  const toAddChainPage = useCallback(
    async (chain: ChainListConfig) => {
      let rpc = chain.rpc?.[0] ?? '';
      for (const url of chain.rpc) {
        try {
          const res = await serviceNetwork.preAddNetwork(url);
          if (res && res.chainId) {
            rpc = url;
            break;
          }
        } catch (error) {
          debugLogger.http.warn(`preAddNetwork error: `, error);
        }
      }
      navigation.navigate(ManageNetworkRoutes.AddNetwork, {
        mode: 'add',
        network: {
          name: chain.name ?? '',
          rpcURL: rpc,
          symbol: chain.nativeCurrency?.symbol ?? '',
          explorerURL: chain.explorers?.[0].url ?? '',
          logoURI: chain.logoURI,
        },
      });
    },
    [navigation, serviceNetwork],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const data = useMemo(
    () =>
      chains.filter((item) => {
        const matchFields = [item.name, item.title, item.network].map(
          (f) => f?.toLowerCase() ?? '',
        );
        if (
          !showTestNet &&
          matchFields.find((f) => f.includes('test') || f.includes('devnet'))
        ) {
          return false;
        }
        if (search) {
          return !!matchFields.find((f) => f.includes(search.toLowerCase()));
        }
        return true;
      }),
    [chains, showTestNet, search],
  );

  const empty = useMemo(() => {
    if (loading) {
      return (
        <Center h="full">
          <Spinner size="lg" />
        </Center>
      );
    }
    return (
      <Center h="full">
        <Empty
          emoji="🔍"
          title={intl.formatMessage({
            id: 'content__no_results',
            defaultMessage: 'No Result',
          })}
        />
      </Center>
    );
  }, [intl, loading]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__quick_add',
      })}
      height="560px"
      hideSecondaryAction
      hidePrimaryAction
    >
      <HStack w="full" mb="4">
        <Searchbar
          flex="1"
          placeholder={intl.formatMessage({ id: 'content__search' })}
          value={search}
          onChangeText={setSearch}
          onClear={clearSearch}
          mr="1"
        />
        <Switch
          label={intl.formatMessage({ id: 'form__testnets' })}
          isChecked={showTestNet}
          onToggle={toggleShowTestNet}
        />
      </HStack>
      {data.length > 0 ? (
        <List
          data={data}
          renderItem={({ item }) => (
            <ListItem onPress={() => toAddChainPage(item)} flex={1}>
              <ListItem.Column
                image={{ src: item.logoURI, borderRadius: 'full', size: 8 }}
              />
              <ListItem.Column
                text={{
                  label: item.name,
                  description: (
                    <HStack>
                      <Typography.Caption>
                        {intl.formatMessage({ id: 'content__currency' })}:
                      </Typography.Caption>
                      <Typography.Caption color="text-default" ml="1">
                        {item.nativeCurrency?.symbol ?? ''}
                      </Typography.Caption>
                      <Typography.Caption ml="6">
                        {intl.formatMessage({ id: 'form__chain_id' })}:
                      </Typography.Caption>
                      <Typography.Caption color="text-default" ml="1">
                        {item.chainId ?? ''}
                      </Typography.Caption>
                    </HStack>
                  ),
                }}
                flex={1}
              />
            </ListItem>
          )}
          keyExtractor={(item, index) =>
            `${item.name ?? ''}_${item.chainId}_${index}`
          }
        />
      ) : (
        empty
      )}
    </Modal>
  );
};
