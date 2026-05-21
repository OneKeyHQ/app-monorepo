import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Icon, Page, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import {
  type IScopedActiveTokenList,
  type IScopedActiveTokenListState,
  buildScopedActiveTokenListFromResponses,
  fetchFilteredTokenSelectorTokens,
  filterTokenSelectorSearchTokensByBackendIndexedNetworks,
} from '@onekeyhq/kit/src/components/TokenSelectorFilter/utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
  useTokenListActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useTokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountDeriveTypes,
  IVaultSettings,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAssetSelectorParamList } from '@onekeyhq/shared/src/routes';
import { EAssetSelectorRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED,
  buildTokenSelectorDappTokenFilterParams,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useCurrency } from '../../../components/Currency';
import { NetworkAvatarBase } from '../../../components/NetworkAvatar/NetworkAvatar';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';
import { AssetSelectorTestIDs } from '../testIDs';

import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

const num = 0;

type ISelectorTokenListRequestContext = {
  accountId: string;
  networkId: string;
  indexedAccountId: string;
  activeAccountId: string;
  activeNetworkId: string;
  isSelectorAllNetworks: boolean;
  mergeDeriveAddressData: boolean;
  showLpTokensOnly: boolean;
  useSelectorFilteredTokenList: boolean;
  showActiveAccountTokenList: boolean;
};

type ITokenSelectorHeaderRightProps = {
  showDeFiTokenSwitch?: boolean;
  loading?: boolean;
  onLpTokenFilterChange: (value: boolean) => void;
  onSwitchNetwork?: () => void;
  networkLogoURI?: string;
  networkName?: string;
  networkShortName?: string;
  isCustomNetwork?: IServerNetwork['isCustomNetwork'];
};

const TokenSelectorHeaderRight = memo(function TokenSelectorHeaderRight({
  showDeFiTokenSwitch,
  loading,
  onLpTokenFilterChange,
  onSwitchNetwork,
  networkLogoURI,
  networkName,
  networkShortName,
  isCustomNetwork,
}: ITokenSelectorHeaderRightProps) {
  const [tokenSelectorFilter] = useTokenSelectorFilterPersistAtom();
  const showTokenSelectorFilter =
    TOKEN_SELECTOR_LP_TOKEN_FILTER_ENABLED && showDeFiTokenSwitch;
  const showLpTokensOnly = showTokenSelectorFilter
    ? tokenSelectorFilter.sendTokenShowLpTokensOnly
    : false;
  const shouldShowNetworkSwitch = !!onSwitchNetwork && !!networkName;

  if (!showTokenSelectorFilter && !shouldShowNetworkSwitch) {
    return null;
  }

  return (
    <XStack alignItems="center" gap="$2" mr="$-2">
      {showTokenSelectorFilter ? (
        <TokenSelectorLpTokenSwitch
          value={showLpTokensOnly}
          onChange={onLpTokenFilterChange}
          loading={loading}
        />
      ) : null}
      {shouldShowNetworkSwitch ? (
        <XStack
          alignItems="center"
          gap="$1.5"
          px="$2"
          py="$1"
          borderRadius="$full"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onSwitchNetwork}
          userSelect="none"
        >
          <NetworkAvatarBase
            logoURI={networkLogoURI ?? ''}
            size="$5"
            isCustomNetwork={isCustomNetwork}
            networkName={networkName}
          />
          <SizableText size="$bodyMdMedium" numberOfLines={1} maxWidth="$16">
            {networkShortName}
          </SizableText>
          <Icon name="SwitchHorOutline" size="$4.5" color="$iconSubdued" />
        </XStack>
      ) : null}
    </XStack>
  );
});

function isSameSelectorTokenListRequestContext(
  a: ISelectorTokenListRequestContext,
  b: ISelectorTokenListRequestContext,
) {
  return (
    a.accountId === b.accountId &&
    a.networkId === b.networkId &&
    a.indexedAccountId === b.indexedAccountId &&
    a.activeAccountId === b.activeAccountId &&
    a.activeNetworkId === b.activeNetworkId &&
    a.isSelectorAllNetworks === b.isSelectorAllNetworks &&
    a.mergeDeriveAddressData === b.mergeDeriveAddressData &&
    a.showLpTokensOnly === b.showLpTokensOnly &&
    a.useSelectorFilteredTokenList === b.useSelectorFilteredTokenList &&
    a.showActiveAccountTokenList === b.showActiveAccountTokenList
  );
}

function TokenSelector() {
  const intl = useIntl();
  const { updateCreateAccountState, updateProcessingTokenState } =
    useTokenListActions().current;

  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const navigation = useAppNavigation();

  const { createAddress } = useAccountSelectorCreateAddress();

  const [aggregateTokensListMap] = useAggregateTokensListMapAtom();

  const currencyInfo = useCurrency();

  const {
    title,
    networkId,
    accountId,
    indexedAccountId,
    closeAfterSelect = true,
    onSelect,
    searchAll,
    isAllNetworks,
    searchPlaceholder,
    footerTipText,
    activeAccountId,
    activeNetworkId,
    forceShowActiveAccountTokenList,
    aggregateTokenSelectorScreen,
    allAggregateTokenMap,
    hideZeroBalanceTokens,
    keepDefaultZeroBalanceTokens,
    enableNetworkAfterSelect,
    exchangeFilter,
    hideBalanceAndValue,
    onSwitchNetwork,
    showDeFiTokenSwitch,
  } = route.params;

  const {
    network,
    account,
    vaultSettings: selectorVaultSettings,
  } = useAccountData({
    networkId,
    accountId,
  });

  const [searchKey, setSearchKey] = useState('');
  const [tokenSelectorFilter, setTokenSelectorFilter] =
    useTokenSelectorFilterPersistAtom();
  const isSelectorAllNetworks = isAllNetworks ?? network?.isAllNetworks;
  const showTokenSelectorFilter =
    !!showDeFiTokenSwitch &&
    isTokenSelectorDappTokenFilterSupportedNetwork({
      network: network
        ? {
            id: network.id,
            isAllNetworks: isSelectorAllNetworks,
            backendIndex: network.backendIndex,
          }
        : undefined,
    });
  const showLpTokensOnly = showTokenSelectorFilter
    ? tokenSelectorFilter.sendTokenShowLpTokensOnly
    : false;
  const [scopedActiveTokenList, setScopedActiveTokenList] =
    useState<IScopedActiveTokenList>({
      tokens: [],
      keys: '',
    });
  const [scopedActiveTokenListMap, setScopedActiveTokenListMap] = useState<
    Record<string, ITokenFiat>
  >({});
  const [scopedActiveTokenListState, setScopedActiveTokenListState] =
    useState<IScopedActiveTokenListState>({
      isRefreshing: false,
      initialized: false,
    });
  const [isLpTokenSwitchLoading, setIsLpTokenSwitchLoading] = useState(false);
  const [allTokenListMap] = useAllTokenListMapAtom();
  const [searchTokenState, setSearchTokenState] = useState({
    isSearching: false,
  });
  const [searchTokenList, setSearchTokenList] = useState<{
    tokens: IAccountToken[];
  }>({ tokens: [] });

  const tokenSelectorFilterParams = useMemo(
    () =>
      showTokenSelectorFilter
        ? buildTokenSelectorDappTokenFilterParams({
            lpToken: showLpTokensOnly,
          })
        : {},
    [showLpTokensOnly, showTokenSelectorFilter],
  );

  const handleLpTokenFilterChange = useCallback(
    (value: boolean) => {
      if (value === showLpTokensOnly) {
        return;
      }
      setIsLpTokenSwitchLoading(!!value && !!accountId && !!networkId);
      setTokenSelectorFilter((prev) => ({
        ...prev,
        sendTokenShowLpTokensOnly: value,
      }));
    },
    [accountId, networkId, setTokenSelectorFilter, showLpTokensOnly],
  );

  const executeOnSelect = useCallback(
    async (selectedToken: IAccountToken) => {
      if (!onSelect) return;
      if (exchangeFilter) {
        updateProcessingTokenState({
          isProcessing: true,
          token: selectedToken,
        });
        try {
          await onSelect(selectedToken);
        } finally {
          updateProcessingTokenState({
            isProcessing: false,
            token: null,
          });
        }
      } else {
        void onSelect(selectedToken);
      }
    },
    [onSelect, updateProcessingTokenState, exchangeFilter],
  );

  const handleTokenOnPress = useCallback(
    async (token: IAccountToken) => {
      if (token.isAggregateToken) {
        const allAggregateTokenList =
          allAggregateTokenMap?.[token.$key]?.tokens ?? [];
        const aggregateTokenList =
          aggregateTokensListMap[token.$key]?.tokens ?? [];
        if (
          aggregateTokenList.length === 1 &&
          allAggregateTokenList.length === 0
        ) {
          await executeOnSelect(aggregateTokenList[0]);
          return;
        }

        const { tokenHasBalance, tokenHasBalanceCount } =
          checkIsOnlyOneTokenHasBalance({
            tokenMap: allTokenListMap,
            aggregateTokenList,
            allAggregateTokenList,
          });

        if (tokenHasBalance && tokenHasBalanceCount === 1) {
          await executeOnSelect(tokenHasBalance);
          return;
        }

        if (aggregateTokenList.length > 1 || allAggregateTokenList.length > 1) {
          // Delay navigation to let the current CA transaction finish rendering
          // SVG icons, avoiding EXC_BAD_ACCESS in InstanceHandle::getTag when
          // Reanimated intercepts layout events from unmounting SVG views.
          await timerUtils.wait(0);
          navigation.push(
            aggregateTokenSelectorScreen ??
              EAssetSelectorRoutes.AggregateTokenSelector,
            {
              accountId,
              indexedAccountId,
              aggregateToken: token,
              onSelect,
              allAggregateTokenList,
              enableNetworkAfterSelect,
              hideZeroBalanceTokens,
              exchangeFilter,
              hideBalanceAndValue,
            },
          );
          return;
        }
      }

      if (network?.isAllNetworks) {
        let vaultSettings: IVaultSettings | undefined;
        if (token.networkId) {
          vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId,
            });
        }

        let accounts: IAllNetworkAccountInfo[] = [];

        try {
          if (
            (token.accountId || account?.id) &&
            (token.networkId || network?.id)
          ) {
            const params = token.accountId
              ? {
                  accountId: token.accountId ?? '',
                  networkId: token.networkId ?? '',
                }
              : {
                  accountId: account?.id ?? '',
                  networkId: network?.id ?? '',
                };

            let deriveType;

            if (token.accountId && token.networkId) {
              const tokenAccount =
                await backgroundApiProxy.serviceAccount.getAccount({
                  accountId: token.accountId ?? '',
                  networkId: token.networkId ?? '',
                });
              deriveType = (
                await backgroundApiProxy.serviceNetwork.getDeriveTypeByTemplate(
                  {
                    accountId: tokenAccount.id,
                    networkId: token.networkId,
                    template: tokenAccount.template,
                  },
                )
              ).deriveType;
            }

            const { accountsInfo } =
              await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
                ...params,
                includingNonExistingAccount: true,
                deriveType,
                excludeTestNetwork: false,
              });
            accounts = accountsInfo;
          }
        } catch {
          // pass
        }

        const matchedAccount = accounts.find((item) =>
          token.accountId
            ? item.accountId === token.accountId
            : true && item.networkId === token.networkId,
        );

        if (matchedAccount?.accountId) {
          await executeOnSelect({
            ...token,
            accountId: matchedAccount.accountId,
          });
        } else if (account) {
          updateCreateAccountState({
            isCreating: true,
            token,
          });
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: account.id,
          });
          try {
            // For multi-derive networks (e.g. BTC/LTC) align the new account's
            // derive type with the network's global default so the downstream
            // ReceiveToken lookup (getAccountsByIndexedAccounts) can find it.
            const deriveType: IAccountDeriveTypes =
              vaultSettings?.mergeDeriveAssetsEnabled && token.networkId
                ? await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                    {
                      networkId: token.networkId,
                    },
                  )
                : 'default';
            const resp = await createAddress({
              num: 0,
              account: {
                walletId,
                networkId: token.networkId,
                indexedAccountId: account.indexedAccountId,
                deriveType,
              },
            });

            updateCreateAccountState({
              isCreatingAccount: false,
              token: null,
            });

            if (resp) {
              await executeOnSelect({
                ...token,
                accountId: resp.accounts[0]?.id,
              });
            }
          } catch (_e) {
            updateCreateAccountState({
              isCreatingAccount: false,
              token: null,
            });
          }
        } else if (vaultSettings?.mergeDeriveAssetsEnabled) {
          await executeOnSelect(token);
        }
      } else {
        await executeOnSelect(token);
      }

      if (closeAfterSelect) {
        navigation.pop();
      }
    },
    [
      network?.isAllNetworks,
      network?.id,
      closeAfterSelect,
      allAggregateTokenMap,
      aggregateTokensListMap,
      allTokenListMap,
      onSelect,
      navigation,
      aggregateTokenSelectorScreen,
      accountId,
      indexedAccountId,
      enableNetworkAfterSelect,
      hideZeroBalanceTokens,
      hideBalanceAndValue,
      exchangeFilter,
      account,
      updateCreateAccountState,
      createAddress,
      executeOnSelect,
    ],
  );

  const debounceUpdateSearchKey = useDebouncedCallback(
    setSearchKey,
    searchAll ? 1000 : 200,
  );

  const headerSearchBarOptions = useMemo(
    () => ({
      placeholder:
        searchPlaceholder ??
        intl.formatMessage({
          id: ETranslations.send_token_selector_search_placeholder,
        }),
      onChangeText: ({
        nativeEvent,
      }: {
        nativeEvent: TextInputFocusEventData;
      }) => {
        debounceUpdateSearchKey(nativeEvent.text);
      },
    }),
    [debounceUpdateSearchKey, intl, searchPlaceholder],
  );

  const headerRight = useMemo(() => {
    const shouldShowNetworkSwitch = !!onSwitchNetwork && !!network?.name;
    if (!showTokenSelectorFilter && !shouldShowNetworkSwitch) return undefined;

    return function RenderTokenSelectorHeaderRight() {
      return (
        <TokenSelectorHeaderRight
          showDeFiTokenSwitch={showTokenSelectorFilter}
          loading={isLpTokenSwitchLoading}
          onLpTokenFilterChange={handleLpTokenFilterChange}
          onSwitchNetwork={onSwitchNetwork}
          networkLogoURI={network?.logoURI}
          networkName={network?.name}
          networkShortName={network?.shortname}
          isCustomNetwork={network?.isCustomNetwork}
        />
      );
    };
  }, [
    handleLpTokenFilterChange,
    isLpTokenSwitchLoading,
    onSwitchNetwork,
    showTokenSelectorFilter,
    network?.name,
    network?.shortname,
    network?.logoURI,
    network?.isCustomNetwork,
  ]);

  const searchTokensBySearchKey = useCallback(
    async (keywords: string) => {
      setSearchTokenState({ isSearching: true });
      await backgroundApiProxy.serviceToken.abortSearchTokens();
      try {
        let result = await backgroundApiProxy.serviceToken.searchTokens({
          accountId,
          networkId,
          keywords,
        });
        if (showLpTokensOnly && isSelectorAllNetworks) {
          result =
            await filterTokenSelectorSearchTokensByBackendIndexedNetworks({
              tokens: result,
            });
        }
        setSearchTokenList({ tokens: result });
      } catch (e) {
        console.log(e);
      }
      setSearchTokenState({ isSearching: false });
    },
    [accountId, isSelectorAllNetworks, networkId, showLpTokensOnly],
  );

  const showActiveAccountTokenList = useMemo(() => {
    if (!activeAccountId || !activeNetworkId) {
      return false;
    }

    if (forceShowActiveAccountTokenList) {
      return true;
    }

    return activeAccountId !== accountId && activeNetworkId !== networkId;
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    forceShowActiveAccountTokenList,
    networkId,
  ]);

  const mergeDeriveAddressData =
    !!selectorVaultSettings?.mergeDeriveAssetsEnabled &&
    !!indexedAccountId &&
    !accountUtils.isOthersAccount({ accountId });
  const useSelectorFilteredTokenList =
    !!showTokenSelectorFilter && showLpTokensOnly;
  const effectiveShowActiveAccountTokenList =
    showActiveAccountTokenList || useSelectorFilteredTokenList;
  const effectiveHideZeroBalanceTokens =
    showTokenSelectorFilter && showLpTokensOnly ? false : hideZeroBalanceTokens;
  const latestSelectorTokenListRequestContextRef =
    useRef<ISelectorTokenListRequestContext>({
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      indexedAccountId: indexedAccountId ?? '',
      activeAccountId: activeAccountId ?? '',
      activeNetworkId: activeNetworkId ?? '',
      isSelectorAllNetworks: !!isSelectorAllNetworks,
      mergeDeriveAddressData,
      showLpTokensOnly,
      useSelectorFilteredTokenList,
      showActiveAccountTokenList,
    });
  latestSelectorTokenListRequestContextRef.current = {
    accountId: accountId ?? '',
    networkId: networkId ?? '',
    indexedAccountId: indexedAccountId ?? '',
    activeAccountId: activeAccountId ?? '',
    activeNetworkId: activeNetworkId ?? '',
    isSelectorAllNetworks: !!isSelectorAllNetworks,
    mergeDeriveAddressData,
    showLpTokensOnly,
    useSelectorFilteredTokenList,
    showActiveAccountTokenList,
  };

  usePromiseResult(async () => {
    if (!useSelectorFilteredTokenList || showActiveAccountTokenList) {
      if (!useSelectorFilteredTokenList) {
        setIsLpTokenSwitchLoading(false);
      }
      return;
    }

    if (!accountId || !networkId) {
      setIsLpTokenSwitchLoading(false);
      return;
    }

    const requestContext: ISelectorTokenListRequestContext = {
      accountId,
      networkId,
      indexedAccountId: indexedAccountId ?? '',
      activeAccountId: activeAccountId ?? '',
      activeNetworkId: activeNetworkId ?? '',
      isSelectorAllNetworks: !!isSelectorAllNetworks,
      mergeDeriveAddressData,
      showLpTokensOnly,
      useSelectorFilteredTokenList,
      showActiveAccountTokenList,
    };
    const isLatestRequest = () =>
      isSameSelectorTokenListRequestContext(
        latestSelectorTokenListRequestContextRef.current,
        requestContext,
      );

    if (!isLatestRequest()) {
      return;
    }

    setScopedActiveTokenListState({
      initialized: false,
      isRefreshing: true,
    });
    setScopedActiveTokenList({
      tokens: [],
      keys: '',
    });
    setScopedActiveTokenListMap({});

    try {
      const responses = await fetchFilteredTokenSelectorTokens({
        accountId,
        networkId,
        indexedAccountId,
        isAllNetworks: !!isSelectorAllNetworks,
        mergeDeriveAddressData,
        onlyBackendIndexedNetworks: showLpTokensOnly,
        tokenSelectorFilterParams,
      });

      if (!isLatestRequest()) {
        return;
      }

      const tokenFilterKeySuffix = showLpTokensOnly
        ? 'lp-dapp-token'
        : 'wallet-token';
      const { tokenList, tokenListMap } =
        buildScopedActiveTokenListFromResponses({
          responses,
          keySuffix: tokenFilterKeySuffix,
        });

      setScopedActiveTokenList(tokenList);
      setScopedActiveTokenListMap(tokenListMap);
    } catch (e) {
      console.error(e);
    } finally {
      if (isLatestRequest()) {
        setScopedActiveTokenListState({
          initialized: true,
          isRefreshing: false,
        });
        setIsLpTokenSwitchLoading(false);
      }
    }
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    indexedAccountId,
    isSelectorAllNetworks,
    mergeDeriveAddressData,
    networkId,
    showActiveAccountTokenList,
    showLpTokensOnly,
    tokenSelectorFilterParams,
    useSelectorFilteredTokenList,
  ]);

  usePromiseResult(async () => {
    if (activeAccountId && activeNetworkId && showActiveAccountTokenList) {
      const requestContext: ISelectorTokenListRequestContext = {
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        indexedAccountId: indexedAccountId ?? '',
        activeAccountId,
        activeNetworkId,
        isSelectorAllNetworks: !!isSelectorAllNetworks,
        mergeDeriveAddressData,
        showLpTokensOnly,
        useSelectorFilteredTokenList,
        showActiveAccountTokenList,
      };
      const isLatestRequest = () =>
        isSameSelectorTokenListRequestContext(
          latestSelectorTokenListRequestContextRef.current,
          requestContext,
        );

      if (!isLatestRequest()) {
        return;
      }

      setScopedActiveTokenListState({
        initialized: false,
        isRefreshing: true,
      });
      setScopedActiveTokenList({
        tokens: [],
        keys: '',
      });
      setScopedActiveTokenListMap({});

      try {
        if (showLpTokensOnly) {
          const activeNetwork =
            await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: activeNetworkId,
            });
          if (
            !isTokenSelectorDappTokenFilterSupportedNetwork({
              network: activeNetwork,
            })
          ) {
            if (isLatestRequest()) {
              setScopedActiveTokenListState({
                isRefreshing: false,
                initialized: true,
              });
            }
            return;
          }
        }

        const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
          accountId: activeAccountId,
          networkId: activeNetworkId,
          indexedAccountId,
          flag: 'token-selector',
          ...tokenSelectorFilterParams,
        });

        if (!isLatestRequest()) {
          return;
        }

        setScopedActiveTokenList({
          tokens: [...r.tokens.data, ...r.smallBalanceTokens.data],
          keys: `${r.tokens.keys}_${r.smallBalanceTokens.keys}`,
        });
        setScopedActiveTokenListMap({
          ...r.tokens.map,
          ...r.smallBalanceTokens.map,
        });
        setScopedActiveTokenListState({
          isRefreshing: false,
          initialized: true,
        });

        // Update network value cache so ChainSelector shows fresh values on back
        const totalFiatValue = new BigNumber(r.tokens.fiatValue ?? '0')
          .plus(r.smallBalanceTokens.fiatValue ?? '0')
          .toFixed();
        let valueAccountId = indexedAccountId || '';
        if (!valueAccountId && activeAccountId) {
          if (accountUtils.isOthersAccount({ accountId: activeAccountId })) {
            valueAccountId = activeAccountId;
          }
        }
        if (valueAccountId && activeNetworkId) {
          const valueKey = accountUtils.buildAccountValueKey({
            accountId: activeAccountId,
            networkId: activeNetworkId,
          });
          void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
            {
              accountId: valueAccountId,
              value: { [valueKey]: totalFiatValue },
              currency: currencyInfo.id,
            },
          );
        }
      } finally {
        if (isLatestRequest()) {
          setIsLpTokenSwitchLoading(false);
        }
      }
    } else if (showActiveAccountTokenList) {
      setIsLpTokenSwitchLoading(false);
    }
  }, [
    activeAccountId,
    activeNetworkId,
    accountId,
    indexedAccountId,
    isSelectorAllNetworks,
    mergeDeriveAddressData,
    networkId,
    showActiveAccountTokenList,
    showLpTokensOnly,
    tokenSelectorFilterParams,
    currencyInfo.id,
    useSelectorFilteredTokenList,
  ]);

  useEffect(() => {
    if (searchAll && searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      void searchTokensBySearchKey(searchKey);
    } else {
      setSearchTokenState({ isSearching: false });
      setSearchTokenList({ tokens: [] });
      void backgroundApiProxy.serviceToken.abortSearchTokens();
    }
  }, [searchAll, searchKey, searchTokensBySearchKey]);

  return (
    <Page
      lazyLoad
      safeAreaEnabled={false}
      onClose={() => setSearchKey('')}
      onUnmounted={() => setSearchKey('')}
    >
      <Page.Header
        title={
          title ??
          intl.formatMessage({
            id: ETranslations.global_select_crypto,
          })
        }
        headerSearchBarOptions={headerSearchBarOptions}
        headerRight={headerRight}
      />
      <Page.Body>
        <TokenListView
          testID={AssetSelectorTestIDs.tokenSelectorList}
          tokenItemTestIDPrefix={
            AssetSelectorTestIDs.tokenSelectorItemTestIDPrefix
          }
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          showActiveAccountTokenList={effectiveShowActiveAccountTokenList}
          scopedActiveAccountTokenList={scopedActiveTokenList}
          scopedActiveAccountTokenListState={scopedActiveTokenListState}
          scopedActiveAccountTokenListMap={scopedActiveTokenListMap}
          onPressToken={handleTokenOnPress}
          isAllNetworks={isSelectorAllNetworks}
          withNetwork={isSelectorAllNetworks}
          searchAll={searchAll}
          footerTipText={footerTipText}
          isTokenSelector
          tokenSelectorSearchKey={searchKey}
          tokenSelectorSearchTokenState={searchTokenState}
          tokenSelectorSearchTokenList={searchTokenList}
          allAggregateTokenMap={allAggregateTokenMap}
          hideZeroBalanceTokens={effectiveHideZeroBalanceTokens}
          hideDeFiMarkedTokens={
            showTokenSelectorFilter ? !showLpTokensOnly : undefined
          }
          keepDefaultZeroBalanceTokens={keepDefaultZeroBalanceTokens}
          showNetworkIcon={isSelectorAllNetworks}
          exchangeFilter={exchangeFilter}
          hideBalanceAndValue={hideBalanceAndValue}
          emptyProps={{
            mt: '18%',
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default function TokenSelectorModal() {
  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const { accountId } = route.params;

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <HomeTokenListProviderMirrorWrapper accountId={accountId}>
        <TokenSelector />
      </HomeTokenListProviderMirrorWrapper>
    </AccountSelectorProviderMirror>
  );
}
