import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Dialog,
  Empty,
  Icon,
  IconButton,
  Modal,
  Pressable,
  Searchbar,
  Spinner,
  ToastManager,
  Token as TokenImage,
  Typography,
} from '@onekeyhq/components';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import {
  useAccountTokens,
  useActiveWalletAccount,
  useAppSelector,
  useDebounce,
  useNetworkTokens,
} from '../../hooks';
import { useSingleToken, useTokenBalance } from '../../hooks/useTokens';
import { ManageTokenModalRoutes } from '../../routes/routesEnum';
import { deviceUtils } from '../../utils/hardware';
import { showOverlay } from '../../utils/overlayUtils';
import { getTokenValue } from '../../utils/priceUtils';
import { showHomeBalanceSettings } from '../Overlay/HomeBalanceSettings';
import { showManageTokenListingTip } from '../Overlay/MangeTokenListing';

import { notifyIfRiskToken } from './helpers/TokenSecurityModalWrapper';
import { useSearchTokens } from './hooks';

import type { SimplifiedToken } from '../../store/reducers/tokens';
import type { ManageTokenRoutesParams } from './types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

const HeaderTokenItem: FC<
  SimplifiedToken & Pick<HeaderTokensProps, 'onDelete'>
> = (item) => {
  const { tokenIdOnNetwork, onDelete } = item;
  const { networkId, accountId } = useActiveWalletAccount();
  const { token } = useSingleToken(networkId, tokenIdOnNetwork);

  const balance = useTokenBalance({
    accountId,
    networkId,
    token,
    fallback: '0',
  });

  const navigation = useNavigation<NavigationProps>();

  const onDetail = useCallback(
    (t: Token) => {
      navigation.navigate(ManageTokenModalRoutes.ViewToken, {
        ...t,
        decimal: t.decimals,
        source: t.source ?? '',
        address: t.address ?? '',
      });
    },
    [navigation],
  );

  if (!token) {
    return null;
  }

  return (
    <Pressable
      onPress={() => onDetail(token)}
      flexDirection="row"
      justifyContent="space-between"
      p="8px"
      borderRadius="12px"
      alignItems="center"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
    >
      <TokenImage
        size={8}
        token={token}
        showInfo
        flex={1}
        showExtra={false}
        description={
          <FormatBalance
            balance={balance}
            suffix={token.symbol}
            formatOptions={{ fixed: 6 }}
          />
        }
      />
      <IconButton
        name="TrashMini"
        type="plain"
        circle
        onPress={() => onDelete?.(token)}
      />
    </Pressable>
  );
};

type HeaderTokensProps = {
  tokens: SimplifiedToken[];
  showTopsLabel?: boolean;
  onDelete?: (token: Token) => void;
};

const HeaderTokens: FC<HeaderTokensProps> = ({
  tokens,
  showTopsLabel,
  onDelete,
}) => {
  const intl = useIntl();
  return (
    <Box>
      {tokens.length ? (
        <Box>
          <Typography.Subheading px="8px" color="text-subdued">
            {intl.formatMessage({
              id: 'form__my_tokens',
              defaultMessage: 'MY TOKENS',
            })}
          </Typography.Subheading>
          <Box mt="2" mb="6">
            {tokens.map((item) => (
              <HeaderTokenItem
                {...item}
                onDelete={onDelete}
                key={item.tokenIdOnNetwork}
              />
            ))}
          </Box>
        </Box>
      ) : null}
      {showTopsLabel ? (
        <Typography.Subheading px="8px" color="text-subdued" mb="2">
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
  tokens: SimplifiedToken[];
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
      <Box px="8px" mb="6">
        <Searchbar
          w="full"
          placeholder={intl.formatMessage({
            id: 'form__search_tokens',
            defaultMessage: 'Search Tokens',
          })}
          value={keyword}
          onClear={() => onChange('')}
          onChangeText={(text) => onChange(text)}
        />
      </Box>
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
        navigation.navigate(ManageTokenModalRoutes.CustomToken, params);
      }}
    />
  ) : null;
};

type ListRenderTokenProps = {
  item: Token;
  borderTopRadius?: string;
  borderBottomRadius?: string;
};

const ListRenderToken: FC<ListRenderTokenProps> = ({ item }) => {
  const intl = useIntl();

  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProps>();
  const { walletId, accountId, networkId } = useActiveWalletAccount();
  const accountTokens = useAccountTokens(networkId, accountId);
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);

  const isOwned = accountTokens.some(
    (t) => item.tokenIdOnNetwork === t.tokenIdOnNetwork && !t.autoDetected,
  );

  const checkIfShouldActiveToken = useCallback(async () => {
    const vaultSettings = await backgroundApiProxy.engine.getVaultSettings(
      networkId,
    );
    if (!vaultSettings?.activateTokenRequired) {
      return;
    }
    return new Promise((resolve, reject) => {
      navigation.navigate(ManageTokenModalRoutes.ActivateToken, {
        walletId,
        accountId,
        networkId,
        tokenId: item.tokenIdOnNetwork,
        onSuccess: () => {
          resolve(true);
        },
        onFailure: (e) => {
          reject(e);
        },
      });
    });
  }, [walletId, accountId, networkId, item.tokenIdOnNetwork, navigation]);

  const checkTokenVisible = useCallback(async () => {
    const options = {
      title: intl.formatMessage(
        { id: 'msg__str_has_been_added_but_is_hidden' },
        { 0: item.symbol },
      ),
      content: '',
    };
    if (hideRiskTokens) {
      if (item.riskLevel && item.riskLevel > TokenRiskLevel.WARN) {
        options.content = intl.formatMessage(
          { id: 'msg__str_has_been_added_but_is_hidden_desc' },
          { 0: item.symbol },
        );
      }
    }
    if (hideSmallBalance) {
      const { serviceToken, servicePrice } = backgroundApiProxy;
      const [balances] = await serviceToken.getAccountBalanceFromRpc(
        networkId,
        accountId,
        [item.tokenIdOnNetwork],
        false,
        {
          [item.tokenIdOnNetwork]: item,
        },
      );
      const price = await servicePrice.getSimpleTokenPrice({
        networkId,
        tokenId: item.tokenIdOnNetwork,
      });
      const value = getTokenValue({ token: item, price, balances });
      if (value && value.isLessThan(1)) {
        options.content = intl.formatMessage({
          id: 'msg__token_has_been_added_but_is_hiddendesc_desc',
        });
      }
    }
    if (!options.content) {
      return;
    }
    const close = showManageTokenListingTip({
      ...options,
      primaryActionTranslationId: 'action__show_it',
      onPrimaryActionPress: () => {
        close?.();
        showHomeBalanceSettings();
      },
    });
  }, [accountId, hideSmallBalance, hideRiskTokens, intl, item, networkId]);

  const onAddToken = useCallback(async () => {
    const { serviceToken } = backgroundApiProxy;
    try {
      await checkIfShouldActiveToken();
      await serviceToken.addAccountToken(
        networkId,
        accountId,
        item.tokenIdOnNetwork,
      );
    } catch (e) {
      debugLogger.common.error('add token error', e);
      deviceUtils.showErrorToast(e, 'msg__failed_to_add_token');
      return;
    }
    await checkTokenVisible();
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__token_added' }),
    });
  }, [
    accountId,
    networkId,
    intl,
    checkIfShouldActiveToken,
    item,
    checkTokenVisible,
  ]);

  const onPress = useCallback(async () => {
    if (!accountId || !networkId) {
      return;
    }
    setLoading(true);
    await onAddToken();
    notifyIfRiskToken(item);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [item, accountId, networkId, onAddToken]);

  const onDetail = useCallback(() => {
    const routeName = isOwned
      ? ManageTokenModalRoutes.ViewToken
      : ManageTokenModalRoutes.AddToken;
    navigation.navigate(routeName, {
      name: item.name,
      symbol: item.symbol,
      address: item.tokenIdOnNetwork,
      decimal: item.decimals,
      logoURI: item.logoURI,
      source: item.source || '',
      sendAddress: item.sendAddress,
      riskLevel: item.riskLevel,
    });
  }, [navigation, item, isOwned]);

  const actionButton = useMemo(() => {
    if (isOwned) {
      return (
        <Box p={2}>
          <Icon name="CheckMini" color="interactive-disabled" />
        </Box>
      );
    }
    if (loading) {
      return (
        <Box p="2">
          <Spinner size="sm" />
        </Box>
      );
    }
    return (
      <IconButton
        name="PlusMini"
        type="plain"
        circle
        p="4"
        onPromise={onPress}
      />
    );
  }, [loading, onPress, isOwned]);
  return (
    <Pressable
      borderTopRadius="12px"
      borderBottomRadius="12px"
      flexDirection="row"
      justifyContent="space-between"
      p={2}
      alignItems="center"
      overflow="hidden"
      key={item.tokenIdOnNetwork}
      onPress={onDetail}
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
      {actionButton}
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
    ({ item }) => <ListRenderToken item={item} />,
    [],
  );

  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__manage_tokens',
        defaultMessage: 'Manage Tokens',
      })}
      height="560px"
      headerDescription={activeNetwork?.shortName}
      hidePrimaryAction
      onSecondaryActionPress={() => {
        navigation.navigate(ManageTokenModalRoutes.CustomToken);
      }}
      secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
      secondaryActionTranslationId="action__add_custom_tokens"
      flatListProps={{
        data: listItems,
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => {
          const token = item as Token;
          return `${getBalanceKey(token)}`;
        },
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
        mx: '-8px',
      }}
    />
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
                if (!accountId || !token) {
                  return;
                }
                return backgroundApiProxy.serviceToken
                  .deleteAccountToken({
                    accountId,
                    networkId,
                    tokenId: token.id,
                    address: token.address ?? '',
                  })
                  .finally(() => {
                    closeOverlay();
                  });
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

  return <ListingModal onRemoveAccountToken={openDeleteDialog} />;
};

export default Listing;
