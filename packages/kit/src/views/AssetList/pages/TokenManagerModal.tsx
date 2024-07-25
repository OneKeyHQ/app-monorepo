import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Empty,
  ListView,
  Page,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TokenIconView } from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IModalAssetListParamList } from '@onekeyhq/shared/src/routes';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useTokenListAtom } from '../../../states/jotai/contexts/tokenList';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';

import type { RouteProp } from '@react-navigation/core';

type ICustomTokenItem = IAccountToken & { canAdded?: boolean };

function ListEmptyComponent({
  onAddCustomToken,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();
  return (
    <Empty
      flex={1}
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
      description="Cannot find the token? Try click the button below to add"
      button={
        <Button
          mt="$6"
          size="medium"
          variant="primary"
          onPress={() => onAddCustomToken()}
        >
          {intl.formatMessage({
            id: ETranslations.manger_token_custom_token_button,
          })}
        </Button>
      }
    />
  );
}

function ListFooterComponent({
  searchValue,
  searchResult,
  onAddCustomToken,
}: {
  searchValue: string;
  searchResult: ICustomTokenItem[] | null;
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();
  if (
    searchValue.length &&
    Array.isArray(searchResult) &&
    searchResult.length
  ) {
    return (
      <>
        <Divider pt="$5" />
        <YStack p="$5" alignItems="center">
          <SizableText
            textAlign="center"
            size="$bodyMd"
            maxWidth={platformEnv.isNative ? 256 : undefined}
          >
            Cannot find the token? Try click the button below to add
          </SizableText>
          <Button
            mt="$6"
            size="medium"
            variant="primary"
            onPress={() => onAddCustomToken()}
          >
            {intl.formatMessage({
              id: ETranslations.manger_token_custom_token_button,
            })}
          </Button>
        </YStack>
      </>
    );
  }

  return null;
}

function SkeletonList() {
  return Array.from({ length: 5 }).map((_, index) => (
    <ListItem key={index}>
      <XStack alignItems="center" space="$3">
        <Skeleton width="$10" height="$10" radius="round" />
        <YStack space="$2">
          <Skeleton w={120} h={12} borderRadius="$3" />
          <Skeleton w={80} h={12} borderRadius="$3" />
        </YStack>
      </XStack>
    </ListItem>
  ));
}

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
  const isAllNetwork = networkId === getNetworkIdsMap().onekeyall;
  const [tokenList] = useTokenListAtom();

  const { result, run } = usePromiseResult(
    async () => {
      const [hiddenTokens, customTokens] = await Promise.all([
        backgroundApiProxy.serviceCustomToken.getHiddenTokens({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceCustomToken.getCustomTokens({
          accountId,
          networkId,
        }),
      ]);
      const allTokens = [...tokenList.tokens, ...customTokens];
      const uniqueTokens = allTokens.filter(
        (token, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.networkId === token.networkId &&
              t.accountId === token.accountId &&
              t.address === token.address,
          ),
      );
      return uniqueTokens.filter(
        (token) =>
          !hiddenTokens.find(
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

  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState<ICustomTokenItem[] | null>(
    null,
  );
  const debouncedFetchDataRef = useRef(
    debounce(
      async (params: {
        walletId: string;
        networkId: string;
        searchValue: string;
        existTokens: ICustomTokenItem[] | undefined;
      }) => {
        setIsLoading(true);
        try {
          const r =
            await backgroundApiProxy.serviceCustomToken.searchTokenByKeywords({
              walletId: params.walletId,
              networkId: params.networkId,
              keywords: params.searchValue,
            });
          const formattedResult = r?.map((t) => {
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
              canAdded: !params.existTokens?.find(
                (n) => n.address === info.address,
              ),
            } as ICustomTokenItem;
          });
          setSearchResult(formattedResult);
        } catch (error) {
          console.error('Error fetching search response:', error);
        } finally {
          setIsLoading(false);
        }
      },
      500,
    ),
  ).current;

  useEffect(() => {
    if (!searchValue) {
      setSearchResult(null);
      return;
    }
    void debouncedFetchDataRef({
      walletId,
      networkId,
      searchValue,
      existTokens: result,
    });
    return () => {
      debouncedFetchDataRef.cancel();
    };
  }, [result, searchValue, networkId, walletId, debouncedFetchDataRef]);
  const isSearchMode = useMemo(
    () => searchValue && searchValue.length > 0,
    [searchValue],
  );
  const dataSource = useMemo(() => {
    if (isSearchMode && Array.isArray(searchResult)) {
      return searchResult;
    }
    return result;
  }, [isSearchMode, searchResult, result]);

  const { result: networkMaps } = usePromiseResult(
    async () => {
      const networkIds: string[] = Array.from(
        new Set((dataSource ?? []).map((i) => i.networkId ?? '')),
      );
      if ((networkIds && !Array.isArray(networkIds)) || !networkIds.length) {
        return {};
      }
      const networks = await backgroundApiProxy.serviceNetwork.getNetworksByIds(
        {
          networkIds,
        },
      );
      return networks.networks.reduce<Record<string, IServerNetwork>>(
        (acc, network) => {
          acc[network.id] = network;
          return acc;
        },
        {},
      );
    },
    [dataSource],
    {
      initResult: {},
    },
  );

  const onAddCustomToken = useCallback(
    (token?: ICustomTokenItem) => {
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetListRoutes.AddCustomTokenModal,
        params: {
          walletId,
          isOthersWallet,
          indexedAccountId,
          networkId,
          accountId,
          deriveType,
          token,
          onSuccess: () => {
            void run();
            appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
          },
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
      run,
    ],
  );

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
            onSubmitEditing={() => {}}
          />
        </Stack>
        {isLoading ? (
          <SkeletonList />
        ) : (
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
                  networkId={item.networkId ?? networkId}
                  isAllNetworks
                />
                <YStack flex={1}>
                  <XStack space="$2">
                    <SizableText size="$bodyLgMedium" color="$text">
                      {item.symbol}
                    </SizableText>
                    {isAllNetwork ? (
                      <Badge>
                        {networkMaps?.[item.networkId ?? '']?.name ?? ''}
                      </Badge>
                    ) : null}
                  </XStack>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {item.name}
                  </SizableText>
                </YStack>
                <ListItem.IconButton
                  icon={item.canAdded ? 'PlusCircleOutline' : 'DeleteOutline'}
                  onPress={() =>
                    item.canAdded ? onAddCustomToken(item) : onHiddenToken(item)
                  }
                />
              </ListItem>
            )}
            ListFooterComponent={
              <ListFooterComponent
                searchValue={searchValue}
                searchResult={searchResult}
                onAddCustomToken={onAddCustomToken}
              />
            }
            ListEmptyComponent={
              <ListEmptyComponent onAddCustomToken={onAddCustomToken} />
            }
          />
        )}
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
