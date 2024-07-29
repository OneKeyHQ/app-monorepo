import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Empty,
  IconButton,
  Page,
  SearchBar,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Toast,
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
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { useTokenSearch } from '../hooks/useTokenSearch';

import type { RouteProp } from '@react-navigation/core';

type ICustomTokenItem = IAccountToken;

function ListEmptyComponent({
  onAddCustomToken,
  isLoading,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
  isLoading: boolean;
}) {
  const intl = useIntl();
  if (isLoading) {
    return null;
  }
  return (
    <Empty
      flex={1}
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
      description={intl.formatMessage({
        id: ETranslations.manage_token_empty_msg,
      })}
      button={
        <Button
          mt="$6"
          size="medium"
          variant="primary"
          onPress={() => onAddCustomToken()}
        >
          {intl.formatMessage({
            id: ETranslations.manage_token_custom_token_button,
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
            {intl.formatMessage({
              id: ETranslations.manage_token_empty_msg,
            })}
          </SizableText>
          <Button
            mt="$6"
            size="medium"
            variant="primary"
            onPress={() => onAddCustomToken()}
          >
            {intl.formatMessage({
              id: ETranslations.manage_token_custom_token_button,
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
    isLoadingHomePageData,
    networkMaps,
    checkTokenExistInTokenList,
  } = useTokenManagement({
    networkId,
    accountId,
  });
  const { searchValue, searchResult, isSearchMode, setSearchValue, isLoading } =
    useTokenSearch({
      walletId,
      networkId,
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

  const onHiddenToken = useCallback(
    async (token: IAccountToken) => {
      await backgroundApiProxy.serviceCustomToken.hideToken({
        token: {
          ...token,
          accountId: token.accountId ?? accountId ?? '',
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
    [refreshTokenLists, accountId, networkId, intl, isAllNetwork],
  );

  const headerRight = useCallback(
    () =>
      isSearchMode ? null : (
        <IconButton
          variant="tertiary"
          icon="PlusCircleOutline"
          onPress={() => onAddCustomToken()}
          title={intl.formatMessage({
            id: ETranslations.manage_token_custom_token_title,
          })}
        />
      ),
    [intl, isSearchMode, onAddCustomToken],
  );

  return (
    <Page
      safeAreaEnabled
      onClose={() => {
        if (isEditRef.current && networkId !== getNetworkIdsMap().onekeyall) {
          appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
        }
      }}
    >
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.manage_token_title,
        })}
        headerRight={headerRight}
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
        {isLoading || !dataSource ? (
          <SkeletonList />
        ) : (
          <SectionList
            sections={dataSource}
            renderSectionHeader={({ section: { title, data } }) => (
              <>
                <SizableText
                  mt={10}
                  px="$5"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {title}
                </SizableText>
                {Array.isArray(data) && !data.length ? (
                  <ListEmptyComponent
                    onAddCustomToken={onAddCustomToken}
                    isLoading={isLoadingHomePageData || isLoading}
                  />
                ) : null}
              </>
            )}
            keyExtractor={(item) => (item as ICustomTokenItem).$key}
            renderItem={({ item }: { item: ICustomTokenItem }) => (
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
                  icon={
                    checkTokenExistInTokenList(item)
                      ? 'MinusCircleOutline'
                      : 'PlusCircleOutline'
                  }
                  onPress={() =>
                    checkTokenExistInTokenList(item)
                      ? onHiddenToken(item)
                      : onAddCustomToken(item)
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
              <ListEmptyComponent
                onAddCustomToken={onAddCustomToken}
                isLoading={isLoadingHomePageData || isLoading}
              />
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
