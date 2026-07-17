import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIdentityScopedSilentRefresh } from '@onekeyhq/kit/src/hooks/useIdentityScopedSilentRefresh';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProPositionsCacheAtom,
  useSwapProPositionsRequestStateAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import SwapProPositionListHeader from '../../components/SwapProPositionListHeader';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';
import { useSwapProPositionsPnl } from '../../hooks/useSwapProPositionsPnl';

import {
  buildStockPositionsMetadataOwnerKey,
  buildStockPositionsMetadataRequestKey,
  getExactStockPositionsMetadataSnapshot,
  getSwapProPositionTokenIdentity,
  getSwapProPositionsFailureState,
  isStockPositionsMetadataSnapshotUsable,
  isSwapProPositionsSourceReady,
  loadStockPositionsMetadataWithRetry,
  requireCompleteStockPositionsMetadataList,
  retrySwapProPositionsFailures,
  shouldRenderStockPositionsSkeleton,
  shouldRenderSwapProPositionsSourceSkeleton,
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
  hasCachedTokenList?: boolean;
  positionOwnerKey?: string;
  hasSettledPositionOwnerRequest?: boolean;
  positionSourceUnavailable?: boolean;
  onPositionSourceRetry?: () => void;
  // Stock context: only show stock tokens, and hide the "find your token" footer.
  stockOnly?: boolean;
  hideSearch?: boolean;
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
  cachedTokenList,
  hasCachedTokenList,
  positionOwnerKey,
  hasSettledPositionOwnerRequest,
  positionSourceUnavailable,
  onPositionSourceRetry,
  stockOnly,
  hideSearch,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const [swapProPositionsCache, setSwapProPositionsCache] =
    useSwapProPositionsCacheAtom();
  const [swapProPositionsRequestState] = useSwapProPositionsRequestStateAtom();
  const isRequestOwnerCurrent = Boolean(
    positionOwnerKey &&
    swapProPositionsRequestState.ownerKey === positionOwnerKey,
  );
  const exactPositionEntry = positionOwnerKey
    ? swapProPositionsCache.byOwner[positionOwnerKey]
    : undefined;
  const isExactSourceFailed =
    isRequestOwnerCurrent && swapProPositionsRequestState.status === 'error';
  const isOwnerSourceReady = isSwapProPositionsSourceReady({
    exactPositionTokenCount: exactPositionEntry?.tokens.length ?? 0,
    hasExactPositionSnapshot: Boolean(exactPositionEntry),
    hasSettledCurrentOwnerRequest: Boolean(hasSettledPositionOwnerRequest),
    sourceUnavailable: Boolean(positionSourceUnavailable),
  });
  const shouldUseCachedTokenList =
    !!hasCachedTokenList &&
    !!cachedTokenList?.length &&
    (swapProSupportNetworksTokenListLoading ||
      swapProSupportNetworksTokenList.length === 0);
  let scopedPositionTokenList: ISwapToken[] | undefined;
  if (positionOwnerKey !== undefined) {
    scopedPositionTokenList = isRequestOwnerCurrent
      ? swapProSupportNetworksTokenList
      : (exactPositionEntry?.tokens ?? []);
  } else if (shouldUseCachedTokenList) {
    scopedPositionTokenList = cachedTokenList;
  }
  const { finallyTokenList } = useSwapProPositionsListFilter(
    filterToken,
    scopedPositionTokenList,
    stockOnly,
  );
  const [settings] = useSettingsPersistAtom();

  // In the stock context, resolve which holdings are actually stocks by
  // querying the server market metadata (account-holding tokens do NOT carry
  // isStock, so the client-side field is unreliable here).
  const stockMetadataOwnerKey = buildStockPositionsMetadataOwnerKey({
    filterToken,
    sourceOwnerKey: isOwnerSourceReady ? (positionOwnerKey ?? '') : '',
  });
  const stockMetadataRequestKey = buildStockPositionsMetadataRequestKey({
    locale: settings.locale,
    tokens: finallyTokenList,
  });
  const restoredStockMetadataSnapshot = getExactStockPositionsMetadataSnapshot({
    ownerKey: stockMetadataOwnerKey,
    requestKey: stockMetadataRequestKey,
    snapshot: exactPositionEntry?.stockMetadataSnapshot,
  });
  const stockMetadataRefresh = useIdentityScopedSilentRefresh<string[]>({
    enabled: Boolean(
      stockOnly && isOwnerSourceReady && finallyTokenList.length,
    ),
    ownerKey: stockMetadataOwnerKey,
    requestKey: stockMetadataRequestKey,
    restored: restoredStockMetadataSnapshot,
    load: () =>
      loadStockPositionsMetadataWithRetry({
        load: async () => {
          const tokenAddressList = finallyTokenList.map((token) => ({
            contractAddress: token.contractAddress ?? '',
            chainId: token.networkId,
            isNative: !!token.isNative,
          }));
          const response =
            await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
              requestLocale: settings.locale,
              tokenAddressList,
            });
          const list = requireCompleteStockPositionsMetadataList({
            expectedCount: tokenAddressList.length,
            list: response.list,
          });
          return {
            status: 'success' as const,
            data: finallyTokenList.flatMap((token, index) =>
              list[index].stock ? [getSwapProPositionTokenIdentity(token)] : [],
            ),
          };
        },
      }),
    onCommit: ({ data, ownerKey, requestKey }) => {
      if (!positionOwnerKey || ownerKey !== stockMetadataOwnerKey) {
        return;
      }
      setSwapProPositionsCache((prev) => {
        const entry = prev.byOwner[positionOwnerKey];
        if (!entry) {
          return prev;
        }
        return {
          byOwner: {
            ...prev.byOwner,
            [positionOwnerKey]: {
              ...entry,
              stockMetadataSnapshot: {
                data,
                ownerKey,
                requestKey,
              },
            },
          },
        };
      });
    },
  });
  const visibleStockTokenIdentitySet = new Set(
    stockMetadataRefresh.visible?.data ?? [],
  );
  const displayTokenList = stockOnly
    ? finallyTokenList.flatMap((token) =>
        visibleStockTokenIdentitySet.has(getSwapProPositionTokenIdentity(token))
          ? [{ ...token, isStock: true }]
          : [],
      )
    : finallyTokenList;
  const hasUsableMetadataSnapshot = isStockPositionsMetadataSnapshotUsable({
    displayTokenCount: displayTokenList.length,
    isVisibleExact: stockMetadataRefresh.isVisibleExact,
    visibleTokenIdentityCount: stockMetadataRefresh.visible?.data.length,
  });
  const isStockListLoading = shouldRenderStockPositionsSkeleton({
    hasUsableMetadataSnapshot,
    metadataPhase: stockMetadataRefresh.phase,
    metadataRequired: Boolean(stockOnly && finallyTokenList.length),
    sourceReady: isOwnerSourceReady,
    stockOnly: Boolean(stockOnly),
  });
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(displayTokenList, positionOwnerKey);
  const positionsFailureState = getSwapProPositionsFailureState({
    hasExactPositionSnapshot: Boolean(exactPositionEntry),
    hasUsableMetadataSnapshot,
    isExactPositionRequestFailed: isExactSourceFailed,
    metadataPhase: stockMetadataRefresh.phase,
  });
  const isMetadataRequestFailed =
    stockMetadataRefresh.phase === 'failed' ||
    stockMetadataRefresh.phase === 'stale-error';
  const canRetryPositions = Boolean(
    (isExactSourceFailed && onPositionSourceRetry) || isMetadataRequestFailed,
  );
  const retryPositions = canRetryPositions
    ? () =>
        retrySwapProPositionsFailures({
          isExactPositionRequestFailed: isExactSourceFailed,
          metadataPhase: stockMetadataRefresh.phase,
          onMetadataRetry: stockMetadataRefresh.refresh,
          onPositionSourceRetry,
        })
    : undefined;
  const isPositionsSourceLoading = shouldRenderSwapProPositionsSourceSkeleton({
    hasScopedSource: positionOwnerKey !== undefined,
    hasUsableLegacyCache: shouldUseCachedTokenList,
    legacyLoading: swapProSupportNetworksTokenListLoading,
    sourceReady: isOwnerSourceReady,
    stockOnly: Boolean(stockOnly),
  });

  if (positionsFailureState === 'blocking') {
    return (
      <YStack>
        <SwapProPositionListHeader />
        <Empty
          icon="BrokenLinkOutline"
          title={intl.formatMessage({
            id: ETranslations.global_network_error,
          })}
          buttonProps={{
            children: intl.formatMessage({ id: ETranslations.global_retry }),
            disabled: !retryPositions,
            onPress: retryPositions,
            testID: 'swap-stock-positions-retry',
          }}
        />
      </YStack>
    );
  }
  if (isPositionsSourceLoading || isStockListLoading) {
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
      {positionsFailureState === 'stale' && retryPositions ? (
        <Button
          testID="swap-stock-positions-stale-retry"
          variant="tertiary"
          size="small"
          alignSelf="center"
          onPress={retryPositions}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      ) : null}
    </YStack>
  );
};

export default SwapProPositionsList;
