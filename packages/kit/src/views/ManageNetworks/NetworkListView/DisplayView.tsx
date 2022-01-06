import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Icon,
  IconButton,
  ScrollView,
  Token,
  Typography,
} from '@onekeyhq/components';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageNetwork';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ChainInfo = { chain: string; name: string };

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkListViewModal
>;

const evmNetworks: ChainInfo[] = [
  { chain: 'eth', name: 'ETH' },
  { chain: 'bsc', name: 'BSC' },
  { chain: 'heco', name: 'HECO' },
  { chain: 'localhost', name: 'Localhost' },
];

const solanaNetwork: ChainInfo[] = [{ chain: 'sol', name: 'SOL' }];

export const DisplayView: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const renderItem = ({ item }: { item: ChainInfo }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        navigation.navigate(ManageNetworkModalRoutes.NetworkCustomViewModal, {
          defaultValues: {
            name: 'EVM',
            url: 'https://rpc.onekey.so/eth',
            chainId: '1',
            symbol: 'ETH',
            exploreUrl: 'https://etherscan.io/',
          },
        });
      }}
    >
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        p="4"
      >
        <Token chain={item.chain} name={item.name} size={8} />
        <Icon name="ChevronRightOutline" />
      </Box>
    </TouchableOpacity>
  );
  return (
    <ScrollView>
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
    </ScrollView>
  );
};
