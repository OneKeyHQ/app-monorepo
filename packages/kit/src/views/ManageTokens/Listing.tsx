/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEqual, isNil, pick } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebounce } from 'use-debounce';

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
import { freezedEmptyArray } from '@onekeyhq/shared/src/consts/sharedConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import {
  useActiveWalletAccount,
  useAppSelector,
  useReduxAccountTokenBalancesMap,
} from '../../hooks';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useSingleToken } from '../../hooks/useTokens';
import { ManageTokenModalRoutes } from '../../routes/routesEnum';
import { deviceUtils } from '../../utils/hardware';
import { showOverlay } from '../../utils/overlayUtils';
import { getTokenValue } from '../../utils/priceUtils';
import { showHomeBalanceSettings } from '../Overlay/HomeBalanceSettings';
import { showManageTokenListingTip } from '../Overlay/MangeTokenListing';

import {
  atomMangeHeaderTokens,
  atomMangeNetworksTokens,
  atomMangeTokensKeywords,
  atomMangeTokensLoading,
  atomMangeTokensRefreshTS,
  useAtomManageTokens,
  withProviderManageTokens,
} from './contextManageTokens';
import { notifyIfRiskToken } from './helpers/TokenSecurityModalWrapper';

import type { IAccountToken } from '../Overview/types';
import type { ManageTokenRoutesParams } from './types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem } from 'react-native';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

function useMangeTokensDataFromRedux({ keywords }: { keywords: string }) {
  const { networkId, accountId } = useActiveWalletAccount();
  const balancesMap = useReduxAccountTokenBalancesMap({
    accountId,
    networkId,
  });

  const [updatedTS] = useAtomManageTokens(atomMangeTokensRefreshTS);

  const result = usePromiseResult(
    () => {
      if (balancesMap || updatedTS) {
        //
      }
      return backgroundApiProxy.serviceToken.buildManageTokensList({
        networkId,
        accountId,
        search: keywords,
      });
    },
    [accountId, networkId, balancesMap, keywords, updatedTS],
    {
      watchLoading: true,
    },
  );

  return result;
}

function HandleRebuildMangeTokens(options: { keywords: string }) {
  const result = useMangeTokensDataFromRedux(options);
  const [headerTokens, setMangeHeaderTokens] = useAtomManageTokens(
    atomMangeHeaderTokens,
  );
  const [networkTokens, setManageNetworksTokens] = useAtomManageTokens(
    atomMangeNetworksTokens,
  );
  const [, setIsLoading] = useAtomManageTokens(atomMangeTokensLoading);
  const [keywords] = useAtomManageTokens(atomMangeTokensKeywords);

  useEffect(() => {
    const data = result.result;
    if (!data) {
      return;
    }
    if (data.headerTokensKeys) {
      if (!isEqual(headerTokens.headerTokensKeys, data.headerTokensKeys)) {
        setMangeHeaderTokens(
          pick(data, 'headerTokensKeys', 'headerTokens', 'headerTokenKeysMap'),
        );
      }
    }
    if (keywords) {
      // search always update network tokens
      setManageNetworksTokens(pick(data, 'networkTokensKeys', 'networkTokens'));
    } else if (
      data.networkTokensKeys?.length &&
      !isEqual(networkTokens?.networkTokensKeys, data.networkTokensKeys)
    ) {
      setManageNetworksTokens(pick(data, 'networkTokensKeys', 'networkTokens'));
    }
  }, [
    keywords,
    result.result,
    headerTokens.headerTokensKeys,
    networkTokens.networkTokensKeys,
    setMangeHeaderTokens,
    setManageNetworksTokens,
  ]);

  useEffect(() => {
    if (!isNil(result.isLoading)) {
      setIsLoading(result.isLoading);
    }
  }, [result.isLoading, setIsLoading]);

  return null;
}

function HeaderTokenItemWithoutMemo(item: IAccountToken) {
  const intl = useIntl();
  const { address, balance } = item;
  const { networkId, accountId } = useActiveWalletAccount();
  const { token } = useSingleToken(networkId, address ?? '');
  const [, updateTs] = useAtomManageTokens(atomMangeTokensRefreshTS);

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

  const onDelete = useCallback(() => {
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
                  updateTs(Date.now());
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
            { token: token?.name },
          ),
        }}
      />
    ));
  }, [accountId, intl, networkId, token, updateTs]);

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
            balance={balance || 0}
            suffix={token.symbol}
            formatOptions={{ fixed: 6 }}
          />
        }
      />
      <IconButton name="TrashMini" type="plain" circle onPress={onDelete} />
    </Pressable>
  );
}
const HeaderTokenItem = memo(HeaderTokenItemWithoutMemo);

function HeaderTokensWithoutMemo() {
  const intl = useIntl();

  const [{ headerTokens: tokens = freezedEmptyArray as IAccountToken[] }] =
    useAtomManageTokens(atomMangeHeaderTokens);
  const [{ networkTokens }] = useAtomManageTokens(atomMangeNetworksTokens);

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
              <HeaderTokenItem {...item} key={item.address ?? ''} />
            ))}
          </Box>
        </Box>
      ) : null}
      {networkTokens?.length > 0 ? (
        <Typography.Subheading px="8px" color="text-subdued" mb="2">
          {intl.formatMessage({
            id: 'form__top_50_tokens',
            defaultMessage: 'TOP 50 TOKENS',
          })}
        </Typography.Subheading>
      ) : null}
    </Box>
  );
}
const HeaderTokens = memo(HeaderTokensWithoutMemo);

function Header() {
  const intl = useIntl();
  const [, updateKeywords] = useAtomManageTokens(atomMangeTokensKeywords);

  const [keywords, setKeywords] = useState('');

  const [terms] = useDebounce(keywords, 600);

  useEffect(() => {
    updateKeywords(terms);
  }, [terms, updateKeywords]);

  const onClear = useCallback(() => setKeywords(''), [setKeywords]);

  return (
    <Box>
      <HandleRebuildMangeTokens keywords={keywords} />
      <Box px="8px" mb="6">
        <Searchbar
          w="full"
          placeholder={intl.formatMessage({
            id: 'form__search_tokens',
            defaultMessage: 'Search Tokens',
          })}
          value={keywords}
          onClear={onClear}
          onChangeText={setKeywords}
        />
      </Box>
      {terms ? null : <HeaderTokens />}
    </Box>
  );
}

function ListEmptyComponentWithoutMemo() {
  const intl = useIntl();
  const [isLoading] = useAtomManageTokens(atomMangeTokensLoading);
  const [keywords] = useAtomManageTokens(atomMangeTokensKeywords);
  const navigation = useNavigation<NavigationProps>();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  return keywords.length > 0 ? (
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
        if (isValidateAddr(keywords)) {
          params.address = keywords;
        }
        navigation.navigate(ManageTokenModalRoutes.CustomToken, params);
      }}
    />
  ) : null;
}
const ListEmptyComponent = memo(ListEmptyComponentWithoutMemo);

function ListRenderTokenWithoutMemo({
  isOwned,
  ...item
}: Token & {
  isOwned: boolean;
}) {
  const intl = useIntl();

  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProps>();
  const { walletId, accountId, networkId } = useActiveWalletAccount();
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);

  const { tokenIdOnNetwork, symbol, riskLevel } = item;

  const [, updateTs] = useAtomManageTokens(atomMangeTokensRefreshTS);

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
        tokenId: tokenIdOnNetwork,
        onSuccess: () => {
          resolve(true);
        },
        onFailure: (e) => {
          reject(e);
        },
      });
    });
  }, [walletId, accountId, networkId, tokenIdOnNetwork, navigation]);

  const checkTokenVisible = useCallback(async () => {
    const options = {
      title: intl.formatMessage(
        { id: 'msg__str_has_been_added_but_is_hidden' },
        { 0: symbol },
      ),
      content: '',
    };
    if (hideRiskTokens) {
      if (riskLevel && riskLevel > TokenRiskLevel.WARN) {
        options.content = intl.formatMessage(
          { id: 'msg__str_has_been_added_but_is_hidden_desc' },
          { 0: symbol },
        );
      }
    }
    if (hideSmallBalance) {
      const { serviceToken, servicePrice } = backgroundApiProxy;
      const [balances] = await serviceToken.getAccountBalanceFromRpc(
        networkId,
        accountId,
        [tokenIdOnNetwork],
        false,
        {
          [tokenIdOnNetwork]: item,
        },
      );
      const price = await servicePrice.getSimpleTokenPrice({
        networkId,
        tokenId: tokenIdOnNetwork,
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
        showHomeBalanceSettings({ networkId });
      },
    });
  }, [
    item,
    tokenIdOnNetwork,
    accountId,
    hideSmallBalance,
    hideRiskTokens,
    intl,
    networkId,
    symbol,
    riskLevel,
  ]);

  const onAddToken = useCallback(async () => {
    const { serviceToken } = backgroundApiProxy;
    try {
      await checkIfShouldActiveToken();
      await serviceToken.addAccountToken(
        networkId,
        accountId,
        tokenIdOnNetwork,
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
    tokenIdOnNetwork,
    accountId,
    networkId,
    intl,
    checkIfShouldActiveToken,
    checkTokenVisible,
  ]);

  const onPress = useCallback(async () => {
    if (!accountId || !networkId) {
      return;
    }
    setLoading(true);
    await onAddToken();
    notifyIfRiskToken(item);
    updateTs(Date.now());
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [item, accountId, networkId, onAddToken, updateTs]);

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
      key={tokenIdOnNetwork}
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
}
const ListRenderToken = memo(ListRenderTokenWithoutMemo);

function ListRenderTokenWrapper(item: Token) {
  const [{ headerTokenKeysMap }] = useAtomManageTokens(atomMangeHeaderTokens);
  const isOwned = useMemo(
    () => headerTokenKeysMap[item.tokenIdOnNetwork],
    [headerTokenKeysMap, item.tokenIdOnNetwork],
  );
  return <ListRenderToken {...item} isOwned={isOwned} />;
}

export const ListingModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { network } = useActiveWalletAccount();
  const [{ networkTokens = freezedEmptyArray as Token[] }] =
    useAtomManageTokens(atomMangeNetworksTokens);

  const [isLoading] = useAtomManageTokens(atomMangeTokensLoading);
  const [keywords] = useAtomManageTokens(atomMangeTokensKeywords);

  const keyExtractor = useCallback((item) => {
    const token = item as Token;
    return `${getBalanceKey(token)}`;
  }, []);

  const renderItem: ListRenderItem<Token> = useCallback(
    ({ item }) => <ListRenderTokenWrapper {...item} />,
    [],
  );

  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__manage_tokens',
        defaultMessage: 'Manage Tokens',
      })}
      height="560px"
      hidePrimaryAction
      headerDescription={network?.shortName}
      onSecondaryActionPress={() => {
        navigation.navigate(ManageTokenModalRoutes.CustomToken);
      }}
      secondaryActionProps={{ type: 'basic', leftIconName: 'PlusOutline' }}
      secondaryActionTranslationId="action__add_custom_tokens"
      flatListProps={{
        data: isLoading && keywords ? freezedEmptyArray : networkTokens,
        // @ts-ignore
        renderItem,
        keyExtractor,
        showsVerticalScrollIndicator: false,
        ListEmptyComponent: <ListEmptyComponent />,
        ListHeaderComponent: <Header />,
        mx: '-8px',
      }}
    />
  );
};

export default memo(withProviderManageTokens(ListingModal));
