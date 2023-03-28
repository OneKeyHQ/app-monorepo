import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  Token,
  Typography,
} from '@onekeyhq/components';
import type { ChainListConfig } from '@onekeyhq/engine/src/managers/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce, useManageNetworks } from '../../../hooks';
import { ManageNetworkModalRoutes } from '../types';

import type { ManageNetworkRoutesParams } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.Listing
>;

export const ManageNetworkQuickAdd: FC = () => {
  const intl = useIntl();
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const { allNetworks } = useManageNetworks();
  const [loading, setLoading] = useState(false);
  const [currentChain, setCurrentChain] = useState<ChainListConfig | null>(
    null,
  );
  const [chains, setChains] = useState<ChainListConfig[]>([]);
  const [showTestNet, setShowTestNet] = useState(false);
  const navigation = useNavigation<NavigationProps>();

  const { serviceNetwork } = backgroundApiProxy;

  const toggleShowTestNet = useCallback(() => {
    setPage(0);
    setHasMore(true);
    setShowTestNet(!showTestNet);
  }, [showTestNet]);

  const updateSearch = useCallback((s: string) => {
    setPage(0);
    setHasMore(true);
    setSearch(s);
  }, []);

  const keywords = useDebounce(search, 1000);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await serviceNetwork.fetchChainList({
        page,
        pageSize: 50,
        query: keywords,
        showTestNet,
      });
      const data = list.filter(
        (item) => !allNetworks.find((n) => n.id === `evm--${item.chainId}`),
      );
      if (list.length < 50) {
        setHasMore(false);
      }
      if (page > 0) {
        setChains((c) => [...c, ...data]);
      } else {
        setChains(data);
      }
    } catch (error) {
      // pass
    }
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, [allNetworks, serviceNetwork, keywords, showTestNet, page]);

  const toAddChainPage = useCallback(
    async (chain: ChainListConfig) => {
      setCurrentChain(chain);
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
      setCurrentChain(null);
      navigation.navigate(ManageNetworkModalRoutes.AddNetwork, {
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

  const empty = useMemo(() => {
    if (loading) {
      return (
        <Center py="144px">
          <Spinner size="lg" />
        </Center>
      );
    }
    if (!chains.length) {
      return (
        <Empty
          py="96px"
          emoji="🔍"
          title={intl.formatMessage({
            id: 'content__no_results',
            defaultMessage: 'No Result',
          })}
        />
      );
    }
    return null;
  }, [intl, loading, chains]);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'action__quick_add',
      })}
      height="560px"
      footer={null}
    >
      <HStack w="full" mb="4">
        <Searchbar
          flex="1"
          placeholder={intl.formatMessage({ id: 'content__search' })}
          value={search}
          onChangeText={updateSearch}
          onClear={() => updateSearch('')}
          mr="1"
        />
        <Switch
          label={intl.formatMessage({ id: 'form__testnets' })}
          isChecked={showTestNet}
          onToggle={toggleShowTestNet}
        />
      </HStack>
      <List
        onEndReached={() => {
          if (hasMore && !loading) {
            setPage(page + 1);
          }
        }}
        data={chains}
        ListFooterComponent={empty}
        renderItem={({ item }) => (
          <ListItem onPress={() => toAddChainPage(item)} flex={1}>
            <ListItem.Column>
              <Token
                size={8}
                token={{ logoURI: item.logoURI, name: item.name }}
              />
            </ListItem.Column>
            <ListItem.Column
              text={{
                label: item.name,
                description: (
                  <HStack>
                    <Typography.Caption color="text-subdued">
                      {intl.formatMessage({ id: 'content__currency' })}:
                    </Typography.Caption>
                    <Typography.Caption color="text-subdued" ml="1">
                      {item.nativeCurrency?.symbol ?? ''}
                    </Typography.Caption>
                    <Typography.Caption ml="16px" color="text-subdued">
                      {intl.formatMessage({ id: 'form__chain_id' })}:
                    </Typography.Caption>
                    <Typography.Caption color="text-subdued" ml="1">
                      {item.chainId ?? ''}
                    </Typography.Caption>
                  </HStack>
                ),
              }}
              flex={1}
            />
            {item.chainId === currentChain?.chainId ? (
              <ListItem.Column>
                <Spinner />
              </ListItem.Column>
            ) : null}
          </ListItem>
        )}
        keyExtractor={(item, index) =>
          `${item.name ?? ''}_${item.chainId}_${index}`
        }
      />
    </Modal>
  );
};
