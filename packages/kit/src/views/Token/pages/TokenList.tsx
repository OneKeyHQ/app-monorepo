import { memo, useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page, Popover, SizableText, Stack } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';

import { TokenListView } from '../../../components/TokenListView';
import {
  useTokenListActions,
  withTokenListProvider,
} from '../../../states/jotai/contexts/token-list';

import type { ETokenPages, ITokenParamList } from '../router/type';
import type { RouteProp } from '@react-navigation/core';

function TokenList() {
  const route = useRoute<RouteProp<ITokenParamList, ETokenPages.TokenList>>();

  const { tokenList, title, helpText, onPressToken } = route.params;
  const { tokens, tokenMap, keys } = tokenList;

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
        <TokenListView onPressToken={onPressToken} />
      </Page.Body>
    </Page>
  );
}

const TokenListWithProvider = memo(withTokenListProvider(TokenList));

export { TokenList, TokenListWithProvider };
