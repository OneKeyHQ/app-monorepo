import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Icon,
  IconButton,
  Token,
  Typography,
} from '@onekeyhq/components';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageNetwork';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ChainInfo = {
  chain: string;
  name: string;
  url: string;
  symbol: string;
  exploreUrl: string;
  chainId: string;
};

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkListViewModal
>;

const evmNetworks: ChainInfo[] = [
  {
    chain: 'eth',
    name: 'ETH',
    chainId: '1',
    url: 'https://rpc.onekey.so/eth',
    symbol: 'ETH',
    exploreUrl: 'https://etherscan.io/',
  },
  {
    chain: 'bsc',
    name: 'BSC',
    chainId: '56',
    url: 'https://rpc.onekey.so/eth',
    symbol: 'BNB',
    exploreUrl: 'https://bscscan.com/',
  },
  {
    chain: 'heco',
    name: 'HECO',
    chainId: '96',
    url: 'https://rpc.onekey.so/eth',
    symbol: 'HT',
    exploreUrl: 'https://scan.hecochain.com/',
  },
  {
    chain: 'localhost',
    name: 'Localhost',
    chainId: '100',
    url: 'https://rpc.onekey.so/eth',
    symbol: 'ETH',
    exploreUrl: 'https://etherscan.io/',
  },
];

const solanaNetwork: ChainInfo[] = [
  {
    chain: 'sol',
    name: 'SOL',
    chainId: '1',
    url: 'https://rpc.onekey.so/eth',
    symbol: 'SOL',
    exploreUrl: 'https://etherscan.io/',
  },
];

export const DisplayView: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const renderItem = ({ item }: { item: ChainInfo }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate(ManageNetworkModalRoutes.NetworkCustomViewModal, {
          defaultValues: item,
          isReadOnly: ['ETH', 'BSC', 'HECO'].includes(item.name.toUpperCase()),
        });
      }}
    >
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
      >
        <Token chain={item.chain} name={item.name} size={{ base: 8, md: 6 }} />
        <Icon size={20} name="ChevronRightSolid" />
      </Box>
    </TouchableOpacity>
  );
  return (
    <>
      <Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>EVM</Typography.Heading>
          <IconButton
            type="plain"
            name="PlusSolid"
            circle
            onPress={() => {
              navigation.navigate(ManageNetworkModalRoutes.NetworkAddViewModal);
            }}
          />
        </Box>
        <FlatList
          bg="surface-default"
          borderRadius="12"
          mt="3"
          mb="3"
          data={evmNetworks}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(_, index: number) => index.toString()}
          showsVerticalScrollIndicator={false}
        />
      </Box>
      <Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>Solana</Typography.Heading>
        </Box>
        <FlatList
          bg="surface-default"
          borderRadius="12"
          mt="3"
          mb="3"
          data={solanaNetwork}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider />}
          keyExtractor={(_, index: number) => index.toString()}
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </>
  );
};
