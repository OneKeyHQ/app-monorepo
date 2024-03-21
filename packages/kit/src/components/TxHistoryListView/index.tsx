import { useCallback, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { ListView, SectionList, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { getFilteredHistoryBySearchKey } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { EmptySearch } from '../Empty';
import { EmptyHistory } from '../Empty/EmptyHistory';
import { HistoryLoadingView } from '../Loading';

import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';

type IProps = {
  data: IAccountHistoryTx[];
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  tableLayout?: boolean;
  ListHeaderComponent?: ReactElement;
  showHeader?: boolean;
  showIcon?: boolean;
  onPressHistory?: (history: IAccountHistoryTx) => void;
  initialized?: boolean;
};

const ListFooterComponent = () => <Stack h="$5" />;

function TxHistoryListView(props: IProps) {
  const intl = useIntl();
  const {
    data,
    isLoading,
    showHeader,
    ListHeaderComponent,
    showIcon,
    onPressHistory,
    tableLayout,
    onContentSizeChange,
    initialized,
  } = props;

  const currentDate = useRef('');
  const [searchKey, setSearchKey] = useState('');

  const filteredHistory = getFilteredHistoryBySearchKey({
    history: data,
    searchKey,
  });

  const renderListItem = useCallback(
    (tx: IAccountHistoryTx, index: number) => {
      const nextTx = data[index + 1];
      if (tx.decodedTx.status === EDecodedTxStatus.Pending) {
        if (index === 0) {
          currentDate.current = '';
        }
        return (
          <>
            {index === 0 ? (
              <SectionList.SectionHeader
                title={intl.formatMessage({ id: 'transaction__pending' })}
              />
            ) : null}
            <TxHistoryListItem
              key={index}
              index={index}
              historyTx={tx}
              showIcon={showIcon}
              onPress={onPressHistory}
              tableLayout={tableLayout}
            />
            {nextTx?.decodedTx.status !== EDecodedTxStatus.Pending ? (
              <Stack mb="$5" />
            ) : null}
          </>
        );
      }

      let nextDate = '';
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

      if (index === 0 || !currentDate.current || date !== currentDate.current) {
        currentDate.current = date;
        return (
          <>
            <SectionList.SectionHeader title={date} />
            <TxHistoryListItem
              key={index}
              index={index}
              historyTx={tx}
              showIcon={showIcon}
              onPress={onPressHistory}
              tableLayout={tableLayout}
            />
            {nextDate !== date ? <Stack mb="$5" /> : null}
          </>
        );
      }
      return (
        <>
          <TxHistoryListItem
            key={index}
            index={index}
            historyTx={tx}
            showIcon={showIcon}
            onPress={onPressHistory}
            tableLayout={tableLayout}
          />
          {nextDate !== date ? <Stack mb="$5" /> : null}
        </>
      );
    },
    [data, intl, onPressHistory, showIcon, tableLayout],
  );

  if (!initialized && isLoading) {
    return (
      <Stack py="$3">
        {ListHeaderComponent}
        <HistoryLoadingView
          tableLayout={tableLayout}
          onContentSizeChange={onContentSizeChange}
        />
      </Stack>
    );
  }

  return (
    <ListView
      py="$3"
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      disableScrollViewPanResponder
      onContentSizeChange={onContentSizeChange}
      data={filteredHistory}
      ListEmptyComponent={searchKey ? EmptySearch : EmptyHistory}
      estimatedItemSize={48}
      renderItem={({
        item,
        index,
      }: {
        item: IAccountHistoryTx;
        index: number;
      }) => renderListItem(item, index)}
      ListFooterComponent={ListFooterComponent}
      ListHeaderComponent={ListHeaderComponent}
      {...(showHeader &&
        data?.length > 0 && {
          ListHeaderComponent: (
            <TxHistoryListHeader
              searchKey={searchKey}
              filteredHistory={filteredHistory}
              history={data}
              setSearchKey={setSearchKey}
            />
          ),
        })}
    />
  );
}

export { TxHistoryListView };
