import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

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
import { useGeneral, useManageTokens } from '../../hooks/redux';
import useDebounce from '../../hooks/useDebounce';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { MyToken } from '../../store/reducers/general';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: MyToken[];
  onDelToken?: (token: TokenOf) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({ tokens, onDelToken }) => {
  const intl = useIntl();
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
                  description={`${item.balance ?? '0'} ${item.symbol}`}
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
  tokens: MyToken[];
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
  const {
    accountTokens,
    accountTokensSet,
    allTokens,
    updateTokens,
    updateAccountTokens,
  } = useManageTokens();
  const [keyword, setKeyword] = useState<string>('');
  const debouncedKeyword = useDebounce(keyword, 1000);
  const [topTokens, setTopTokens] = useState<TokenOf[]>([]);

  const [searchedTokens, setSearchedTokens] = useState<TokenOf[]>([]);
  const { activeNetwork, activeAccount } = useGeneral();

  const [visible, setVisible] = useState(false);
  const [toDeletedToken, setToDeletedToken] = useState<TokenOf>();

  const onToggle = useCallback((token?: TokenOf) => {
    if (token) {
      setToDeletedToken(token);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    const filtered = allTokens.filter(
      (item) => !accountTokensSet.has(item.tokenIdOnNetwork),
    );
    setTopTokens(filtered);
  }, [allTokens, accountTokens, accountTokensSet]);

  useEffect(() => {
    const allUniqTokens: TokenOf[] = ([] as TokenOf[]).concat(
      accountTokens,
      topTokens,
    );
    const result = allUniqTokens.filter(
      (item) =>
        item.name.toLowerCase().includes(debouncedKeyword.toLowerCase()) ||
        item.symbol.toLowerCase().includes(debouncedKeyword.toLowerCase()) ||
        item.tokenIdOnNetwork.toLowerCase() === debouncedKeyword.toLowerCase(),
    );
    setSearchedTokens(result);
  }, [accountTokens, topTokens, debouncedKeyword]);

  const onDelete = useCallback(async () => {
    if (activeAccount && toDeletedToken) {
      await engine.removeTokenFromAccount(activeAccount.id, toDeletedToken?.id);
    }
    onToggle(undefined);
    updateTokens();
    updateAccountTokens();
  }, [
    activeAccount,
    toDeletedToken,
    updateTokens,
    updateAccountTokens,
    onToggle,
  ]);

  useFocusEffect(updateTokens);
  useFocusEffect(updateAccountTokens);

  const flatListData = useMemo(
    () => (keyword ? searchedTokens : topTokens),
    [keyword, searchedTokens, topTokens],
  );

  const renderItem: ListRenderItem<TokenOf> = useCallback(
    ({ item, index }) => (
      <Box
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={
          index === flatListData.length - 1 ? '12' : undefined
        }
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
        {accountTokensSet.has(item.tokenIdOnNetwork) ? (
          <IconButton
            name="TrashSolid"
            type="plain"
            p="4"
            onPress={() => {
              onToggle(item);
            }}
          />
        ) : (
          <IconButton
            name="PlusSolid"
            type="plain"
            p="4"
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
        )}
      </Box>
    ),
    [navigation, flatListData.length, accountTokensSet, onToggle],
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
          data: flatListData,
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
              tokens={accountTokens}
              keyword={keyword}
              onChange={(text) => setKeyword(text)}
              onDelToken={(token) => onToggle(token)}
            />
          ),
        }}
      />
      <Dialog
        visible={visible}
        onClose={() => onToggle(undefined)}
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
