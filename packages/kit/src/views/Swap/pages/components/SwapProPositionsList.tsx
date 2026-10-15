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

function SwapProPositionItemSkeleton({
  stockLayout = false,
}: {
  stockLayout?: boolean;
}) {
  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      minHeight={stockLayout ? 56 : '$11'}
      h={stockLayout ? 56 : undefined}
      gap="$3"
      py={stockLayout ? '$0' : '$2'}
      px="$2"
      mx="$-2"
      borderRadius="$3"
    >
      <XStack
        alignItems="center"
        gap={stockLayout ? '$3' : '$2'}
        flexGrow={1}
        flexBasis={0}
      >
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

function SwapProPositionsListSkeleton({
  rowCount,
  stockLayout,
}: {
  rowCount: number;
  stockLayout?: boolean;
}) {
  return (
    <YStack gap={stockLayout ? '$3.5' : undefined}>
      <SwapProPositionListHeader stockLayout={stockLayout} />
      <YStack>
        {Array.from({ length: rowCount }).map((_, index) => (
          <SwapProPositionItemSkeleton
            key={`position-skeleton-${index}`}
            stockLayout={stockLayout}
          />
        ))}
      </YStack>
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
  stockLayout?: boolean;
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
  stockLayout = false,
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
    return (
      <SwapProPositionsListSkeleton
        rowCount={stockOnly ? 3 : 2}
        stockLayout={stockLayout}
      />
    );
  }
  if (positionLoadError && displayTokenList.length === 0) {
    return (
      <YStack gap={stockLayout ? '$3.5' : undefined}>
        <SwapProPositionListHeader stockLayout={stockLayout} />
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
    <YStack gap={stockLayout ? '$3.5' : undefined}>
      <SwapProPositionListHeader stockLayout={stockLayout} />
      <YStack>
        {displayTokenList.length > 0 ? (
          displayTokenList.map((item) => (
            <SwapProPositionItem
              key={`${item.networkId}-${item.contractAddress}`}
              token={item}
              onPress={onTokenPress}
              pnl={pnlMap.get(`${item.networkId}-${item.contractAddress}`)}
              stockLayout={stockLayout}
            />
          ))
        ) : (
          <Empty
            icon="SearchOutline"
            title={intl.formatMessage({ id: ETranslations.global_no_results })}
          />
        )}
      </YStack>
      {SwapProCurrentSymbolEnable ||
      !onSearchClick ||
      hideSearch ? undefined : (
        <SwapProPositionListFooter onSearchClick={onSearchClick} />
      )}
    </YStack>
  );
};

export default SwapProPositionsList;
