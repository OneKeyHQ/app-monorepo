import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  ListView,
  SectionList,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';

import useFormatDate from '../../hooks/useFormatDate';

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

const ItemSeparatorComponent = ({
  leadingItem,
}: {
  leadingItem: { section: IHistoryListSectionGroup; index: number };
}) => {
  const { section, index } = leadingItem;

  if (!section || index === section.data.length - 1) {
    return null;
  }

  return <Divider mx="$5" />;
};

const ListFooterComponent = () => <Stack h="$5" />;

function TxHistoryListView(props: IProps) {
  const { data, showHeader, onPressHistory, tableLayout, onContentSizeChange } =
    props;

  const currentDate = useRef('');

  const { formatDate } = useFormatDate();

  const renderHistoryListItem = useCallback(
    (tx: IAccountHistoryTx) => {
      const txDate = formatDate(
        new Date(tx.decodedTx.updatedAt ?? tx.decodedTx.createdAt ?? 0),
        {
          hideTheYear: true,
          hideTimeForever: true,
        },
      );

      if (txDate !== currentDate.current) {
        currentDate.current = txDate;
        return (
          <>
            <SectionList.SectionHeader title={txDate} />
            <TxHistoryListItem
              historyTx={tx}
              tableLayout={tableLayout}
              onPress={onPressHistory}
            />
          </>
        );
      }

      return (
        <>
          <TxHistoryListItem
            historyTx={tx}
            tableLayout={tableLayout}
            onPress={onPressHistory}
          />
          <Divider />
        </>
      );
    },
    [formatDate, onPressHistory, tableLayout],
  );

  return (
    <ListView
      h="100%"
      data={data}
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={60}
      ListFooterComponent={ListFooterComponent}
      renderItem={({ item }: { item: IAccountHistoryTx }) =>
        renderHistoryListItem(item)
      }
      {...(showHeader && {
        ListHeaderComponent: TxHistoryListHeader,
      })}
      {...(tableLayout && {
        ItemSeparatorComponent,
      })}
    />
  );
}

export { TxHistoryListView };
