import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  ListView,
  SectionList,
  Stack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';

type IProps = {
  data: IAccountHistoryTx[];
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  tableLayout?: boolean;
  showHeader?: boolean;
  onPressHistory?: (history: IAccountHistoryTx) => void;
};

function TxHistoryListEmpty() {
  const intl = useIntl();

  return (
    <Stack height="100%" alignItems="center" justifyContent="center">
      <Empty
        title={intl.formatMessage({ id: 'transaction__history_empty_title' })}
        description={intl.formatMessage({
          id: 'transaction__history_empty_desc',
        })}
      />
    </Stack>
  );
}

const ListFooterComponent = () => <Stack h="$5" />;

function TxHistoryListView(props: IProps) {
  const { data, showHeader, onPressHistory, tableLayout, onContentSizeChange } =
    props;

  const currentDate = useRef('');

  const renderListItem = useCallback(
    (tx: IAccountHistoryTx, index: number) => {
      let nextDate = '';
      const nextTx = data[index + 1];
      const date = formatDate(
        new Date(tx.decodedTx.updatedAt ?? tx.decodedTx.createdAt ?? 0),
        {
          hideTheYear: true,
          hideTimeForever: true,
        },
      );
      if (nextTx) {
        nextDate = formatDate(
          new Date(
            nextTx.decodedTx.updatedAt ?? nextTx.decodedTx.createdAt ?? 0,
          ),
          {
            hideTheYear: true,
            hideTimeForever: true,
          },
        );
      }

      if (date !== currentDate.current) {
        currentDate.current = date;
        return (
          <>
            <SectionList.SectionHeader title={date} />
            <TxHistoryListItem
              historyTx={tx}
              onPress={onPressHistory}
              tableLayout={tableLayout}
            />
            {nextDate === date && tableLayout && <Divider mx="$5" />}
            {nextDate !== date && <Stack mb="$5" />}
          </>
        );
      }
      return (
        <>
          <TxHistoryListItem
            historyTx={tx}
            onPress={onPressHistory}
            tableLayout={tableLayout}
          />
          {nextDate === date && tableLayout && <Divider mx="$5" />}
          {nextDate !== date && <Stack mb="$5" />}
        </>
      );
    },
    [data, onPressHistory, tableLayout],
  );

  return (
    <ListView
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      data={data}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={48}
      renderItem={({
        item,
        index,
      }: {
        item: IAccountHistoryTx;
        index: number;
      }) => renderListItem(item, index)}
      ListFooterComponent={ListFooterComponent}
      {...(showHeader && {
        ListHeaderComponent: TxHistoryListHeader,
      })}
    />
  );
}

export { TxHistoryListView };
