import { useIntl } from 'react-intl';

import { Empty, SectionList, Stack } from '@onekeyhq/components';
import type { IHistoryListSectionGroup } from '@onekeyhq/shared/types/history';

import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';
import { TxHistorySectionHeader } from './TxHistorySectionHeader';

type IProps = {
  data: IHistoryListSectionGroup[];
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
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

function TxHistoryListView(props: IProps) {
  const { data, onContentSizeChange } = props;
  return (
    <SectionList
      h="100%"
      ListHeaderComponentStyle={{
        mt: '$4',
        mb: '$2',
      }}
      scrollEnabled={false}
      onContentSizeChange={onContentSizeChange}
      sections={data}
      renderSectionHeader={({ section }) => (
        <TxHistorySectionHeader {...section} />
      )}
      ListHeaderComponent={TxHistoryListHeader}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize="$10"
      renderItem={({ item }) => <TxHistoryListItem history={item} />}
    />
  );
}

export { TxHistoryListView };
