import { useIntl } from 'react-intl';

import { Empty, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import SwapProPositionListHeader from '../../components/SwapProPositionListHeader';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
  onSearchClick?: () => void;
  filterToken?: ISwapToken[];
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const { finallyTokenList } = useSwapProPositionsListFilter(filterToken);
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();

  if (swapProSupportNetworksTokenListLoading) {
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
            key={item.contractAddress}
            token={item}
            onPress={onTokenPress}
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
