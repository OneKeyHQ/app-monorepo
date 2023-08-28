/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isNil } from 'lodash';
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
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { TokenRiskLevel } from '@onekeyhq/engine/src/types/token';
import type { IManageNetworkTokenType } from '@onekeyhq/kit-bg/src/services/ServiceToken';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { FormatBalance } from '../../components/Format';
import { LazyDisplayView } from '../../components/LazyDisplayView';
import { useActiveWalletAccount, useAppSelector } from '../../hooks';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { ManageTokenModalRoutes } from '../../routes/routesEnum';
import { deviceUtils } from '../../utils/hardware';
import { showOverlay } from '../../utils/overlayUtils';
import { getTokenValue } from '../../utils/priceUtils';
import { showHomeBalanceSettings } from '../Overlay/HomeBalanceSettings';
import { showManageTokenListingTip } from '../Overlay/MangeTokenListing';

import {
  atomMangeTokensList,
  atomMangeTokensLoading,
  atomMangeTokensSearch,
  atomMangeTokensTS,
  useAtomManageTokens,
  withProviderManageTokens,
} from './contextManageTokens';
import { notifyIfRiskToken } from './helpers/TokenSecurityModalWrapper';

import type { IAccountToken } from '../Overview/types';
import type { ManageTokenRoutesParams } from './types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.Listing
>;

const isValidateAddr = (addr: string) => addr.length === 42;

function useMangeTokensDataFromRedux() {
  const { networkId, accountId } = useActiveWalletAccount();
  const [keywords] = useAtomManageTokens(atomMangeTokensSearch);
  const [updatedTS] = useAtomManageTokens(atomMangeTokensTS);
  const result = usePromiseResult(
    () =>
      backgroundApiProxy.serviceToken.buildManageTokensList({
        networkId,
        accountId,
        search: keywords,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountId, networkId, keywords, updatedTS],
    {
      debounced: 600,
      watchLoading: true,
    },
  );

  return result;
}

function HandleRebuildMangeTokens() {
  const result = useMangeTokensDataFromRedux();
  const [, setData] = useAtomManageTokens(atomMangeTokensList);
  const [, setIsLoading] = useAtomManageTokens(atomMangeTokensLoading);
  useEffect(() => {
    const data = result.result;
    if (!data) {
      return;
    }
    setData(data);
  }, [result.result, setData]);

  useEffect(() => {
    if (!isNil(result.isLoading)) {
      setIsLoading(result.isLoading);
    }
  }, [result.isLoading, setIsLoading]);

  return null;
}

function HeaderTokenItem(item: IAccountToken) {
  const intl = useIntl();
  const { balance } = item;
  const { networkId, accountId } = useActiveWalletAccount();

  const [, updateTS] = useAtomManageTokens(atomMangeTokensTS);

  const navigation = useNavigation<NavigationProps>();

  const onDetail = useCallback(() => {
    navigation.navigate(ManageTokenModalRoutes.ViewToken, {
      name: item.name,
      symbol: item.symbol,
      address: item.address ?? '',
      decimal: item.tokens[0].decimals,
      logoURI: item.logoURI ?? '',
      sendAddress: item.sendAddress,
      riskLevel: item.riskLevel,
    });
  }, [navigation, item]);

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
              if (!accountId || !item) {
                return;
              }
              return backgroundApiProxy.serviceToken
                .deleteAccountToken({
                  accountId,
                  networkId,
                  tokenId: `${item.networkId}--${item.address ?? ''}`,
                  address: item.address ?? '',
                })
                .finally(() => {
                  closeOverlay();
                  updateTS(Date.now());
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
            { token: item?.name },
          ),
        }}
      />
    ));
  }, [accountId, intl, networkId, updateTS, item]);

  if (!item) {
    return null;
  }

  return (
    <Pressable
      onPress={onDetail}
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
        token={item}
        showInfo
        flex={1}
        showExtra={false}
        description={
          <FormatBalance
            balance={balance || 0}
            suffix={item.symbol}
            formatOptions={{ fixed: 6 }}
          />
        }
      />
      <IconButton name="TrashMini" type="plain" circle onPress={onDelete} />
    </Pressable>
  );
}
const HeaderTokenItemMemo = memo(HeaderTokenItem);

function Header() {
  const intl = useIntl();
  const [keywords, setKeywords] = useAtomManageTokens(atomMangeTokensSearch);

  const onClear = useCallback(() => setKeywords(''), [setKeywords]);

  return (
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
  );
}

function ListEmptyComponent() {
  const intl = useIntl();
  const [isLoading] = useAtomManageTokens(atomMangeTokensLoading);
  const [keywords] = useAtomManageTokens(atomMangeTokensSearch);
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
const ListEmptyComponentMemo = memo(ListEmptyComponent);

function ActionButton({
  isOwned,
  onPress,
}: {
  isOwned: boolean;
  onPress: () => Promise<any>;
}) {
  const [loading, setLoading] = useState(false);
  const handlePress = useCallback(() => {
    setLoading(true);
    onPress().finally(() => {
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    });
    return Promise.resolve();
  }, [onPress]);

  if (loading) {
    return (
      <Box p="2">
        <Spinner size="sm" />
      </Box>
    );
  }

  if (isOwned) {
    return (
      <Box p={2}>
        <Icon name="CheckMini" color="interactive-disabled" />
      </Box>
    );
  }

  return (
    <IconButton
      name="PlusMini"
      type="plain"
      circle
      p="4"
      onPromise={handlePress}
    />
  );
}

const ActionButtonMemo = memo(ActionButton);

function ListRenderToken({ isOwned, ...item }: IManageNetworkTokenType) {
  const intl = useIntl();

  const navigation = useNavigation<NavigationProps>();
  const { walletId, accountId, networkId } = useActiveWalletAccount();
  const hideSmallBalance = useAppSelector((s) => s.settings.hideSmallBalance);
  const hideRiskTokens = useAppSelector((s) => s.settings.hideRiskTokens);
  const [, updateTS] = useAtomManageTokens(atomMangeTokensTS);

  const { tokenIdOnNetwork, symbol, riskLevel } = item;

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
    await onAddToken();
    notifyIfRiskToken(item);
    updateTS(Date.now());
  }, [item, accountId, networkId, onAddToken, updateTS]);

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
      <ActionButtonMemo isOwned={isOwned} onPress={onPress} />
    </Pressable>
  );
}
const ListRenderTokenMemo = memo(ListRenderToken);

function isHeaderToken(
  token: IManageNetworkTokenType | IAccountToken,
): token is IAccountToken {
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return typeof token.isOwned === 'undefined';
}

function SectionHeader({ title, mt }: { title: LocaleIds; mt: number }) {
  const intl = useIntl();
  const [search] = useAtomManageTokens(atomMangeTokensSearch);
  if (search) {
    return null;
  }
  return (
    <Typography.Subheading px="8px" color="text-subdued" mb="2" mt={mt}>
      {intl.formatMessage({
        id: title,
      })}
    </Typography.Subheading>
  );
}

const SectionHeaderMemo = memo(SectionHeader);

function ManageTokensListingView() {
  const [sections] = useAtomManageTokens(atomMangeTokensList);

  const [search] = useAtomManageTokens(atomMangeTokensSearch);
  const [isLoading] = useAtomManageTokens(atomMangeTokensLoading);

  const keyExtractor = useCallback((item) => {
    const token = item as Token;
    return `${getBalanceKey(token)}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: IManageNetworkTokenType | IAccountToken }) => {
      if (isHeaderToken(item)) {
        return <HeaderTokenItemMemo {...item} />;
      }
      return <ListRenderTokenMemo {...item} />;
    },
    [],
  );

  const isEmpty = useMemo(
    () => !sections.find((s) => s.data.length > 0),
    [sections],
  );

  if (isEmpty || (search && isLoading)) {
    return <ListEmptyComponentMemo />;
  }

  return (
    <>
      {sections.map(({ title, data }, index) => (
        <Box key={title}>
          <SectionHeaderMemo title={title} mt={index === 0 ? 0 : 6} />
          {data.map((d) => (
            <Box key={keyExtractor(d)}>{renderItem({ item: d })}</Box>
          ))}
        </Box>
      ))}
    </>
  );
}

export const ListingModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const { network } = useActiveWalletAccount();

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
      scrollViewProps={{
        children: (
          <>
            <HandleRebuildMangeTokens />
            <Header />
            <LazyDisplayView delay={100}>
              <ManageTokensListingView />
            </LazyDisplayView>
          </>
        ),
      }}
    />
  );
};

export default memo(withProviderManageTokens(ListingModal));
