import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Dialog,
  Empty,
  Heading,
  type IPageNavigationProp,
  Icon,
  Page,
  SectionList,
  Select,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import {
  EProtocolOfExchange,
  ESwapCleanHistorySource,
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import { SwapProviderMirror } from '../SwapProviderMirror';

import LimitOrderListModalWithAllProvider from './LimitOrderListModal';

import type { RouteProp } from '@react-navigation/core';

interface ISectionData {
  title: string;
  status?: ESwapTxHistoryStatus;
  data: ISwapTxHistory[];
}

const SwapHistoryListModal = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { type } = route.params;
  const [historyType, setHistoryType] = useState<EProtocolOfExchange>(
    type ?? EProtocolOfExchange.SWAP,
  );
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
      onConfirm: async () => {
        await backgroundApiProxy.serviceSwap.cleanSwapHistoryItems();
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.settings_clear_successful,
          }),
        });
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
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
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.LIST,
        });
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
            txHistoryOrderId: item.swapInfo.orderId,
            txHistoryList: [...(swapTxHistoryList ?? [])],
          });
        }}
      />
    ),
    [navigation, swapTxHistoryList],
  );

  const headerSelectType = useMemo(() => {
    const title =
      historyType === EProtocolOfExchange.LIMIT
        ? intl.formatMessage({
            id: ETranslations.swap_page_limit_dialog_title,
          })
        : intl.formatMessage({
            id: ETranslations.swap_history_title,
          });
    return (
      <Select
        title={title}
        items={[
          {
            label: intl.formatMessage({
              id: ETranslations.swap_history_title,
            }),
            value: EProtocolOfExchange.SWAP,
          },
          {
            label: intl.formatMessage({
              id: ETranslations.swap_page_limit_dialog_title,
            }),
            value: EProtocolOfExchange.LIMIT,
          },
        ]}
        onChange={(value) => {
          setHistoryType(value as EProtocolOfExchange);
        }}
        value={historyType}
        renderTrigger={(props) => (
          <XStack {...props} alignItems="center" gap="$1" cursor="pointer">
            <SizableText size="$headingLg">{title}</SizableText>
            <Icon name="ChevronDownSmallSolid" size="$5" />
          </XStack>
        )}
      />
    );
  }, [historyType, intl]);
  const { gtMd } = useMedia();
  return (
    <Page>
      <Page.Header
        headerRight={
          historyType === EProtocolOfExchange.LIMIT ? undefined : deleteButton
        }
        headerTitleAlign={gtMd ? 'left' : 'center'}
        headerTitle={() => headerSelectType}
      />
      {historyType !== EProtocolOfExchange.LIMIT ? (
        <>
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
        </>
      ) : (
        <LimitOrderListModalWithAllProvider storeName={storeName} />
      )}
    </Page>
  );
};

const SwapHistoryListModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryList>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapHistoryListModal storeName={storeName} />
    </SwapProviderMirror>
  );
};

export default SwapHistoryListModalWithProvider;
