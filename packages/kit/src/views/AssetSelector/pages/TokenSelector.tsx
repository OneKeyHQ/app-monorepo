import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TokenListView } from '@onekeyhq/kit/src/components/TokenListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useSearchKeyAtom,
  useTokenListActions,
  withTokenListProvider,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { SEARCH_KEY_MIN_LENGTH } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EAssetSelectorRoutes,
  IAssetSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAccountSelectorCreateAddress } from '../../../components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useAccountData } from '../../../hooks/useAccountData';

import type { RouteProp } from '@react-navigation/core';
import type { TextInputFocusEventData } from 'react-native';

const num = 0;

function TokenSelector() {
  const intl = useIntl();
  const {
    refreshTokenList,
    refreshTokenListMap,
    updateSearchKey,
    updateTokenListState,
    updateSearchTokenState,
    refreshSearchTokenList,
    updateCreateAccountState,
  } = useTokenListActions().current;

  const route =
    useRoute<
      RouteProp<IAssetSelectorParamList, EAssetSelectorRoutes.TokenSelector>
    >();

  const navigation = useAppNavigation();

  const { createAddress } = useAccountSelectorCreateAddress();

  const {
    title,
    networkId,
    accountId,
    tokens,
    closeAfterSelect = true,
    onSelect,
    tokenListState,
    searchAll,
    isAllNetworks,
    searchPlaceholder,
  } = route.params;

  const { network, account } = useAccountData({ networkId, accountId });

  const [searchKey] = useSearchKeyAtom();

  const handleTokenOnPress = useCallback(
    async (token: IAccountToken) => {
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
            const { accountsInfo } =
              await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
                ...params,
                includingNonExistingAccount: true,
                deriveType: token.accountId ? 'default' : undefined,
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
            void onSelect?.({
              ...token,
              accountId: matchedAccount.accountId,
            });
          } else {
            void onSelect?.(token);
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
              void onSelect?.({
                ...token,
                accountId: resp.accounts[0]?.id,
              });
            }
          } catch (e) {
            updateCreateAccountState({
              isCreatingAccount: false,
              token: null,
            });
          }
        }
      } else {
        void onSelect?.(token);
      }

      if (closeAfterSelect) {
        navigation.pop();
      }
    },
    [
      account,
      closeAfterSelect,
      createAddress,
      navigation,
      network?.id,
      network?.isAllNetworks,
      onSelect,
      updateCreateAccountState,
    ],
  );

  const fetchAccountTokens = useCallback(async () => {
    updateTokenListState({ initialized: false, isRefreshing: true });

    const r = await backgroundApiProxy.serviceToken.fetchAccountTokens({
      accountId,
      networkId,
      mergeTokens: true,
      flag: 'token-selector',
    });
    const { allTokens } = r;
    if (!allTokens) {
      updateTokenListState({ isRefreshing: false });
      throw new Error('allTokens not found from fetchAccountTokensWithMemo ');
    }

    refreshTokenList({ keys: allTokens.keys, tokens: allTokens.data });
    refreshTokenListMap({
      tokens: allTokens.map,
    });
    updateTokenListState({ initialized: true, isRefreshing: false });
  }, [
    accountId,
    networkId,
    refreshTokenList,
    refreshTokenListMap,
    updateTokenListState,
  ]);

  useEffect(() => {
    // use route params token
    const updateTokenList = async () => {
      if (tokens && !isEmpty(tokens.data)) {
        refreshTokenList({ tokens: tokens.data, keys: tokens.keys });
        refreshTokenListMap({
          tokens: tokens.map,
        });
        updateTokenListState({ initialized: true, isRefreshing: false });
      } else if (
        network &&
        !network?.isAllNetworks &&
        !tokenListState?.isRefreshing
      ) {
        void fetchAccountTokens();
      }
    };

    void updateTokenList();
  }, [
    fetchAccountTokens,
    network,
    network?.isAllNetworks,
    networkId,
    refreshTokenList,
    refreshTokenListMap,
    tokenListState?.isRefreshing,
    tokens,
    updateTokenListState,
  ]);

  useEffect(() => {
    const updateTokenList = async ({
      tokens: tokensFromOut,
      keys,
      map,
      merge,
    }: {
      tokens: IAccountToken[];
      keys: string;
      map: Record<string, ITokenFiat>;
      merge?: boolean;
    }) => {
      let vaultSettings: IVaultSettings | undefined;
      try {
        vaultSettings =
          await backgroundApiProxy.serviceNetwork.getVaultSettings({
            networkId: tokensFromOut[0]?.networkId ?? '',
          });
      } catch {
        // pass
      }

      updateTokenListState({ initialized: true, isRefreshing: false });
      refreshTokenList({
        tokens: tokensFromOut,
        keys,
        merge,
        mergeDerive: vaultSettings?.mergeDeriveAssetsEnabled,
      });
      refreshTokenListMap({
        tokens: map,
        merge,
        mergeDerive: vaultSettings?.mergeDeriveAssetsEnabled,
      });
    };
    appEventBus.on(EAppEventBusNames.TokenListUpdate, updateTokenList);
    return () => {
      appEventBus.off(EAppEventBusNames.TokenListUpdate, updateTokenList);
    };
  }, [refreshTokenList, refreshTokenListMap, updateTokenListState]);

  const debounceUpdateSearchKey = useDebouncedCallback(
    updateSearchKey,
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
      updateSearchTokenState({ isSearching: true });
      await backgroundApiProxy.serviceToken.abortSearchTokens();
      try {
        const result = await backgroundApiProxy.serviceToken.searchTokens({
          accountId,
          networkId,
          keywords,
        });
        refreshSearchTokenList({ tokens: result });
      } catch (e) {
        console.log(e);
      }
      updateSearchTokenState({ isSearching: false });
    },
    [accountId, networkId, refreshSearchTokenList, updateSearchTokenState],
  );

  useEffect(() => {
    if (searchAll && searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH) {
      void searchTokensBySearchKey(searchKey);
    } else {
      updateSearchTokenState({ isSearching: false });
      refreshSearchTokenList({ tokens: [] });
      void backgroundApiProxy.serviceToken.abortSearchTokens();
    }
  }, [
    refreshSearchTokenList,
    searchAll,
    searchKey,
    searchTokensBySearchKey,
    updateSearchTokenState,
  ]);

  return (
    <Page safeAreaEnabled={false}>
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
          withPresetVerticalPadding={false}
          onPressToken={handleTokenOnPress}
          isAllNetworks={isAllNetworks ?? network?.isAllNetworks}
          withNetwork={isAllNetworks ?? network?.isAllNetworks}
          searchAll={searchAll}
          isTokenSelectorLayout
        />
      </Page.Body>
    </Page>
  );
}

const TokenSelectorWithProvider = memo(withTokenListProvider(TokenSelector));

export default function TokenSelectorModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[num]}
    >
      <TokenSelectorWithProvider />
    </AccountSelectorProviderMirror>
  );
}
