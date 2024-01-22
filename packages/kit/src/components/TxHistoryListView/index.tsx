import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Divider, Empty, SectionList, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { convertToHistorySectionGroups } from '@onekeyhq/shared/src/utils/historyUtils';
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

  const { formatDate } = useFormatDate();

  const sections = useMemo(
    () =>
      convertToHistorySectionGroups({
        items: data,
        formatDate: (date: number) =>
          formatDate(new Date(date), {
            hideTheYear: true,
            hideTimeForever: true,
          }),
      }),
    [data, formatDate],
  );

  return (
    <SectionList
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={sections}
      renderSectionHeader={({ section: { title } }) => (
        <SectionList.SectionHeader title={title} />
      )}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={48}
      renderItem={({ item }: { item: IAccountHistoryTx }) => (
        <TxHistoryListItem
          historyTx={item}
          onPress={onPressHistory}
          tableLayout={tableLayout}
        />
      )}
      ListFooterComponent={ListFooterComponent}
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
