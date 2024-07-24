import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { throttle } from 'lodash';

import {
  Divider,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IModalAssetListParamList } from '@onekeyhq/shared/src/routes';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useTokenListAtom } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import type { RouteProp } from '@react-navigation/core';

type ICustomTokenItem = IAccountToken & { canAdded?: boolean };

function TokenManagerModal() {
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
  const [tokenList] = useTokenListAtom();

  const { result, run } = usePromiseResult(
    async () => {
      const hiddenToken =
        await backgroundApiProxy.serviceCustomToken.getHiddenTokens({
          accountId,
          networkId,
        });
      return tokenList.tokens.filter(
        (token) =>
          !hiddenToken.find(
            (t) =>
              t.address === token.address && t.networkId === token.networkId,
          ),
      ) as ICustomTokenItem[];
    },
    [tokenList, accountId, networkId],
    {
      checkIsFocused: false,
    },
  );

  const [searchValue, setSearchValue] = useState('');
  const throttledSearchTokensRef = useRef(
    throttle(async (keywords) => {
      const r =
        await backgroundApiProxy.serviceCustomToken.searchTokenByKeywords({
          walletId,
          networkId,
          keywords,
        });
      console.log('=====>>>>Search Result: ', r);
      return r;
    }, 500),
  );
  const { result: searchResult } = usePromiseResult(async () => {
    if (!searchValue) {
      return null;
    }
    console.log('=====>>>>Search Value: ', searchValue);
    const r = await throttledSearchTokensRef.current(searchValue);
    return r?.map((t) => {
      const { price, price24h, info } = t;

      return {
        $key: `search__${info.networkId ?? ''}_${info.address}_${
          info.isNative ? 'native' : 'token'
        }`,
        address: info.address,
        decimals: info.decimals,
        isNative: info.isNative,
        logoURI: info.logoURI,
        name: info.name,
        symbol: info.symbol,
        riskLevel: info.riskLevel,
        networkId: info.networkId,
        // Add price info
        price,
        price24h,
        canAdded: !result?.find((n) => n.address === info.address),
      } as ICustomTokenItem;
    });
  }, [searchValue, result]);
  const isSearchMode = useMemo(
    () => searchValue && searchValue.length > 0,
    [searchValue],
  );
  const dataSource = useMemo(() => {
    if (
      isSearchMode &&
      Array.isArray(searchResult) &&
      searchResult.length > 0
    ) {
      return searchResult;
    }
    return result;
  }, [isSearchMode, searchResult, result]);
  useEffect(() => {
    console.log('===>TokenList: ', tokenList);
  }, [tokenList]);

  const onAddCustomToken = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.AddCustomTokenModal,
      params: {
        walletId,
        isOthersWallet,
        indexedAccountId,
        networkId,
        accountId,
        deriveType,
        onSuccess: () => {
          void run();
        },
      },
    });
  }, [
    navigation,
    walletId,
    isOthersWallet,
    indexedAccountId,
    networkId,
    accountId,
    deriveType,
    run,
  ]);

  const onHiddenToken = useCallback(
    async (token: IAccountToken) => {
      await backgroundApiProxy.serviceCustomToken.hideToken({
        token: {
          ...token,
          accountId: accountId ?? token.accountId ?? '',
          networkId: networkId ?? token.networkId,
        },
      });
      setTimeout(() => run(), 200);
    },
    [run, accountId, networkId],
  );

  return (
    <Page safeAreaEnabled>
      <Page.Header title="Manage Token" />
      <Page.Body>
        <Stack mx="$4">
          <SearchBar
            placeholder="Search symbol or contract"
            autoFocus
            zIndex={20}
            selectTextOnFocus
            value={searchValue}
            onSearchTextChange={setSearchValue}
            onSubmitEditing={() => {
              console.log('submit search value: => : ', searchValue);
            }}
          />
        </Stack>
        <ListView
          data={dataSource}
          ListHeaderComponent={
            isSearchMode ? null : (
              <>
                <ListItem
                  mt="$4"
                  title="Manually add a token"
                  onPress={() => {
                    onAddCustomToken();
                  }}
                >
                  <ListItem.IconButton icon="ChevronRightSmallOutline" />
                </ListItem>
                <Divider />
                <SizableText
                  mt={10}
                  px="$5"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  Added token
                </SizableText>
              </>
            )
          }
          keyExtractor={(item) => item.$key}
          renderItem={({ item }) => (
            <ListItem>
              <TokenIconView
                icon={item.logoURI}
                networkId={networkId}
                isAllNetworks
              />
              <ListItem.Text
                flex={1}
                align="right"
                primary={<SizableText>{item.name}</SizableText>}
                primaryTextProps={{
                  size: '$bodyLgMedium',
                }}
              />
              {item.isNative ? null : (
                <ListItem.IconButton
                  icon={item.canAdded ? 'PlusCircleOutline' : 'DeleteOutline'}
                  onPress={() => onHiddenToken(item)}
                />
              )}
            </ListItem>
          )}
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
