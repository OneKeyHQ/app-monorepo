import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useAggregateTokensListMapAtom,
  useAllTokenListMapAtom,
  useTokenListActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAssetSelectorParamList } from '@onekeyhq/shared/src/routes';
import { EAssetSelectorRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useCurrency } from '../../../components/Currency';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { HomeTokenListProviderMirrorWrapper } from '../../Home/components/HomeTokenListProvider';

import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

const num = 0;

function TokenSelector() {
  const intl = useIntl();
  const {
    updateCreateAccountState,
    updateProcessingTokenState,
    refreshActiveAccountTokenList,
    refreshTokenListMap,
    updateActiveAccountTokenListState,
  } = useTokenListActions().current;

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
    aggregateTokenSelectorScreen,
    allAggregateTokenMap,
    hideZeroBalanceTokens,
    keepDefaultZeroBalanceTokens,
    enableNetworkAfterSelect,
    exchangeFilter,
  } = route.params;

  const { network, account } = useAccountData({ networkId, accountId });

  const [searchKey, setSearchKey] = useState('');
  const [allTokenListMap] = useAllTokenListMapAtom();
  const [searchTokenState, setSearchTokenState] = useState({
    isSearching: false,
  });
  const [searchTokenList, setSearchTokenList] = useState<{
    tokens: IAccountToken[];
  }>({ tokens: [] });

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

        if (
          vaultSettings?.mergeDeriveAssetsEnabled ||
          matchedAccount?.accountId
        ) {
          if (matchedAccount?.accountId) {
            await executeOnSelect({
              ...token,
              accountId: matchedAccount.accountId,
            });
          } else {
            await executeOnSelect(token);
          }
        } else if (account) {
          updateCreateAccountState({
            isCreating: true,
            token,
          });
          const walletId = accountUtils.getWalletIdFromAccountId({
            accountId: account.id,
          });
          try {
            const resp = await createAddress({
              num: 0,
              account: {
                walletId,
                networkId: token.networkId,
                indexedAccountId: account.indexedAccountId,
                deriveType: 'default',
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

  const searchTokensBySearchKey = useCallback(
    async (keywords: string) => {
      setSearchTokenState({ isSearching: true });
      await backgroundApiProxy.serviceToken.abortSearchTokens();
      try {
        const result = await backgroundApiProxy.serviceToken.searchTokens({
          accountId,
          networkId,
          keywords,
        });
        setSearchTokenList({ tokens: result });
      } catch (e) {
        console.log(e);
      }
      setSearchTokenState({ isSearching: false });
    },
    [accountId, networkId],
  );

  const showActiveAccountTokenList = useMemo(() => {
    return !!(
      activeAccountId &&
      activeNetworkId &&
      activeAccountId !== accountId &&
      activeNetworkId !== networkId
    );
  }, [activeAccountId, activeNetworkId, accountId, networkId]);

  usePromiseResult(async () => {
    if (activeAccountId && activeNetworkId && showActiveAccountTokenList) {
      updateActiveAccountTokenListState({
        initialized: false,
        isRefreshing: true,
      });
      refreshActiveAccountTokenList({
        tokens: [],
        keys: '',
      });
      const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
        accountId: activeAccountId,
        networkId: activeNetworkId,
        indexedAccountId,
        flag: 'token-selector',
      });

      refreshActiveAccountTokenList({
        tokens: [...r.tokens.data, ...r.smallBalanceTokens.data],
        keys: `${r.tokens.keys}_${r.smallBalanceTokens.keys}`,
      });
      refreshTokenListMap({
        tokens: {
          ...r.tokens.map,
          ...r.smallBalanceTokens.map,
        },
        merge: true,
      });
      updateActiveAccountTokenListState({
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
    }
  }, [
    activeAccountId,
    activeNetworkId,
    indexedAccountId,
    refreshActiveAccountTokenList,
    refreshTokenListMap,
    showActiveAccountTokenList,
    updateActiveAccountTokenListState,
    currencyInfo.id,
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
      />
      <Page.Body>
        <TokenListView
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          showActiveAccountTokenList={showActiveAccountTokenList}
          onPressToken={handleTokenOnPress}
          isAllNetworks={isAllNetworks ?? network?.isAllNetworks}
          withNetwork={isAllNetworks ?? network?.isAllNetworks}
          searchAll={searchAll}
          footerTipText={footerTipText}
          isTokenSelector
          tokenSelectorSearchKey={searchKey}
          tokenSelectorSearchTokenState={searchTokenState}
          tokenSelectorSearchTokenList={searchTokenList}
          allAggregateTokenMap={allAggregateTokenMap}
          hideZeroBalanceTokens={hideZeroBalanceTokens}
          keepDefaultZeroBalanceTokens={keepDefaultZeroBalanceTokens}
          showNetworkIcon={isAllNetworks ?? network?.isAllNetworks}
          exchangeFilter={exchangeFilter}
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
