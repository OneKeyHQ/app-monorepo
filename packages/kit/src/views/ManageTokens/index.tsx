import React, { FC, ReactElement, useMemo, useState } from 'react';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  FlatList,
  Flex,
  IconButton,
  Modal,
  Searchbar,
  Token,
  Typography,
  utils,
} from '@onekeyhq/components';

import AddCustomToken from './AddCustomToken';
import AddTokenModal from './AddToken';

type IToken = {
  name: string;
  symbol: string;
  address: string;
};

const top50list: IToken[] = [
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

const mylist: IToken[] = [
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
  const [token, setToken] = useState<IToken>();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);

  const searched = useMemo(() => {
    if (!keyword) {
      return [];
    }
    const allTokens: IToken[] = ([] as IToken[]).concat(mylist, top50list);
    const result = allTokens.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword.toLowerCase()) ||
        item.symbol.toLowerCase().includes(keyword.toLowerCase()),
    );
    return result;
  }, [keyword]);

  const renderItem = ({ item }: { item: IToken }) => (
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
  const renderOwnedItem = ({ item }: { item: IToken }) => (
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

  let contentView: ReactElement | undefined;
  if (keyword) {
    contentView = searched.length ? (
      <FlatList
        bg="surface-default"
        borderRadius="12"
        mt="3"
        mb="3"
        data={searched}
        renderItem={renderOwnedItem}
        ItemSeparatorComponent={() => <Divider />}
        keyExtractor={(_, index: number) => index.toString()}
        showsVerticalScrollIndicator={false}
      />
    ) : (
      <Empty
        title="No Result"
        subTitle="The token you searched for was not found"
        actionTitle="Add Custom Token"
        handleAction={() => {}}
      />
    );
  } else {
    contentView = (
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
    );
  }

  return (
    <>
      <Modal
        trigger={trigger}
        header="Manage Tokens"
        hideSecondaryAction
        onPrimaryActionPress={() => {
          setShowAddCustomModal(true);
        }}
      >
        <Flex>
          <Searchbar
            w="full"
            placeholder="Search Tokens"
            mb="6"
            value={keyword}
            onClear={() => setKeyword('')}
            onChangeText={(text) => setKeyword(text.trim())}
          />
          {contentView}
        </Flex>
      </Modal>
      <AddTokenModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
      <AddCustomToken
        visible={showAddCustomModal}
        defaultValues={{ address: '', symbol: '', decimal: '' }}
        onSubmit={() => {
          setShowAddCustomModal(false);
        }}
        onClose={() => setShowAddCustomModal(false)}
      />
    </>
  );
};

export default TokensModal;
