import { useCallback, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SearchBar, Stack, Toast } from '@onekeyhq/components';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAssetListRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalAssetListParamList } from '@onekeyhq/shared/src/routes';
import type {
  IAccountToken,
  ICustomTokenItem,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { TokenManagerList } from '../components/TokenManager/TokenManagerList';
import { useAccountInfoForManageToken } from '../hooks/useAddToken';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { useTokenSearch } from '../hooks/useTokenSearch';

import type { RouteProp } from '@react-navigation/core';

function TokenManagerModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.TokenManagerModal
      >
    >();
  const {
    walletId,
    isOthersWallet,
    indexedAccountId,
    networkId,
    accountId,
    deriveType,
  } = route.params;
  const isAllNetwork = networkId === getNetworkIdsMap().onekeyall;

  const {
    sectionTokens,
    refreshTokenLists,
    isLoadingLocalData,
    networkMaps,
    checkTokenExistInTokenList,
  } = useTokenManagement({
    networkId,
    accountId,
  });
  const {
    searchValue,
    searchResult,
    isSearchMode,
    setSearchValue,
    isLoadingRemoteData,
  } = useTokenSearch({
    walletId,
    networkId,
    accountId,
  });

  const dataSource = useMemo(() => {
    if (isSearchMode && Array.isArray(searchResult)) {
      return [{ title: '', data: searchResult }];
    }
    return sectionTokens;
  }, [isSearchMode, searchResult, sectionTokens]);

  const isEditRef = useRef(false);
  const onAddCustomToken = useCallback(
    (token?: ICustomTokenItem) => {
      navigation.push(EModalAssetListRoutes.AddCustomTokenModal, {
        walletId,
        isOthersWallet,
        indexedAccountId,
        networkId,
        accountId,
        deriveType,
        token,
        onSuccess: () => {
          void refreshTokenLists();
          isEditRef.current = true;
        },
      });
    },
    [
      navigation,
      walletId,
      isOthersWallet,
      indexedAccountId,
      networkId,
      accountId,
      deriveType,
      refreshTokenLists,
    ],
  );

  const { findAccountInfoForNetwork } = useAccountInfoForManageToken();
  const onHiddenToken = useCallback(
    async (token: IAccountToken) => {
      const { accountIdForNetwork } = await findAccountInfoForNetwork({
        accountId,
        networkId,
        isOthersWallet,
        indexedAccountId,
        deriveType,
        selectedNetworkId: token.networkId ?? networkId,
      });
      await backgroundApiProxy.serviceCustomToken.hideToken({
        token: {
          ...token,
          accountId: accountIdForNetwork,
          networkId: token.networkId ?? networkId,
          allNetworkAccountId: isAllNetwork ? accountId : undefined,
        },
      });
      isEditRef.current = true;
      setTimeout(() => {
        void refreshTokenLists();
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.address_book_add_address_toast_delete_success,
          }),
        });
      }, 200);
    },
    [
      refreshTokenLists,
      accountId,
      networkId,
      isOthersWallet,
      indexedAccountId,
      deriveType,
      intl,
      isAllNetwork,
      findAccountInfoForNetwork,
    ],
  );

  return (
    <Page
      safeAreaEnabled={false}
      onClose={() => {
        if (isEditRef.current) {
          appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
        }
      }}
    >
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.manage_token_title,
        })}
      />
      <Page.Body>
        <Stack px="$5" pb="$4">
          <SearchBar
            placeholder={intl.formatMessage({
              id: ETranslations.token_selector_search_placeholder,
            })}
            autoFocus
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
            onSubmitEditing={() => {}}
          />
        </Stack>
        <TokenManagerList
          dataSource={dataSource}
          onAddCustomToken={onAddCustomToken}
          onHiddenToken={onHiddenToken}
          isLoadingRemoteData={isLoadingRemoteData}
          isLoadingLocalData={isLoadingLocalData}
          networkId={networkId}
          isAllNetwork={isAllNetwork}
          networkMaps={networkMaps}
          checkTokenExistInTokenList={checkTokenExistInTokenList}
          searchValue={searchValue}
          searchResult={searchResult}
          showListHeader={!isSearchMode}
        />
      </Page.Body>
    </Page>
  );
}

function TokenManagerModalContainer() {
  return (
    <HomeTokenListProviderMirror>
      <TokenManagerModal />
    </HomeTokenListProviderMirror>
  );
}

export default TokenManagerModalContainer;
