import { useCallback, useMemo } from 'react';

import {
  Dialog,
  type IPageNavigationProp,
  IconButton,
  Page,
  SectionList,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import {
  useSwapActions,
  useSwapTxHistoryAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

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
    const groupByMonth = swapTxHistoryList.reduce<
      Record<string, ISwapTxHistory[]>
    >((acc, item) => {
      const date = new Date(item.date.created);
      const monthYear = formatDate(date, { hideTimeForever: true });

      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }

      acc[monthYear].push(item);

      return acc;
    }, {});

    const result: ISectionData[] = Object.entries(groupByMonth).map(
      ([title, data]) => ({
        title,
        data,
      }),
    );
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
          <Stack bg="$bg">
            <SizableText>{title}</SizableText>
          </Stack>
        )}
        estimatedItemSize="$10"
      />
    </Page>
  );
};

export default withSwapProvider(SwapHistoryListModal);
