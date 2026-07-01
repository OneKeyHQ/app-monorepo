import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Empty,
  Heading,
  SectionList,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NotificationEnableAlert } from '@onekeyhq/kit/src/components/NotificationEnableAlert';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import { useSwapMarketHistoryList } from '../../hooks/useSwapMarketHistoryList';
import {
  SWAP_HISTORY_PENDING_STATUSES,
  filterSwapMarketHistoryItems,
  isStockSwapHistoryItem,
} from '../../utils/swapMarketHistory';

interface ISectionData {
  title: string;
  status?: ESwapTxHistoryStatus;
  data: ISwapTxHistory[];
}

interface ISwapMarketHistoryListProps {
  showType?: 'swap' | 'bridge';
  isPushModal?: boolean;
  filterToken?: ISwapToken[];
  protocol?: EProtocolOfExchange;
  // Rendered on the right of the FIRST section header (the latest date / pending
  // row), so a list-level action like Clear shares the date's row instead of
  // taking a dedicated line above the list.
  firstSectionRightAction?: ReactNode;
}

const SwapMarketHistoryList = ({
  showType,
  filterToken,
  isPushModal,
  protocol,
  firstSectionRightAction,
}: ISwapMarketHistoryListProps) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [{ swapHistoryAlertDismissed }] = useNotificationsAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  // The Stock tab pulls from the whole market (SWAP) bucket and then keeps only
  // stock items, because stock-pending updates may not carry protocol === STOCK.
  // Every other protocol filters as-is. Compute it once so the refresh key and
  // the section filter below stay in sync.
  const effectiveProtocol =
    protocol === EProtocolOfExchange.STOCK
      ? EProtocolOfExchange.SWAP
      : protocol;
  const { swapTxHistoryList, isLoading } =
    useSwapMarketHistoryList(effectiveProtocol);
  const sectionData = useMemo(() => {
    let filterData = filterSwapMarketHistoryItems({
      items: swapTxHistoryList ?? [],
      protocol: effectiveProtocol,
    });
    // Stock tab keeps only stock; everything else (the Swap & Bridge tab and
    // callers with no explicit protocol, e.g. Swap Pro) excludes stock so it
    // shows swap/bridge trades only. Stock is detected via the reliable
    // token-level isStock flag.
    if (protocol === EProtocolOfExchange.STOCK) {
      filterData = filterData.filter(isStockSwapHistoryItem);
    } else {
      filterData = filterData.filter((item) => !isStockSwapHistoryItem(item));
    }
    if (showType === 'bridge') {
      filterData = filterData.filter(
        (item) =>
          item.baseInfo?.fromNetwork?.networkId !==
          item.baseInfo?.toNetwork?.networkId,
      );
    } else if (showType === 'swap') {
      filterData = filterData.filter(
        (item) =>
          item.baseInfo?.fromNetwork?.networkId ===
          item.baseInfo?.toNetwork?.networkId,
      );
    }
    if (filterToken) {
      filterData = filterData.filter(
        (item) =>
          filterToken.some((t) =>
            equalTokenNoCaseSensitive({
              token1: t,
              token2: item.baseInfo?.fromToken,
            }),
          ) ||
          filterToken.some((t) =>
            equalTokenNoCaseSensitive({
              token1: t,
              token2: item.baseInfo?.toToken,
            }),
          ),
      );
    }
    const pendingData =
      filterData?.filter((item) =>
        SWAP_HISTORY_PENDING_STATUSES.includes(item.status),
      ) ?? [];
    const otherData =
      filterData?.filter(
        (item) => !SWAP_HISTORY_PENDING_STATUSES.includes(item.status),
      ) ?? [];
    const groupByDay = otherData.reduce<Record<string, ISwapTxHistory[]>>(
      (acc, item) => {
        const date = new Date(item.date.created);
        const monthDay = formatDate(date, {
          formatTemplate: 'yyyy-LL-dd',
        });

        if (!acc[monthDay]) {
          acc[monthDay] = [];
        }

        acc[monthDay].push(item);

        return acc;
      },
      {},
    );

    let result: ISectionData[] = Object.entries(groupByDay).map(
      ([title, data]) => ({
        title,
        data,
      }),
    );
    if (pendingData.length > 0) {
      result = [
        {
          title: intl.formatMessage({
            id: ETranslations.swap_history_status_pending,
          }),
          status: ESwapTxHistoryStatus.PENDING,
          data: pendingData,
        },
        ...result,
      ];
    }
    return result;
  }, [
    effectiveProtocol,
    filterToken,
    intl,
    protocol,
    showType,
    swapTxHistoryList,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: ISwapTxHistory }) => (
      <SwapTxHistoryListCell
        item={item}
        onClickCell={() => {
          if (isPushModal) {
            navigation.pushModal(EModalRoutes.SwapModal, {
              screen: EModalSwapRoutes.SwapHistoryDetail,
              params: {
                txHistoryOrderId: item.swapInfo.orderId,
                txHistoryList: [...(swapTxHistoryList ?? [])],
              },
            });
          } else {
            navigation.push(EModalSwapRoutes.SwapHistoryDetail, {
              txHistoryOrderId: item.swapInfo.orderId,
              txHistoryList: [...(swapTxHistoryList ?? [])],
            });
          }
        }}
      />
    ),
    [navigation, isPushModal, swapTxHistoryList],
  );
  if (isLoading && !swapTxHistoryList?.length) {
    return Array.from({ length: 5 }).map((_, index) => (
      <ListItem key={index}>
        <Skeleton w="$10" h="$10" radius="round" />
        <YStack>
          <YStack py="$1">
            <Skeleton h="$4" w="$32" />
          </YStack>
          <YStack py="$1">
            <Skeleton h="$3" w="$24" />
          </YStack>
        </YStack>
      </ListItem>
    ));
  }
  return (
    <SectionList
      key={`swap-history-${swapHistoryAlertDismissed ? 'dismissed' : 'shown'}`}
      renderItem={renderItem}
      sections={sectionData}
      py="$2"
      renderSectionHeader={({ section }) => {
        const { title, status } = section;
        // Section titles are unique (per-day dates + a single "Pending"), so
        // match by title rather than object identity, which can change when
        // sectionData is rebuilt.
        const isFirstSection = sectionData[0]?.title === title;
        return (
          <XStack
            px="$6"
            py="$2"
            gap="$3"
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
              {status === ESwapTxHistoryStatus.PENDING ? (
                <Stack
                  w="$2"
                  h="$2"
                  backgroundColor="$textInfo"
                  borderRadius="$full"
                />
              ) : null}
              <Heading
                size="$headingXs"
                color={
                  status === ESwapTxHistoryStatus.PENDING
                    ? '$textInfo'
                    : '$textSubdued'
                }
              >
                {title}
              </Heading>
            </XStack>
            {isFirstSection && firstSectionRightAction
              ? firstSectionRightAction
              : null}
          </XStack>
        );
      }}
      estimatedItemSize="$10"
      ListHeaderComponent={
        sectionData.length > 0 && !showType ? (
          <NotificationEnableAlert scene="swapHistory" />
        ) : null
      }
      ListEmptyComponent={
        <Empty
          illustration="Orders"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      }
      ListFooterComponent={<Stack h={bottom || '$2'} />}
    />
  );
};

export default SwapMarketHistoryList;
