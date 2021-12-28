import React, { FC, ReactElement, useState } from 'react';

import {
  Box,
  Dialog,
  Divider,
  FlatList,
  Flex,
  IconButton,
  Modal,
  Searchbar,
  Token,
  Typography,
  utils,
} from '@onekeyhq/components';

import AddTokenModal from './AddToken';

type Token = {
  name: string;
  symbol: string;
  address: string;
};

const top50list: Token[] = [
  {
    name: 'Tether USD',
    symbol: 'USDT',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
];

const mylist: Token[] = [
  {
    name: 'HEX',
    symbol: 'HEX',
    address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
  },
  {
    name: 'Uniswap',
    symbol: 'UNI',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  },
];

type TokensModalProps = { trigger?: ReactElement<any> };
const TokensModal: FC<TokensModalProps> = ({ trigger }) => {
  const [keyword, setKeyword] = useState<string>('');
  const [token, setToken] = useState<Token>();
  const [showAddModal, setShowAddModal] = useState(false);
  const renderItem = ({ item }: { item: Token }) => (
    <Flex
      display="flex"
      direction="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Token
        size="8"
        chain="eth"
        name={item.name}
        address={item.address}
        description={utils.shortenAddress(item.address)}
      />
      <IconButton
        name="PlusOutline"
        type="plain"
        onPress={() => setShowAddModal(true)}
      />
    </Flex>
  );
  const renderOwnedItem = ({ item }: { item: Token }) => (
    <Flex
      display="flex"
      direction="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Token
        size="8"
        chain="eth"
        name={item.name}
        address={item.address}
        description={utils.shortenAddress(item.address)}
      />
      <IconButton
        name="TrashOutline"
        type="plain"
        onPress={() => {
          setToken(item);
        }}
      />
    </Flex>
  );

  return (
    <>
      <Modal trigger={trigger} header="Manage Tokens" hideSecondaryAction>
        <Flex>
          <Searchbar
            w="full"
            placeholder="Search Tokens"
            mb="6"
            value={keyword}
            onChangeText={(text) => setKeyword(text.trim())}
          />
          <Box>
            <Box>
              <Typography.Heading>MY TOKENS</Typography.Heading>
              <FlatList
                bg="surface-default"
                borderRadius="12"
                mt="3"
                mb="3"
                data={mylist}
                renderItem={renderOwnedItem}
                ItemSeparatorComponent={() => <Divider />}
                keyExtractor={(_, index: number) => index.toString()}
                showsVerticalScrollIndicator={false}
              />
            </Box>
            <Box>
              <Typography.Heading>TOP 50 TOKENS</Typography.Heading>
              <FlatList
                bg="surface-default"
                borderRadius="12"
                mt="3"
                mb="3"
                data={top50list}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <Divider />}
                keyExtractor={(_, index: number) => index.toString()}
                showsVerticalScrollIndicator={false}
              />
            </Box>
            <Box>
              <Dialog
                visible={!!token}
                onClose={() => setToken(undefined)}
                footerButtonProps={{
                  onPrimaryActionPress: () => setToken(undefined),
                }}
                contentProps={{
                  iconType: 'danger',
                  title: 'Delete this token?',
                  content: `${token?.name ?? 'Token'} (${
                    token?.symbol ?? ''
                  }) will be removed from my tokens`,
                }}
              />
            </Box>
          </Box>
        </Flex>
      </Modal>
      <AddTokenModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
};

export default TokensModal;
