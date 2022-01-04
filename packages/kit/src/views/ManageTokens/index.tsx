import React, { FC, ReactElement, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  FlatList,
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
  const intl = useIntl();
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
    <Box
      display="flex"
      flexDirection="row"
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
    </Box>
  );
  const renderOwnedItem = ({ item }: { item: IToken }) => (
    <Box
      display="flex"
      flexDirection="row"
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
    </Box>
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
        title={intl.formatMessage({
          id: 'content__no_results',
          defaultMessage: 'No Result',
        })}
        subTitle={intl.formatMessage({
          id: 'content__no_results_desc',
          defaultMessage: 'The token you searched for was not found',
        })}
        actionTitle={intl.formatMessage({
          id: 'action__add_custom_tokens',
          defaultMessage: 'Add Custom Token',
        })}
        handleAction={() => {}}
      />
    );
  } else {
    contentView = (
      <Box>
        <Box>
          <Typography.Heading>
            {intl.formatMessage({
              id: 'form__my_tokens',
              defaultMessage: 'MY TOKENS',
            })}
          </Typography.Heading>
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
          <Typography.Heading>
            {intl.formatMessage({
              id: 'form__top_50_tokens',
              defaultMessage: 'TOP 50 TOKENS',
            })}
          </Typography.Heading>
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
      </Box>
    );
  }

  return (
    <>
      <Modal
        trigger={trigger}
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        hideSecondaryAction
        onPrimaryActionPress={() => {
          setShowAddCustomModal(true);
        }}
        primaryActionTranslationId="action__add_custom_tokens"
        primaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
      >
        <>
          <Box>
            <Searchbar
              w="full"
              placeholder={intl.formatMessage({
                id: 'form__search_tokens',
                defaultMessage: 'Search Tokens',
              })}
              mb="6"
              value={keyword}
              onClear={() => setKeyword('')}
              onChangeText={(text) => setKeyword(text.trim())}
            />
            {contentView}
          </Box>
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
          <Dialog
            visible={!!token}
            onClose={() => setToken(undefined)}
            footerButtonProps={{
              onPrimaryActionPress: () => setToken(undefined),
              primaryActionTranslationId: 'action__delete',
              primaryActionProps: { type: 'destructive' },
            }}
            contentProps={{
              iconType: 'danger',
              title: intl.formatMessage({
                id: 'modal__delete_this_token',
                defaultMessage: 'Delete this token?',
              }),
              content: intl.formatMessage(
                {
                  id: 'modal__delete_this_token_desc',
                  defaultMessage: '{token} will be removed from my tokens',
                },
                { token: token?.name },
              ),
            }}
          />
        </>
      </Modal>
    </>
  );
};

export default TokensModal;
