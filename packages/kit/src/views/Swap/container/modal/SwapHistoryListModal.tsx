import { useCallback, useMemo } from 'react';

import {
  type IPageNavigationProp,
  Page,
  SectionList,
  Stack,
  Text,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import useFormatDate from '../../../../hooks/useFormatDate';
import { useSwapTxHistoryAtom } from '../../../../states/jotai/contexts/swap';
import SwapTxHistoryListCell from '../../components/SwapTxHistoryListCell';
import {
  EModalSwapRoutes,
  type IModalSwapParamList,
} from '../../router/Routers';
import { withSwapProvider } from '../WithSwapProvider';

import type { ISwapTxHistory } from '../../types';

interface ISectionData {
  title: string;
  data: ISwapTxHistory[];
}

const SwapHistoryListModal = () => {
  const [swapTxHistoryList] = useSwapTxHistoryAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const { formatDate } = useFormatDate();
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
      <SectionList
        renderItem={renderItem}
        sections={sectionData}
        renderSectionHeader={({ section: { title } }) => (
          <Stack bg="$bg">
            <Text variant="$headingXs">{title}</Text>
          </Stack>
        )}
        estimatedItemSize="$10"
      />
    </Page>
  );
};

export default withSwapProvider(SwapHistoryListModal);
