import { useCallback, useMemo } from 'react';

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
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NotificationEnableAlert } from '@onekeyhq/kit/src/components/NotificationEnableAlert';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useInAppNotificationAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';

interface ISectionData {
  title: string;
  status?: ESwapTxHistoryStatus;
  data: ISwapTxHistory[];
}

interface ISwapMarketHistoryListProps {
  showType?: 'swap' | 'bridge';
  isPushModal?: boolean;
  filterToken?: ISwapToken;
}

const SwapMarketHistoryList = ({
  showType,
  filterToken,
  isPushModal,
}: ISwapMarketHistoryListProps) => {
  const intl = useIntl();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const [{ swapHistoryAlertDismissed }] = useNotificationsAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { result: swapTxHistoryList, isLoading } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapHistoryPendingList],
    { watchLoading: true },
  );
  const sectionData = useMemo(() => {
    let filterData = [...(swapTxHistoryList ?? [])];
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
          equalTokenNoCaseSensitive({
            token1: item.baseInfo?.fromToken,
            token2: filterToken,
          }) ||
          equalTokenNoCaseSensitive({
            token1: item.baseInfo?.toToken,
            token2: filterToken,
          }),
      );
    }
    const pendingData =
      filterData?.filter(
        (item) =>
          item.status === ESwapTxHistoryStatus.PENDING ||
          item.status === ESwapTxHistoryStatus.CANCELING,
      ) ?? [];
    const otherData =
      filterData?.filter(
        (item) =>
          item.status !== ESwapTxHistoryStatus.PENDING &&
          item.status !== ESwapTxHistoryStatus.CANCELING,
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
  }, [filterToken, intl, showType, swapTxHistoryList]);

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
  if (isLoading) {
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
      renderSectionHeader={({ section: { title, status } }) => (
        <XStack px="$6" py="$2" gap="$3" alignItems="center">
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
      )}
      estimatedItemSize="$10"
      ListHeaderComponent={
        sectionData.length > 0 && !showType ? (
          <NotificationEnableAlert scene="swapHistory" />
        ) : null
      }
      ListEmptyComponent={
        <Empty
          icon="InboxOutline"
          title={intl.formatMessage({
            id: ETranslations.global_no_results,
          })}
        />
      }
    />
  );
};

export default SwapMarketHistoryList;
