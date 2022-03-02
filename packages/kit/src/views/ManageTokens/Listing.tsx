import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  Image,
  Modal,
  Searchbar,
  Spinner,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';

import { FormatBalance } from '../../components/Format';
import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';
import useDebounce from '../../hooks/useDebounce';
import { useManageTokens } from '../../hooks/useManageTokens';

import { useSearchTokens } from './hooks';
import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { ValuedToken } from '../../store/reducers/general';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: ValuedToken[];
  topTokens: Token[];
  onDelToken?: (token: Token) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  topTokens,
  onDelToken,
}) => {
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
                <Box display="flex" alignItems="center" flexDirection="row">
                  <Image
                    src={item.logoURI}
                    alt="logoURI"
                    size="8"
                    borderRadius="full"
                    fallbackElement={<Icon name="QuestionMarkOutline" />}
                  />
                  <Box ml="3">
                    <Typography.Body1Strong maxW="56" numberOfLines={2}>
                      {item.name}({item.symbol})
                    </Typography.Body1Strong>
                    <Typography.Body1 numberOfLines={1}>
                      <FormatBalance
                        balance={item?.balance ?? '0'}
                        suffix={item.symbol}
                        formatOptions={{ fixed: 6 }}
                      />
                    </Typography.Body1>
                  </Box>
                </Box>
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
      {topTokens.length ? (
        <Typography.Subheading color="text-subdued" mt="2" mb="3">
          {intl.formatMessage({
            id: 'form__top_50_tokens',
            defaultMessage: 'TOP 50 TOKENS',
          })}
        </Typography.Subheading>
      ) : null}
    </Box>
  );
};

type HeaderProps = {
  topTokens: Token[];
  tokens: ValuedToken[];
  keyword: string;
  terms?: string;
  onChange: (keyword: string) => void;
  onDelToken?: (token: Token) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  topTokens,
  keyword,
  terms,
  onChange,
  onDelToken,
}) => {
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
        onChangeText={(text) => onChange(text)}
      />
      {terms ? null : (
        <HeaderTokens
          tokens={tokens}
          onDelToken={onDelToken}
          topTokens={topTokens}
        />
      )}
    </Box>
  );
};

type ListEmptyComponentProps = {
  isLoading: boolean;
  terms: string;
};

const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  terms,
}) => {
  console.log('rerender', isLoading, terms);
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  return terms.length > 0 ? (
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
        if (isValidateAddr(terms)) {
          params.address = terms;
        }
        navigation.navigate(ManageTokenRoutes.CustomToken, params);
      }}
    />
  ) : null;
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
  const [mylist, setMylist] = useState<Token[]>([]);
  const searchTerm = useDebounce(keyword, 1000);

  const { activeNetwork, activeAccount } = useGeneral();
  const { loading, searchedTokens } = useSearchTokens(
    searchTerm,
    keyword,
    activeNetwork?.network.id,
  );

  const [visible, setVisible] = useState(false);
  const [toDeletedToken, setToDeletedToken] = useState<Token>();

  useEffect(() => {
    setMylist(accountTokens.filter((i) => i.tokenIdOnNetwork));
  }, [accountTokens]);

  const onToggleDeleteDialog = useCallback((token?: Token) => {
    if (token) {
      setToDeletedToken(token);
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  const onDelete = useCallback(async () => {
    if (activeAccount && toDeletedToken) {
      await engine.removeTokenFromAccount(activeAccount.id, toDeletedToken?.id);
    }
    onToggleDeleteDialog(undefined);
    updateTokens();
    updateAccountTokens();
  }, [
    activeAccount,
    toDeletedToken,
    updateTokens,
    updateAccountTokens,
    onToggleDeleteDialog,
  ]);

  useFocusEffect(updateTokens);
  useFocusEffect(updateAccountTokens);

  const flatListData = useMemo(
    () => (searchTerm ? searchedTokens : allTokens),
    [searchTerm, searchedTokens, allTokens],
  );

  const renderItem: ListRenderItem<ValuedToken> = useCallback(
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
        overflow="hidden"
        key={item.tokenIdOnNetwork}
      >
        <Box display="flex" alignItems="center" flexDirection="row">
          <Image
            src={item.logoURI}
            alt="logoURI"
            size="8"
            borderRadius="full"
            fallbackElement={<Icon name="QuestionMarkOutline" />}
          />
          <Box ml="3">
            <Typography.Body1Strong
              maxW="56"
              textOverflow="ellipsis"
              numberOfLines={2}
              color={
                accountTokensSet.has(item.tokenIdOnNetwork)
                  ? 'text-disabled'
                  : 'text-default'
              }
            >
              {item.name}({item.symbol})
            </Typography.Body1Strong>
            <Typography.Body1
              numberOfLines={1}
              color={
                accountTokensSet.has(item.tokenIdOnNetwork)
                  ? 'text-disabled'
                  : 'text-subdued'
              }
            >
              {item?.balance
                ? `${item.balance} ${item.symbol}`
                : utils.shortenAddress(item.tokenIdOnNetwork)}
            </Typography.Body1>
          </Box>
        </Box>
        <Box>
          {accountTokensSet.has(item.tokenIdOnNetwork) ? (
            <Icon name="CheckSolid" color="interactive-disabled" />
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
      </Box>
    ),
    [navigation, flatListData.length, accountTokensSet],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        height="560px"
        headerDescription={activeNetwork?.network.shortName}
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
          keyExtractor: (item) => (item as Token).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={loading} terms={searchTerm} />
          ),
          ListHeaderComponent: (
            <Header
              topTokens={allTokens}
              tokens={mylist}
              keyword={keyword}
              terms={searchTerm}
              onChange={(text) => setKeyword(text)}
              onDelToken={(token) => onToggleDeleteDialog(token)}
            />
          ),
        }}
      />
      <Dialog
        visible={visible}
        onClose={() => onToggleDeleteDialog(undefined)}
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
