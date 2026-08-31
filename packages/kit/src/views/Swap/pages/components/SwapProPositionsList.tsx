import { useIntl } from 'react-intl';

import { Empty, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
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
  positionTokenList: ISwapToken[];
  positionLoadError: boolean;
  positionLoading: boolean;
  onRetry: () => void;
  // Stock context: only show stock tokens, and hide the "find your token" footer.
  stockOnly?: boolean;
  hideSearch?: boolean;
}

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
  positionTokenList,
  positionLoadError,
  positionLoading,
  onRetry,
  stockOnly,
  hideSearch,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const { finallyTokenList } = useSwapProPositionsListFilter(
    filterToken,
    positionTokenList,
    stockOnly,
  );
  const displayTokenList = finallyTokenList;
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const pnlMap = useSwapProPositionsPnl(displayTokenList);

  if (positionLoading && displayTokenList.length === 0) {
    return <SwapProPositionsListSkeleton rowCount={stockOnly ? 3 : 2} />;
  }
  if (positionLoadError && displayTokenList.length === 0) {
    return (
      <YStack>
        <SwapProPositionListHeader />
        <Empty
          illustration="GlobeError"
          title={intl.formatMessage({
            id: ETranslations.global_network_error,
          })}
          buttonProps={{
            children: intl.formatMessage({
              id: ETranslations.global_retry,
            }),
            onPress: onRetry,
          }}
        />
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
