import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce, isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  ENABLE_SEARCH_TOKEN_LIST_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes';
import { flattenAggregateTokensMap } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import { perfTokenListView } from '../../../components/TokenListView/perfTokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/tokenList';

import type { RouteProp } from '@react-navigation/core';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

type ITokenListParams =
  IModalAssetListParamList[EModalAssetListRoutes.TokenList];

function TokenListContent({ params }: { params: ITokenListParams }) {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    tokenList,
    title,
    helpText,
    onPressToken,
    isBlocked,
    deriveInfo,
    deriveType,
    isAllNetworks,
    hideValue,
    aggregateTokensListMap,
    aggregateTokensMap,
    accountAddress,
    allAggregateTokenMap,
    searchKeyLengthThreshold,
  } = params;
  const { tokens, map: tokenMap, keys } = tokenList;

  // full-delete PR-7: feed the TokenListView wrapper its display maps from the
  // route params (which AssetList already has) through the generalized HOST
  // props, so the wrapper + inner cmp no longer read the isolated-store target
  // atoms (`tokenListMapAtom` / `flattenAggregateTokensMapAtom` /
  // `aggregateTokensListMapAtom`) to serve this modal. The `refresh*` writers in
  // the effect below stay until PR-8 (they keep AssetList behavior unchanged).
  const hostTokenList = useMemo(
    () => ({ tokens, smallBalanceTokens: [] as IAccountToken[] }),
    [tokens],
  );
  const hostAggregateTokenFiatMap = useMemo(
    () => flattenAggregateTokensMap(aggregateTokensMap ?? {}),
    [aggregateTokensMap],
  );

  const { updateTokenListState, updateSearchKey } =
    useTokenListActions().current;

  const headerRight = useCallback(() => {
    if (!helpText) return null;

    return (
      <Popover
        title={intl.formatMessage({ id: ETranslations.low_value_assets })}
        renderTrigger={<HeaderIconButton icon="QuestionmarkOutline" />}
        renderContent={
          <YStack p="$5" gap="$2">
            {isString(helpText) ? (
              <SizableText>{helpText}</SizableText>
            ) : (
              helpText.map((text, index) => (
                <XStack key={index} gap="$2">
                  <Stack
                    w="$1.5"
                    h="$1.5"
                    bg="$textSubdued"
                    borderRadius="$full"
                    mt="$2"
                  />
                  <SizableText size="$bodyMd">{text}</SizableText>
                </XStack>
              ))
            )}
          </YStack>
        }
      />
    );
  }, [helpText, intl]);

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      navigation.push(EModalAssetDetailRoutes.TokenDetails, {
        accountId: token.accountId ?? accountId,
        networkId: token.networkId ?? networkId,
        walletId,
        isBlocked,
        deriveInfo,
        deriveType,
        isAllNetworks,
        indexedAccountId: indexedAccountId ?? '',
        tokenInfo: token,
        aggregateTokens: aggregateTokensListMap?.[token.$key]?.tokens ?? [],
        tokenMap,
        accountAddress,
      });
    },
    [
      accountId,
      aggregateTokensListMap,
      deriveInfo,
      deriveType,
      indexedAccountId,
      isAllNetworks,
      isBlocked,
      navigation,
      networkId,
      tokenMap,
      walletId,
      accountAddress,
    ],
  );

  useEffect(() => {
    if (keys && tokens && tokenMap) {
      perfTokenListView.markEnd('tokenListRefreshing_tokenListPageUseEffect');
      updateTokenListState({ initialized: true, isRefreshing: false });
    }
  }, [keys, tokenMap, tokens, updateTokenListState]);

  return (
    <Page>
      <Page.Header
        title={title}
        headerRight={headerRight}
        headerSearchBarOptions={
          tokens.length >= ENABLE_SEARCH_TOKEN_LIST_MIN_LENGTH
            ? {
                onChangeText: debounce(
                  (e: NativeSyntheticEvent<TextInputFocusEventData>) =>
                    updateSearchKey(e.nativeEvent.text),
                  SEARCH_DEBOUNCE_INTERVAL,
                ),
                placeholder: intl.formatMessage({
                  id: ETranslations.global_search,
                }),
              }
            : undefined
        }
      />
      <Page.Body>
        <TokenListView
          accountId={accountId}
          networkId={networkId}
          indexedAccountId={indexedAccountId}
          onPressToken={onPressToken ?? handleOnPressToken}
          withPrice
          isAllNetworks={isAllNetworks}
          hideValue={hideValue}
          allAggregateTokenMap={allAggregateTokenMap}
          showNetworkIcon={isAllNetworks}
          searchKeyLengthThreshold={searchKeyLengthThreshold}
          hostTokenList={hostTokenList}
          hostTokenListMap={tokenMap}
          hostAggregateTokenListMap={aggregateTokensListMap}
          hostAggregateTokenFiatMap={hostAggregateTokenFiatMap}
        />
      </Page.Body>
    </Page>
  );
}

function TokenList() {
  const route =
    useRoute<
      RouteProp<IModalAssetListParamList, EModalAssetListRoutes.TokenList>
    >();
  const navigation = useAppNavigation();
  const intl = useIntl();

  // An orphaned modal can select this default route without account params.
  // Keep it recoverable without mounting account-dependent token content.
  if (!route.params) {
    return (
      <Page>
        <Page.Header />
        <Page.Body>
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            gap="$4"
            p="$5"
          >
            <SizableText textAlign="center">
              {intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              })}
            </SizableText>
            <Button
              testID="token-list-missing-params-back"
              onPress={() => navigation.popToMainRoute()}
            >
              {intl.formatMessage({ id: ETranslations.global_back })}
            </Button>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return <TokenListContent params={route.params} />;
}

const TokenListWithProvider = memo(withTokenListProvider(TokenList));
TokenListWithProvider.displayName = 'TokenListWithProvider';

export { TokenList, TokenListWithProvider };
