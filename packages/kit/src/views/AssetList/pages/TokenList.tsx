import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, Popover, SizableText, Stack } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  ENABLE_SEARCH_TOKEN_LIST_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes';
import type { IToken } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
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

function TokenList() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<IModalAssetListParamList, EModalAssetListRoutes.TokenList>
    >();

  const {
    accountId,
    networkId,
    tokenList,
    title,
    helpText,
    onPressToken,
    isBlocked,
  } = route.params;
  const { tokens, map: tokenMap, keys } = tokenList;

  const {
    refreshTokenList,
    refreshTokenListMap,
    updateTokenListState,
    updateSearchKey,
  } = useTokenListActions().current;

  const headerRight = useCallback(() => {
    if (!helpText) return null;

    return (
      <Popover
        title="Define"
        renderTrigger={<HeaderIconButton icon="QuestionmarkOutline" />}
        renderContent={
          <Stack p="$5">
            <SizableText>{helpText}</SizableText>
          </Stack>
        }
      />
    );
  }, [helpText]);

  const handleOnPressToken = useCallback(
    (token: IToken) => {
      navigation.push(EModalAssetDetailRoutes.TokenDetails, {
        accountId,
        networkId,
        tokenInfo: token,
        isBlocked,
      });
    },
    [accountId, isBlocked, navigation, networkId],
  );

  useEffect(() => {
    if (keys && tokens && tokenMap) {
      refreshTokenList({
        tokens,
        keys,
      });
      refreshTokenListMap(tokenMap);
      updateTokenListState({ initialized: true, isRefreshing: false });
    }
  }, [
    keys,
    refreshTokenList,
    refreshTokenListMap,
    tokenMap,
    tokens,
    updateTokenListState,
  ]);

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
                placeholder: intl.formatMessage({ id: 'form__search' }),
              }
            : undefined
        }
      />
      <Page.Body>
        <TokenListView
          onPressToken={onPressToken ?? handleOnPressToken}
          withPrice
        />
      </Page.Body>
    </Page>
  );
}

const TokenListWithProvider = memo(withTokenListProvider(TokenList));

export { TokenList, TokenListWithProvider };
