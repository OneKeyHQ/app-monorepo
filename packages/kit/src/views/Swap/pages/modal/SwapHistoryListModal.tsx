import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Empty,
  Heading,
  type IPageNavigationProp,
  Page,
  SectionList,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';

interface ISectionData {
  title: string;
  status?: ESwapTxHistoryStatus;
  data: ISwapTxHistory[];
}

const SwapHistoryListModal = () => {
  const intl = useIntl();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
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

  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { formatDate } = useFormatDate();
  const sectionData = useMemo(() => {
    const pendingData =
      swapTxHistoryList?.filter(
        (item) =>
          item.status === ESwapTxHistoryStatus.PENDING ||
          item.status === ESwapTxHistoryStatus.CANCELING,
      ) ?? [];
    const otherData =
      swapTxHistoryList?.filter(
        (item) =>
          item.status !== ESwapTxHistoryStatus.PENDING &&
          item.status !== ESwapTxHistoryStatus.CANCELING,
      ) ?? [];
    const groupByDay = otherData.reduce<Record<string, ISwapTxHistory[]>>(
      (acc, item) => {
        const date = new Date(item.date.created);
        const monthDay = formatDate(date, {
          hideTimeForever: true,
          hideYear: true,
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
  }, [formatDate, intl, swapTxHistoryList]);

  const onDeleteHistory = useCallback(() => {
    // dialog
    if (!swapTxHistoryList?.length) return;
    Dialog.show({
      icon: 'BroomOutline',
      // description: intl.formatMessage({
      //   id: ETranslations.swap_history_all_history_content,
      // }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_all_history_title,
      }),
      onConfirm: () => {
        void backgroundApiProxy.serviceSwap.cleanSwapHistoryItems();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapTxHistoryList?.length]);

  const onDeletePendingHistory = useCallback(() => {
    // dialog
    if (
      !swapTxHistoryList?.some(
        (item) => item.status === ESwapTxHistoryStatus.PENDING,
      )
    )
      return;
    Dialog.show({
      icon: 'BroomOutline',
      description: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_content,
      }),
      title: intl.formatMessage({
        id: ETranslations.swap_history_pending_history_title,
      }),
      onConfirm: () => {
        void backgroundApiProxy.serviceSwap.cleanSwapHistoryItems([
          ESwapTxHistoryStatus.PENDING,
        ]);
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, swapTxHistoryList]);

  const deleteButton = useCallback(
    () => (
      <ActionList
        title={intl.formatMessage({
          id: ETranslations.global_clear,
        })}
        items={[
          {
            label: intl.formatMessage({
              id: ETranslations.swap_history_pending_history,
            }),
            onPress: onDeletePendingHistory,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.swap_history_all_history,
            }),
            onPress: onDeleteHistory,
          },
        ]}
        renderTrigger={
          <Button variant="tertiary">
            {intl.formatMessage({ id: ETranslations.global_clear })}
          </Button>
        }
      />
    ),
    [intl, onDeleteHistory, onDeletePendingHistory],
  );

  const renderItem = useCallback(
    ({ item }: { item: ISwapTxHistory }) => (
      <SwapTxHistoryListCell
        item={item}
        onClickCell={() => {
          navigation.push(EModalSwapRoutes.SwapHistoryDetail, {
            txHistory: item,
          });
        }}
      />
    ),
    [navigation],
  );
  return (
    <Page>
      <Page.Header headerRight={deleteButton} />
      {isLoading ? (
        Array.from({ length: 5 }).map((_, index) => (
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
        ))
      ) : (
        <SectionList
          renderItem={renderItem}
          sections={sectionData}
          py="$1"
          renderSectionHeader={({ section: { title, status } }) => (
            <XStack px="$5" py="$2" gap="$3" alignItems="center">
              {status === ESwapTxHistoryStatus.PENDING ? (
                <Stack
                  w="$2"
                  h="$2"
                  backgroundColor="$textCaution"
                  borderRadius="$full"
                />
              ) : null}
              <Heading
                size="$headingSm"
                color={
                  status === ESwapTxHistoryStatus.PENDING
                    ? '$textCaution'
                    : '$textSubdued'
                }
              >
                {title}
              </Heading>
            </XStack>
          )}
          estimatedItemSize="$10"
          ListEmptyComponent={
            <Empty
              icon="InboxOutline"
              title={intl.formatMessage({
                id: ETranslations.global_no_results,
              })}
            />
          }
        />
      )}
    </Page>
  );
};

export default SwapHistoryListModal;
