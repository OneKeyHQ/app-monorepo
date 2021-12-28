import React, { FC } from 'react';

import { TouchableOpacity } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Flex,
  Icon,
  IconButton,
  ScrollView,
  Token,
  Typography,
} from '@onekeyhq/components';

type ChainInfo = { chain: string; name: string };

const evmNetworks: ChainInfo[] = [
  { chain: 'eth', name: 'ETH' },
  { chain: 'bsc', name: 'BSC' },
  { chain: 'heco', name: 'HECO' },
  { chain: 'localhost', name: 'Localhost' },
];

const solanaNetwork: ChainInfo[] = [{ chain: 'sol', name: 'SOL' }];

export const DisplayView: FC = () => {
  const renderItem = ({ item }: { item: ChainInfo }) => (
    <TouchableOpacity activeOpacity={0.7}>
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        p="4"
      >
        <Token chain={item.chain} name={item.name} size={8} />
        <Icon name="ChevronRightOutline" />
      </Flex>
    </TouchableOpacity>
  );
  return (
    <ScrollView>
      <Box>
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>EVM</Typography.Heading>
          <IconButton type="plain" name="PlusSolid" />
        </Flex>
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
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Heading>Solana</Typography.Heading>
        </Flex>
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
