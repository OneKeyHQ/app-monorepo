import React, { FC, useCallback, useMemo, useRef, useState } from 'react';

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
  Modal,
  Pressable,
  Searchbar,
  Spinner,
  Token as TokenImage,
  TokenVerifiedIcon,
  Typography,
  useToast,
  utils,
} from '@onekeyhq/components';
import { Text } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';
import IconSearch from '@onekeyhq/kit/assets/3d_search.png';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import {
  useAccountTokens,
  useAccountTokensBalance,
  useActiveWalletAccount,
  useDebounce,
  useNetworkTokens,
} from '../../hooks';
import { timeout } from '../../utils/helper';
import { showOverlay } from '../../utils/overlayUtils';

import { useSearchTokens } from './hooks';
import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

type HeaderTokensProps = {
  tokens: Token[];
  showTopsLabel?: boolean;
  onDelete?: (token: Token) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  showTopsLabel,
  onDelete,
}) => {
  const intl = useIntl();
  const { networkId, accountId } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(networkId, accountId);
  const navigation = useNavigation<NavigationProps>();

  const onDetail = useCallback(
    (token: Token) => {
      navigation.navigate(ManageTokenRoutes.ViewToken, {
        name: token.name,
        symbol: token.symbol,
        address: token.tokenIdOnNetwork,
        decimal: token.decimals,
        logoURI: token.logoURI,
        verified: token.verified,
        source: token.source || [],
      });
    },
    [navigation],
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
          <Box mt="2" mb="6">
            {tokens.map((item, index) => (
              <Pressable
                onPress={() => onDetail(item)}
                key={item.tokenIdOnNetwork}
                borderTopRadius={index === 0 ? '12' : undefined}
                borderBottomRadius={
                  index === tokens.length - 1 ? '12' : undefined
                }
                flexDirection="row"
                justifyContent="space-between"
                p="4"
                alignItems="center"
                borderTopColor="divider"
                borderTopWidth={index !== 0 ? '1' : undefined}
                bg="surface-default"
                _hover={{ bgColor: 'surface-hovered' }}
                _pressed={{ bgColor: 'surface-pressed' }}
              >
                <Box
                  display="flex"
                  alignItems="center"
                  flexDirection="row"
                  flex={1}
                >
                  <TokenImage size={8} src={item.logoURI} />
                  <Box ml="3" flex={1}>
                    <Box flexDirection="row" alignItems="center">
                      <Text
                        maxW={56}
                        numberOfLines={1}
                        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      >
                        {item.name}
                      </Text>
                      <TokenVerifiedIcon token={item} />
                    </Box>
                    <Typography.Body2
                      maxW="56"
                      numberOfLines={1}
                      color="text-subdued"
                    >
                      <FormatBalance
                        balance={balances[item.tokenIdOnNetwork] ?? '0'}
                        suffix={item.symbol}
                        formatOptions={{ fixed: 6 }}
                      />
                    </Typography.Body2>
                  </Box>
                </Box>
                <IconButton
                  name="TrashSolid"
                  type="plain"
                  circle
                  onPress={() => onDelete?.(item)}
                />
              </Pressable>
            ))}
          </Box>
        </Box>
      ) : null}
      {showTopsLabel ? (
        <Typography.Subheading color="text-subdued" mb="2">
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
  showTopsLabel: boolean;
  tokens: Token[];
  keyword: string;
  terms?: string;
  onChange: (keyword: string) => void;
  onDelete?: (token: Token) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  showTopsLabel,
  keyword,
  terms,
  onChange,
  onDelete,
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
          onDelete={onDelete}
          showTopsLabel={showTopsLabel}
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
      imageUrl={IconSearch}
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

type ListRenderTokenProps = {
  item: Token;
  borderTopRadius?: string;
  borderBottomRadius?: string;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({
  item,
  borderTopRadius,
  borderBottomRadius,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const { accountId, networkId } = useActiveWalletAccount();
  const accountTokens = useAccountTokens(networkId, accountId);

  const isOwned = accountTokens.some(
    (t) => item.tokenIdOnNetwork === t.tokenIdOnNetwork && !t.autoDetected,
  );

  const onPress = useCallback(async () => {
    if (accountId && networkId) {
      try {
        await timeout(
          backgroundApiProxy.engine.quickAddToken(
            accountId,
            networkId,
            item.tokenIdOnNetwork,
            undefined,
            { autoDetected: false },
          ),
          5000,
        );
      } catch (e) {
        toast.show(
          {
            title: intl.formatMessage({ id: 'msg__failed_to_add_token' }),
          },
          {
            type: 'error',
          },
        );
        return;
      }
      toast.show({ title: intl.formatMessage({ id: 'msg__token_added' }) });
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
      });
    }
  }, [intl, accountId, networkId, toast, item.tokenIdOnNetwork]);

  const onDetail = useCallback(() => {
    const routeName = isOwned
      ? ManageTokenRoutes.ViewToken
      : ManageTokenRoutes.AddToken;
    navigation.navigate(routeName, {
      name: item.name,
      symbol: item.symbol,
      address: item.tokenIdOnNetwork,
      decimal: item.decimals,
      logoURI: item.logoURI,
      verified: item.verified,
      source: item.source || [],
    });
  }, [navigation, item, isOwned]);
  return (
    <Pressable
      borderTopRadius={borderTopRadius}
      borderBottomRadius={borderBottomRadius}
      flexDirection="row"
      justifyContent="space-between"
      p={4}
      alignItems="center"
      overflow="hidden"
      key={item.tokenIdOnNetwork}
      onPress={onDetail}
      bg="surface-default"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
    >
      <Box display="flex" alignItems="center" flexDirection="row" flex={1}>
        <TokenImage size={8} src={item.logoURI} />
        <Box ml="3" flex={1}>
          <Box alignItems="center" flexDirection="row">
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              maxW="56"
              numberOfLines={1}
              color={isOwned ? 'text-disabled' : 'text-default'}
            >
              {item.name}
            </Text>
            <TokenVerifiedIcon token={item} />
          </Box>
          <Typography.Body2
            numberOfLines={1}
            color={isOwned ? 'text-disabled' : 'text-subdued'}
          >
            {item.symbol}
          </Typography.Body2>
          <Typography.Body2
            numberOfLines={1}
            color={isOwned ? 'text-disabled' : 'text-subdued'}
          >
            {utils.shortenAddress(item.tokenIdOnNetwork)}
          </Typography.Body2>
        </Box>
      </Box>
      <Box>
        {isOwned ? (
          <Box p={2}>
            <Icon name="CheckSolid" color="interactive-disabled" />
          </Box>
        ) : (
          <IconButton
            name="PlusSolid"
            type="plain"
            circle
            p="4"
            onPromise={onPress}
          />
        )}
      </Box>
    </Pressable>
  );
};

type ListingModalProps = {
  onRemoveAccountToken: (token: Token) => void;
};

export const ListingModal: FC<ListingModalProps> = ({
  onRemoveAccountToken,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const {
    network: activeNetwork,
    accountId,
    networkId,
  } = useActiveWalletAccount();
  const accountTokens = useAccountTokens(networkId, accountId);
  const networkTokens = useNetworkTokens(networkId);
  const headerTokens = useMemo(
    () => accountTokens.filter((i) => i.tokenIdOnNetwork && !i.autoDetected),
    [accountTokens],
  );
  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 1000);

  const { loading, searchedTokens } = useSearchTokens(
    terms,
    keyword,
    networkId,
    accountId,
  );

  const listItems = useMemo(
    () => (terms ? searchedTokens : networkTokens),
    [terms, searchedTokens, networkTokens],
  );

  const renderItem: ListRenderItem<Token> = useCallback(
    ({ item, index }) => (
      <ListRenderToken
        item={item}
        borderTopRadius={index === 0 ? '12' : undefined}
        borderBottomRadius={index === listItems.length - 1 ? '12' : undefined}
      />
    ),
    [listItems.length],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({
          id: 'title__manage_tokens',
          defaultMessage: 'Manage Tokens',
        })}
        height="560px"
        headerDescription={activeNetwork?.shortName}
        hidePrimaryAction
        onSecondaryActionPress={() => {
          navigation.navigate(ManageTokenRoutes.CustomToken);
        }}
        secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
        secondaryActionTranslationId="action__add_custom_tokens"
        flatListProps={{
          data: listItems,
          // @ts-ignore
          renderItem,
          ItemSeparatorComponent: Divider,
          keyExtractor: (item) => (item as Token).tokenIdOnNetwork,
          showsVerticalScrollIndicator: false,
          ListEmptyComponent: (
            <ListEmptyComponent isLoading={loading} terms={terms} />
          ),
          ListHeaderComponent: (
            <Header
              showTopsLabel={networkTokens.length > 0}
              tokens={headerTokens}
              keyword={keyword}
              terms={terms}
              onChange={setKeyword}
              onDelete={onRemoveAccountToken}
            />
          ),
        }}
      />
    </>
  );
};

export const Listing: FC = () => {
  const intl = useIntl();
  const { accountId, networkId } = useActiveWalletAccount();

  const openDeleteDialog = useCallback(
    (token?: Token) => {
      if (!token) {
        return;
      }
      showOverlay((closeOverlay) => (
        <Dialog
          visible
          onClose={closeOverlay}
          footerButtonProps={{
            primaryActionTranslationId: 'action__delete',
            primaryActionProps: {
              type: 'destructive',
              onPromise: async () => {
                if (accountId && token) {
                  await backgroundApiProxy.engine.removeTokenFromAccount(
                    accountId,
                    token.id,
                  );
                }
                backgroundApiProxy.serviceToken
                  .fetchAccountTokens({
                    activeAccountId: accountId,
                    activeNetworkId: networkId,
                  })
                  .finally(closeOverlay);
              },
            },
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
              { token: token.name },
            ),
          }}
        />
      ));
    },
    [accountId, intl, networkId],
  );

  useFocusEffect(
    useCallback(() => {
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
        withPrice: true,
      });
      backgroundApiProxy.serviceToken.fetchTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
        withBalance: true,
        withPrice: true,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return <ListingModal onRemoveAccountToken={openDeleteDialog} />;
};

export default Listing;
