import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { NumberSizeableText, Stack } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token, TokenName } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { getTokenPriceChangeStyle } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IUniversalSearchAccountAssets } from '@onekeyhq/shared/types/search';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

interface IUniversalSearchAccountAssetItemProps {
  item: IUniversalSearchAccountAssets;
  allAggregateTokenMap?: Record<string, { tokens: IAccountToken[] }>;
  getSearchInput: () => string;
}

export function UniversalSearchAccountAssetItem({
  item,
  allAggregateTokenMap,
  getSearchInput,
}: IUniversalSearchAccountAssetItemProps) {
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const universalSearchActions = useUniversalSearchActions();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { token, tokenFiat } = item.payload;
  const priceChange = tokenFiat?.price24h ?? 0;
  // Callback snapshot (red-team R-#4): the full home fiat map, captured in
  // `handlePress` and seeded into the TokenDetails route. Replaces the deleted
  // `homeTokenFiatMap`. This is a home store mirror (UniversalSearch wrapper).
  const { map: homeTokenFiatMap } = useHomeTokenListSnapshot();
  // PR-3 (tokenList cells full-delete): no longer reads `aggregateTokensListMapAtom`.
  // `TokenName` defaults `aggregateTokenList` to `[]` when the prop is omitted and
  // derives the aggregate badge from `allAggregateTokenMap` (passed in via the
  // `allAggregateTokenMap` prop, fetched by UniversalSearch), so badge behavior is
  // preserved without the per-`$key` owned-sub-token list.
  const { changeColor, showPlusMinusSigns } = getTokenPriceChangeStyle({
    priceChange,
  });
  const fiatValue = new BigNumber(tokenFiat?.fiatValue ?? 0);

  const handlePress = useCallback(async () => {
    defaultLogger.universalSearch.search.universalSearchClick({
      searchText: getSearchInput(),
      type: item.type,
      itemId: token.address ?? token.symbol ?? '',
      itemTitle: token.name ?? token.symbol ?? '',
    });

    navigation.pop();
    if (
      !activeAccount ||
      !activeAccount.account ||
      !activeAccount.network ||
      !activeAccount.wallet ||
      !activeAccount.deriveInfo ||
      !activeAccount.deriveType ||
      !activeAccount.indexedAccount
    )
      return;

    // wait for the modal animation is finished
    await timerUtils.wait(300);
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetDetailRoutes.TokenDetails,
      params: {
        accountId: token.accountId ?? activeAccount.account?.id ?? '',
        networkId: token.networkId ?? activeAccount.network?.id,
        walletId: activeAccount.wallet?.id,
        tokenInfo: token,
        isAllNetworks: activeAccount.network?.isAllNetworks,
        indexedAccountId: activeAccount.indexedAccount?.id ?? '',
        tokenMap: homeTokenFiatMap,
        accountAddress: activeAccount.account?.address ?? '',
      },
    });

    await timerUtils.wait(10);
    // Add to recent search list
    universalSearchActions.current.addIntoRecentSearchList({
      id: `${token.symbol}-${token.networkId || ''}-${
        token.accountId || activeAccount.account?.id || ''
      }`,
      text: token.symbol || token.name || '',
      type: item.type,
      timestamp: Date.now(),
      extra: {
        tokenSymbol: token.symbol || '',
        tokenName: token.name || '',
        networkId: token.networkId || '',
        accountId: token.accountId || '',
      },
    });
  }, [
    activeAccount,
    homeTokenFiatMap,
    getSearchInput,
    item.type,
    navigation,
    token,
    universalSearchActions,
  ]);

  return (
    <ListItem
      key={token?.$key || token?.name}
      userSelect="none"
      onPress={handlePress}
    >
      <Token
        size="lg"
        tokenImageUri={token?.logoURI}
        networkId={token?.networkId}
        showNetworkIcon
      />
      <Stack flexGrow={1} flexBasis={0} minWidth={96} flexDirection="column">
        <TokenName
          $key={token?.$key}
          name={token?.name}
          isAggregateToken={token?.isAggregateToken}
          networkId={token?.networkId}
          isNative={token?.isNative}
          isAllNetworks={networkUtils.isAllNetwork({
            networkId: activeAccount?.network?.id,
          })}
          withNetwork={networkUtils.isAllNetwork({
            networkId: activeAccount?.network?.id,
          })}
          textProps={{
            size: '$bodyLgMedium',
            flexShrink: 0,
          }}
          withAggregateBadge
          allAggregateTokenMap={allAggregateTokenMap}
        />
        <NumberSizeableTextWrapper
          formatter="balance"
          formatterOptions={{ tokenSymbol: token?.symbol }}
          size="$bodyMd"
          color="$textSubdued"
          hideValue={hideValue}
        >
          {tokenFiat?.balanceParsed ?? '0'}
        </NumberSizeableTextWrapper>
      </Stack>
      <Stack flexDirection="column" alignItems="flex-end" flexShrink={1}>
        <Currency
          formatter="value"
          sourceCurrency={tokenFiat?.currency}
          size="$bodyLgMedium"
          hideValue={hideValue}
        >
          {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
        </Currency>
        <NumberSizeableText
          formatter="priceChange"
          formatterOptions={{ showPlusMinusSigns }}
          color={changeColor}
          size="$bodyMd"
        >
          {priceChange}
        </NumberSizeableText>
      </Stack>
    </ListItem>
  );
}
