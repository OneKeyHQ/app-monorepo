import React, { FC, useCallback, useMemo, useState } from 'react';

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
  Typography,
  useToast,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import {
  useAccountTokens,
  useAccountTokensBalance,
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useNetworkTokens,
} from '../../hooks';
import { timeout } from '../../utils/helper';
import { showOverlay } from '../../utils/overlayUtils';
import { getTokenValues } from '../../utils/priceUtils';
import { showHomeBalanceSettings } from '../Overlay/AccountValueSettings';

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
                <TokenImage
                  size={8}
                  token={item}
                  showInfo
                  flex={1}
                  showExtra={false}
                  description={
                    <FormatBalance
                      balance={balances[item.tokenIdOnNetwork] ?? '0'}
                      suffix={item.symbol}
                      formatOptions={{ fixed: 6 }}
                    />
                  }
                />
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
  onChange: (keyword: string) => void;
  onDelete?: (token: Token) => void;
};

const Header: FC<HeaderProps> = ({
  tokens,
  showTopsLabel,
  keyword,
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
      {keyword ? null : (
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
      emoji="🔍"
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
  const { walletId, accountId, networkId } = useActiveWalletAccount();
  const accountTokens = useAccountTokens(networkId, accountId);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);

  const isOwned = accountTokens.some(
    (t) => item.tokenIdOnNetwork === t.tokenIdOnNetwork && !t.autoDetected,
  );

  const onAddToken = useCallback(async () => {
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
      backgroundApiProxy.serviceToken.fetchAccountTokens({
        activeAccountId: accountId,
        activeNetworkId: networkId,
      });
      if (hideSmallBalance) {
        const [balances, prices] = await Promise.all([
          backgroundApiProxy.serviceToken.fetchTokenBalance({
            activeAccountId: accountId,
            activeNetworkId: networkId,
            tokenIds: [item.tokenIdOnNetwork],
          }),
          backgroundApiProxy.serviceToken.fetchPrices({
            activeAccountId: accountId,
            activeNetworkId: networkId,
            tokenIds: [item.tokenIdOnNetwork],
          }),
        ]);
        const [value] = getTokenValues({
          balances,
          prices,
          tokens: [item],
        });
        if (value.isLessThan(1)) {
          toast.show(
            {
              title: intl.formatMessage({
                id: 'msg__token_has_been_added_but_is_hidden',
              }),
            },
            {
              type: 'action',
              text2: intl.formatMessage({
                id: 'action__go_to_setting',
              }),
              onPress: showHomeBalanceSettings,
            },
          );
          return;
        }
      }
      toast.show({ title: intl.formatMessage({ id: 'msg__token_added' }) });
    }
  }, [accountId, networkId, toast, intl, hideSmallBalance, item]);

  const onPress = useCallback(async () => {
    if (accountId && networkId) {
      const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
        networkId,
      );
      if (vaultSettings?.activateTokenRequired) {
        navigation.navigate(ManageTokenRoutes.ActivateToken, {
          walletId,
          accountId,
          networkId,
          tokenId: item.tokenIdOnNetwork,
          onSuccess() {
            onAddToken();
          },
        });
      } else {
        onAddToken();
      }
    }
  }, [
    walletId,
    accountId,
    item.tokenIdOnNetwork,
    navigation,
    networkId,
    onAddToken,
  ]);

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
        <TokenImage
          size={8}
          showInfo
          token={item}
          showExtra
          nameProps={{
            color: isOwned ? 'text-disabled' : 'text-default',
          }}
          descProps={{
            // @ts-ignore
            color: isOwned ? 'text-disabled' : 'text-subdued',
          }}
          extraProps={{
            // @ts-ignore
            color: isOwned ? 'text-disabled' : 'text-subdued',
          }}
        />
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
  const terms = useDebounce(keyword, 500);

  const { loading, searchedTokens } = useSearchTokens(
    terms,
    keyword,
    networkId,
    accountId,
  );

  const listItems = useMemo(
    () => (keyword ? searchedTokens : networkTokens),
    [keyword, searchedTokens, networkTokens],
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
                await backgroundApiProxy.serviceToken.fetchAccountTokens({
                  activeAccountId: accountId,
                  activeNetworkId: networkId,
                });
                closeOverlay();
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
