import { useCallback, useMemo } from 'react';

import {
  type IPageNavigationProp,
  ListItem,
  Page,
  SectionList,
  Stack,
  Text,
} from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../../../hooks/useLocaleVariant';
import { useSwapTxHistoryAtom } from '../../../../states/jotai/contexts/swap';
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
  const locale = useLocaleVariant();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const sectionData = useMemo(() => {
    const groupByMonth = swapTxHistoryList.reduce<
      Record<string, ISwapTxHistory[]>
    >((acc, item) => {
      const date = new Date(item.date.created);
      const monthYear = date.toLocaleString(locale, {
        month: 'long',
        year: 'numeric',
      });

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
  }, [locale, swapTxHistoryList]);

  const renderItem = useCallback(
    ({ item }: { item: ISwapTxHistory }) => (
      <ListItem
        onPress={() => {
          navigation.push(EModalSwapRoutes.SwapHistoryDetail, {
            txHistory: item,
          });
        }}
        title={item.txInfo.txId}
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
