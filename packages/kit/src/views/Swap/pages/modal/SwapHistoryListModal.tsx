import { useCallback, useMemo } from 'react';

import {
  Dialog,
  type IPageNavigationProp,
  IconButton,
  Page,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import {
  useSwapActions,
  useSwapTxHistoryAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import { EModalSwapRoutes, type IModalSwapParamList } from '../../router/types';
import { withSwapProvider } from '../WithSwapProvider';

interface ISectionData {
  title: string;
  data: ISwapTxHistory[];
}

const SwapHistoryListModal = () => {
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
    Dialog.confirm({
      title: 'Are you sure to delete all history?',
      onConfirm: () => {
        void cleanSwapHistoryItems();
      },
      onConfirmText: 'Delete',
    });
  }, [cleanSwapHistoryItems]);

  const deleteButton = useCallback(
    () => <IconButton onPress={onDeleteHistory} icon="DeleteOutline" />,
    [onDeleteHistory],
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
      <SectionList
        renderItem={renderItem}
        sections={sectionData}
        renderSectionHeader={({ section: { title } }) => (
          <XStack py="$2" space="$4">
            {title === 'Pending' ? (
              <Stack w="$2" h="$2" backgroundColor="$textCaution" />
            ) : null}
            <SizableText color="$textCaution">{title}</SizableText>
          </XStack>
        )}
        estimatedItemSize="$10"
      />
    </Page>
  );
};

export default withSwapProvider(SwapHistoryListModal);
