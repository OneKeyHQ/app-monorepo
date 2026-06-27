import { useIntl } from 'react-intl';

import { Empty, Skeleton, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';
import { type ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import SwapProPositionListHeader from '../../components/SwapProPositionListHeader';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';
import { useSwapProPositionsPnl } from '../../hooks/useSwapProPositionsPnl';

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
    let list: IMarketTokenListItem[] = [];
    try {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
          requestLocale: settings.locale,
          tokenAddressList: finallyTokenList.map((token) => ({
            contractAddress: token.contractAddress ?? '',
            chainId: token.networkId,
            isNative: !!token.isNative,
          })),
        });
      list = response.list ?? [];
    } catch {
      list = [];
    }
    // response.list is index-aligned with tokenAddressList: keep only the
    // holdings whose server entry has a truthy .stock field.
    return finallyTokenList.filter((_, i) => Boolean(list[i]?.stock));
  }, [finallyTokenList, settings.locale, stockOnly]);

  // While the batch is loading, stockTokenList is undefined; show empty list
  // briefly. usePromiseResult keeps the prior result on subsequent fetches so
  // there is no repeated flash after the first successful load.
  const displayTokenList = stockOnly
    ? (stockTokenList ?? [])
    : finallyTokenList;
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(displayTokenList);

  if (swapProSupportNetworksTokenListLoading && !shouldUseCachedTokenList) {
    return (
      <YStack gap="$2" p="$2">
        <XStack>
          <Skeleton w="$20" h="$8" radius="round" />
        </XStack>
        <XStack justifyContent="space-between">
          <Skeleton w="$20" h="$5" radius="round" />
          <Skeleton w="$10" h="$5" radius="round" />
        </XStack>
      </YStack>
    );
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
