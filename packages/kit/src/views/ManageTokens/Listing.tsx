import React, { FC, useCallback, useEffect, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  IconButton,
  Modal,
  Searchbar,
  Token,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Token as TokenOf } from '@onekeyhq/engine/src/types/token';

import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';
import useDebounce from '../../hooks/useDebounce';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: TokenOf[];
  onDelToken?: (token: TokenOf) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({ tokens, onDelToken }) => {
  const intl = useIntl();
  const { activeNetwork, activeAccount } = useGeneral();
  const [balances, setBalances] = useState<Record<string, string>>({});

  const fetchBalances = useCallback(async () => {
    if (activeNetwork && activeAccount) {
      const res = await engine.getAccountBalance(
        activeAccount.id,
        activeNetwork?.network.id,
        tokens.map((token) => token.tokenIdOnNetwork),
        true,
      );
      const result: Record<string, string> = {};
      Object.entries(res).forEach(([key, value]) => {
        result[key] = value?.toString() ?? '0';
      });
      setBalances(result);
    }
  }, [tokens, activeNetwork, activeAccount]);

  useFocusEffect(
    useCallback(() => {
      fetchBalances();
    }, [fetchBalances]),
  );

  const getBalance = useCallback(
    (address: string) => {
      if (!address) {
        return balances.main ?? '0';
      }
      return balances[address] ?? '0';
    },
    [balances],
  );
  return (
    <Box>
      {tokens.length ? (
        <Box>
          <Typography.Subheading color="text-subdued">
            {intl.formatMessage({
              id: 'form__my_tokens',
              defaultMessage: 'MY TOKENS',
            })}
          </Typography.Subheading>
          <Box mt="3" mb="3">
            {tokens.map((item, index) => (
              <Box
                key={item.tokenIdOnNetwork}
                borderTopRadius={index === 0 ? '12' : undefined}
                borderBottomRadius={
                  index === tokens.length - 1 ? '12' : undefined
                }
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                p="4"
                alignItems="center"
                bg="surface-default"
                borderTopColor="divider"
                borderTopWidth={index !== 0 ? '1' : undefined}
              >
                <Token
                  src={item.logoURI}
                  size="8"
                  chain="eth"
                  name={item.name}
                  address={item.tokenIdOnNetwork}
                  description={`${getBalance(item.tokenIdOnNetwork)} ${
                    item.symbol
                  }`}
                />
                <IconButton
                  name="TrashSolid"
                  type="plain"
                  onPress={() => onDelToken?.(item)}
                />
              </Box>
            ))}
          </Box>
        </Box>
      ) : null}
      <Typography.Subheading color="text-subdued" mt="2" mb="3">
        {intl.formatMessage({
          id: 'form__top_50_tokens',
          defaultMessage: 'TOP 50 TOKENS',
        })}
      </Typography.Subheading>
    </Box>
  );
};

type HeaderProps = {
  tokens: TokenOf[];
  keyword: string;
  onChange: (keyword: string) => void;
  onDelToken?: (token: TokenOf) => void;
};

const Header: FC<HeaderProps> = ({ tokens, keyword, onChange, onDelToken }) => {
  const intl = useIntl();
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text.trim())}
      />
      {keyword.length ? null : (
        <HeaderTokens tokens={tokens} onDelToken={onDelToken} />
      )}
    </Box>
  );
};

type ListEmptyComponentProps = { keyword: string; searchedTokens: TokenOf[] };

const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  keyword,
  searchedTokens,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  return keyword.length > 0 && searchedTokens.length === 0 ? (
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
      handleAction={() => {
        const params: { address?: string } = {};
        if (isValidateAddr(keyword)) {
          params.address = keyword;
        }
        navigation.navigate(ManageTokenRoutes.CustomToken, params);
      }}
    />
  ) : (
    <Empty
      title={intl.formatMessage({
        id: 'content__no_results',
        defaultMessage: 'No Result',
      })}
    />
  );
};

export const Listing: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const [keyword, setKeyword] = useState<string>('');
  const debouncedKeyword = useDebounce(keyword, 1000);
  const [mylist, setMylist] = useState<TokenOf[]>([]);
  const [top50list, setTop50List] = useState<TokenOf[]>([]);
  const [tokensWithoutOwned, setTokensWithoutOwned] = useState<TokenOf[]>([]);

  const [toDeletedToken, setToDeletedToken] = useState<TokenOf>();
  const [searchedTokens, setSearchedTokens] = useState<TokenOf[]>([]);
  const { activeNetwork, activeAccount } = useGeneral();

  useEffect(() => {
    const myset = new Set(mylist.map((item) => item.tokenIdOnNetwork));
    const filtered = top50list.filter(
      (item) => !myset.has(item.tokenIdOnNetwork),
    );
    setTokensWithoutOwned(filtered);
  }, [top50list, mylist]);

  useEffect(() => {
    const allTokens: TokenOf[] = ([] as TokenOf[]).concat(
      mylist,
      tokensWithoutOwned,
    );
    const result = allTokens.filter(
      (item) =>
        item.name.toLowerCase().includes(debouncedKeyword.toLowerCase()) ||
        item.symbol.toLowerCase().includes(debouncedKeyword.toLowerCase()) ||
        item.tokenIdOnNetwork
          .toLowerCase()
          .includes(debouncedKeyword.toLowerCase()),
    );
    setSearchedTokens(result);
  }, [mylist, tokensWithoutOwned, debouncedKeyword]);

  const fetchTokens = useCallback(async () => {
    if (activeNetwork?.network) {
      const resFortop50list = await engine.getTokens(activeNetwork.network.id);
      setTop50List(resFortop50list);
    }
    if (activeNetwork?.network && activeAccount) {
      const resFormylist = await engine.getTokens(
        activeNetwork.network.id,
        activeAccount.id,
      );
      setMylist(resFormylist);
    }
  }, [activeNetwork, activeAccount]);

  const onDelete = useCallback(async () => {
    if (activeAccount && toDeletedToken) {
      await engine.removeTokenFromAccount(activeAccount.id, toDeletedToken?.id);
    }
    setToDeletedToken(undefined);
    await fetchTokens();
  }, [activeAccount, toDeletedToken, fetchTokens]);

  useFocusEffect(
    useCallback(() => {
      fetchTokens();
    }, [fetchTokens]),
  );

  const renderItem: ListRenderItem<TokenOf> = useCallback(
    ({ item, index }) => (
      <Box
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={index === top50list.length - 1 ? '12' : undefined}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        p="4"
        alignItems="center"
        bg="surface-default"
      >
        <Token
          src={item.logoURI}
          size="8"
          chain="eth"
          name={item.name}
          address={item.tokenIdOnNetwork}
          description={utils.shortenAddress(item.tokenIdOnNetwork)}
        />
        <IconButton
          name="PlusSolid"
          type="plain"
          onPress={() => {
            navigation.navigate(ManageTokenRoutes.AddToken, {
              name: item.name,
              symbol: item.symbol,
              address: item.tokenIdOnNetwork,
              decimal: item.decimals,
              logoURI: item.logoURI,
            });
          }}
        />
      </Box>
    ),
    [navigation, top50list.length],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        height="560px"
        headerDescription={activeNetwork?.network.name}
        hidePrimaryAction
        onSecondaryActionPress={() => {
          navigation.navigate(ManageTokenRoutes.CustomToken);
        }}
        secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
        secondaryActionTranslationId="action__add_custom_tokens"
        flatListProps={{
          data: keyword ? searchedTokens : tokensWithoutOwned,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: () => <Divider />,
          keyExtractor: (item) => (item as TokenOf).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: () => (
            <ListEmptyComponent
              keyword={keyword}
              searchedTokens={searchedTokens}
            />
          ),
          ListHeaderComponent: (
            <Header
              tokens={mylist}
              keyword={keyword}
              onChange={(text) => setKeyword(text)}
              onDelToken={(token) => setToDeletedToken(token)}
            />
          ),
        }}
      />
      <Dialog
        visible={!!toDeletedToken}
        onClose={() => setToDeletedToken(undefined)}
        footerButtonProps={{
          primaryActionTranslationId: 'action__delete',
          primaryActionProps: { type: 'destructive', onPromise: onDelete },
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
            { token: toDeletedToken?.name },
          ),
        }}
      />
    </>
  );
};

export default Listing;
