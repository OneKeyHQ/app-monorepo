import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import {
  Dialog,
  Empty,
  Heading,
  type IPageNavigationProp,
  Page,
  SectionList,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import {
  useSwapActions,
  useSwapTxHistoryAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import { SwapProviderMirror } from '../SwapProviderMirror';

import type { RouteProp } from '@react-navigation/core';

interface ISectionData {
  title: string;
  data: ISwapTxHistory[];
}

interface ISwapHistoryListModalProps {
  storeName?: string;
}

const SwapHistoryListModal = ({ storeName }: ISwapHistoryListModalProps) => {
  const [swapTxHistoryList] = useSwapTxHistoryAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { formatDate } = useFormatDate();
  const { cleanSwapHistoryItems } = useSwapActions().current;
  const sectionData = useMemo(() => {
    const pendingData = swapTxHistoryList.filter(
      (item) => item.status === ESwapTxHistoryStatus.PENDING,
    );
    const otherData = swapTxHistoryList.filter(
      (item) => item.status !== ESwapTxHistoryStatus.PENDING,
    );
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
      result = [{ title: 'Pending', data: pendingData }, ...result];
    }
    return result;
  }, [formatDate, swapTxHistoryList]);

  const onDeleteHistory = useCallback(() => {
    // dialog
    if (!swapTxHistoryList?.length) return;
    Dialog.confirm({
      title: 'Are you sure to delete all history?',
      onConfirm: () => {
        void cleanSwapHistoryItems();
      },
      onConfirmText: 'Delete',
    });
  }, [cleanSwapHistoryItems, swapTxHistoryList?.length]);

  const deleteButton = useCallback(
    () => <HeaderIconButton onPress={onDeleteHistory} icon="DeleteOutline" />,
    [onDeleteHistory],
  );

  const renderItem = useCallback(
    ({ item }: { item: ISwapTxHistory }) => (
      <SwapTxHistoryListCell
        item={item}
        onClickCell={() => {
          navigation.push(EModalSwapRoutes.SwapHistoryDetail, {
            txHistory: item,
            storeName,
          });
        }}
      />
    ),
    [navigation, storeName],
  );
  return (
    <Page>
      <Page.Header headerRight={deleteButton} />
      <SectionList
        renderItem={renderItem}
        sections={sectionData}
        renderSectionHeader={({ section: { title } }) => (
          <XStack px="$5" py="$2" space="$3" alignItems="center">
            {title === 'Pending' ? (
              <Stack
                w="$2"
                h="$2"
                backgroundColor="$textCaution"
                borderRadius="$full"
              />
            ) : null}
            <Heading
              size="$headingSm"
              color={title === 'Pending' ? '$textCaution' : '$textSubdued'}
            >
              {title}
            </Heading>
          </XStack>
        )}
        estimatedItemSize="$10"
        ListEmptyComponent={<Empty icon="InboxOutline" title="No Results" />}
      />
    </Page>
  );
};

const SwapHistoryListModalWithProvider = () => {
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapTokenSelect>
    >();
  const { storeName } = route.params;
  return (
    <SwapProviderMirror storeName={storeName}>
      <SwapHistoryListModal />
    </SwapProviderMirror>
  );
};

export default SwapHistoryListModalWithProvider;
