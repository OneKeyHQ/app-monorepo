import { useIntl } from 'react-intl';

import { Empty, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapProEnableCurrentSymbolAtom,
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
  stockOnly,
  hideSearch,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const shouldUseCachedTokenList =
    !!hasCachedTokenList &&
    !!cachedTokenList?.length &&
    (swapProSupportNetworksTokenListLoading ||
      swapProSupportNetworksTokenList.length === 0);
  const { finallyTokenList } = useSwapProPositionsListFilter(
    filterToken,
    shouldUseCachedTokenList ? cachedTokenList : undefined,
    stockOnly,
  );
  const [settings] = useSettingsPersistAtom();

  // In the stock context, resolve which holdings are actually stocks by
  // querying the server market metadata (account-holding tokens do NOT carry
  // isStock, so the client-side field is unreliable here).
  const { result: stockTokenList } = usePromiseResult(async () => {
    if (!stockOnly) {
      return undefined;
    }
    if (!finallyTokenList.length) {
      return [] as ISwapToken[];
    }
    // Let a fetch failure throw rather than swallowing it into an empty list:
    // usePromiseResult then keeps the previous successful result instead of
    // wrongly showing "No results" on a tab that hides the search entry.
    const response =
      await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
        requestLocale: settings.locale,
        tokenAddressList: finallyTokenList.map((token) => ({
          contractAddress: token.contractAddress ?? '',
          chainId: token.networkId,
          isNative: !!token.isNative,
        })),
      });
    const list = response.list ?? [];
    // response.list is index-aligned with tokenAddressList: keep only the
    // holdings whose server entry has a truthy .stock field, and mark the
    // selected row as Stock-owned before it reaches downstream swap handlers.
    return finallyTokenList.flatMap((token, i) =>
      list[i]?.stock
        ? [
            {
              ...token,
              isStock: true,
            },
          ]
        : [],
    );
  }, [finallyTokenList, settings.locale, stockOnly]);

  // The stock list is undefined until the first batch resolves; treat that as a
  // loading state (skeleton below) so the list never flashes "No results" while
  // holdings are still being classified. usePromiseResult keeps the prior result
  // across subsequent fetches and on failure, so a defined value is always the
  // last good one.
  const isStockListLoading = stockOnly && stockTokenList === undefined;
  const displayTokenList = stockOnly
    ? (stockTokenList ?? [])
    : finallyTokenList;
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(displayTokenList);

  if (
    (swapProSupportNetworksTokenListLoading && !shouldUseCachedTokenList) ||
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
