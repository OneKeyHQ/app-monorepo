import { useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import { type ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import SwapProPositionListHeader from '../../components/SwapProPositionListHeader';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';
import { useSwapProPositionsPnl } from '../../hooks/useSwapProPositionsPnl';

import {
  buildStockPositionsMetadataScope,
  getStockPositionTokenIdentityKeys,
  getSwapPositionTokenIdentityKey,
  shouldRenderStockPositionsSkeleton,
} from './SwapProPositionsList.utils';

function SwapProPositionItemSkeleton() {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      minHeight="$11"
      gap="$3"
      py="$2"
      px="$2"
      mx="$-2"
      borderRadius="$3"
    >
      <XStack alignItems="center" gap="$2" flexGrow={1} flexBasis={0}>
        <Skeleton w="$8" h="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton h="$5" w="$24" />
          <Skeleton h="$4" w="$16" />
        </YStack>
      </XStack>

      <YStack alignItems="flex-end" flexShrink={0} gap="$1">
        <Skeleton h="$5" w="$16" />
        <Skeleton h="$4" w="$20" />
      </YStack>
    </Stack>
  );
}

function SwapProPositionsListSkeleton({ rowCount }: { rowCount: number }) {
  return (
    <YStack>
      <SwapProPositionListHeader />
      {Array.from({ length: rowCount }).map((_, index) => (
        <SwapProPositionItemSkeleton key={`position-skeleton-${index}`} />
      ))}
    </YStack>
  );
}

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
  onSearchClick?: () => void;
  filterToken?: ISwapToken[];
  cachedTokenList?: ISwapToken[];
  hasPositionOwner: boolean;
  hasCachedTokenSnapshot?: boolean;
  isLiveTokenListForCurrentOwner: boolean;
  // Stock context: only show stock tokens, and hide the "find your token" footer.
  stockOnly?: boolean;
  hideSearch?: boolean;
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
  cachedTokenList,
  hasPositionOwner,
  hasCachedTokenSnapshot,
  isLiveTokenListForCurrentOwner,
  stockOnly,
  hideSearch,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const shouldUseCachedTokenList =
    !!hasCachedTokenSnapshot && !isLiveTokenListForCurrentOwner;
  let sourceTokenList: ISwapToken[] | undefined;
  if (shouldUseCachedTokenList) {
    sourceTokenList = cachedTokenList;
  } else if (!isLiveTokenListForCurrentOwner) {
    sourceTokenList = [];
  }
  const { finallyTokenList } = useSwapProPositionsListFilter(
    filterToken,
    sourceTokenList,
    stockOnly,
  );
  const [settings] = useSettingsPersistAtom();
  const stockMetadataScope = useMemo(
    () =>
      buildStockPositionsMetadataScope({
        locale: settings.locale,
        tokens: stockOnly ? finallyTokenList : [],
      }),
    [finallyTokenList, settings.locale, stockOnly],
  );
  const stockMetadataRequestRef = useRef({
    locale: settings.locale,
    scope: stockMetadataScope,
    tokens: finallyTokenList,
  });
  if (stockMetadataRequestRef.current.scope !== stockMetadataScope) {
    stockMetadataRequestRef.current = {
      locale: settings.locale,
      scope: stockMetadataScope,
      tokens: finallyTokenList,
    };
  }
  const lastGoodStockMetadataRef = useRef<{
    scope: string;
    tokenIdentityKeys: string[];
  } | null>(null);

  // In the stock context, resolve which holdings are actually stocks by
  // querying the server market metadata (account-holding tokens do NOT carry
  // isStock, so the client-side field is unreliable here).
  const { result: stockMetadataResult, isLoading: isStockMetadataLoading } =
    usePromiseResult(
      async () => {
        if (!stockOnly) {
          return undefined;
        }
        const request = stockMetadataRequestRef.current;
        if (request.scope !== stockMetadataScope) {
          return undefined;
        }
        if (!request.tokens.length) {
          return {
            scope: request.scope,
            tokenIdentityKeys: [] as string[],
            shouldPersist: false,
          };
        }
        try {
          const response =
            await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
              requestLocale: request.locale,
              tokenAddressList: request.tokens.map((token) => ({
                contractAddress: token.contractAddress ?? '',
                chainId: token.networkId,
                isNative: !!token.isNative,
              })),
            });
          const list = response.list ?? [];
          if (!request.tokens.every((_, index) => Boolean(list[index]))) {
            throw new OneKeyLocalError(
              'Incomplete market metadata response for Stock positions',
            );
          }
          // response.list is index-aligned with tokenAddressList: keep only the
          // holdings whose server entry has a truthy .stock field, and mark the
          // selected row as Stock-owned before downstream swap handlers.
          return {
            scope: request.scope,
            tokenIdentityKeys: getStockPositionTokenIdentityKeys({
              marketItems: list,
              tokens: request.tokens,
            }),
            shouldPersist: true,
          };
        } catch (error) {
          console.error('swapStock__loadPositionMetadata error', error);
          const lastGoodMetadata =
            lastGoodStockMetadataRef.current?.scope === request.scope
              ? lastGoodStockMetadataRef.current
              : undefined;
          return lastGoodMetadata
            ? { ...lastGoodMetadata, shouldPersist: false }
            : undefined;
        }
      },
      [stockMetadataScope, stockOnly],
      {
        initResult:
          stockOnly && finallyTokenList.length === 0
            ? {
                scope: stockMetadataScope,
                tokenIdentityKeys: [] as string[],
                shouldPersist: false,
              }
            : undefined,
        swrKey: stockMetadataScope
          ? swrKeys.swapStockPositionsMetadata({
              scope: stockMetadataScope,
            })
          : undefined,
        watchLoading: true,
        swrShouldPersist: (result) => result?.shouldPersist === true,
      },
    );
  const stockTokenIdentityKeys =
    stockMetadataResult?.scope === stockMetadataScope
      ? stockMetadataResult.tokenIdentityKeys
      : undefined;
  useEffect(() => {
    if (
      stockMetadataResult?.shouldPersist &&
      stockMetadataResult.scope === stockMetadataScope
    ) {
      lastGoodStockMetadataRef.current = {
        scope: stockMetadataResult.scope,
        tokenIdentityKeys: stockMetadataResult.tokenIdentityKeys,
      };
    }
  }, [stockMetadataResult, stockMetadataScope]);

  // The stock classification is undefined until the first batch resolves; treat that as a
  // loading state (skeleton below) so the list never flashes "No results" while
  // holdings are still being classified. usePromiseResult keeps the prior result
  // across subsequent fetches and on failure, so a defined value is always the
  // last good one.
  const isStockListLoading = shouldRenderStockPositionsSkeleton({
    isStockMetadataLoading,
    stockOnly: Boolean(stockOnly),
    stockTokenListResolved: stockTokenIdentityKeys !== undefined,
  });
  const stockTokenIdentityKeySet = useMemo(
    () => new Set(stockTokenIdentityKeys ?? []),
    [stockTokenIdentityKeys],
  );
  const displayTokenList = useMemo(
    () =>
      stockOnly
        ? finallyTokenList
            .filter((token) =>
              stockTokenIdentityKeySet.has(
                getSwapPositionTokenIdentityKey(token),
              ),
            )
            .map((token) => ({ ...token, isStock: true }))
        : finallyTokenList,
    [finallyTokenList, stockOnly, stockTokenIdentityKeySet],
  );
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(displayTokenList);

  if (
    (hasPositionOwner &&
      !isLiveTokenListForCurrentOwner &&
      !hasCachedTokenSnapshot) ||
    isStockListLoading
  ) {
    return <SwapProPositionsListSkeleton rowCount={stockOnly ? 3 : 2} />;
  }
  return (
    <YStack>
      <SwapProPositionListHeader />
      {displayTokenList.length > 0 ? (
        displayTokenList.map((item) => (
          <SwapProPositionItem
            key={`${item.networkId}-${item.contractAddress}`}
            token={item}
            onPress={onTokenPress}
            pnl={pnlMap.get(`${item.networkId}-${item.contractAddress}`)}
          />
        ))
      ) : (
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      )}
      {SwapProCurrentSymbolEnable ||
      !onSearchClick ||
      hideSearch ? undefined : (
        <SwapProPositionListFooter onSearchClick={onSearchClick} />
      )}
    </YStack>
  );
};

export default SwapProPositionsList;
