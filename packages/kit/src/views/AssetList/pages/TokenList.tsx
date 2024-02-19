import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page, Popover, SizableText, Stack } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import type { IToken } from '@onekeyhq/shared/types/token';

import { TokenListView } from '../../../components/TokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/tokenList';
import { EModalAssetDetailRoutes } from '../../AssetDetails/router/types';

import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '../router/types';
import type { RouteProp } from '@react-navigation/core';

function TokenList() {
  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<IModalAssetListParamList, EModalAssetListRoutes.TokenList>
    >();

  const { accountId, networkId, tokenList, title, helpText, onPressToken } =
    route.params;
  const { tokens, map: tokenMap, keys } = tokenList;

  const { refreshTokenList, refreshTokenListMap } =
    useTokenListActions().current;

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
      });
    },
    [accountId, navigation, networkId],
  );

  useEffect(() => {
    if (keys && tokens && tokenMap) {
      refreshTokenList({
        tokens,
        keys,
      });
      refreshTokenListMap(tokenMap);
    }
  }, [keys, refreshTokenList, refreshTokenListMap, tokenMap, tokens]);

  return (
    <Page>
      <Page.Header title={title} headerRight={headerRight} />
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
