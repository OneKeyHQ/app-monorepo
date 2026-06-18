import { useIntl } from 'react-intl';

import { Empty, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
  cachedTokenList,
  hasCachedTokenList,
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
  );
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(finallyTokenList);

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
      {finallyTokenList.length > 0 ? (
        finallyTokenList.map((item) => (
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
      {SwapProCurrentSymbolEnable || !onSearchClick ? undefined : (
        <SwapProPositionListFooter onSearchClick={onSearchClick} />
      )}
    </YStack>
  );
};

export default SwapProPositionsList;
