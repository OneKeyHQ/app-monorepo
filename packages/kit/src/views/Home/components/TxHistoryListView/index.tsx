import { useIntl } from 'react-intl';

import { Empty, SectionList, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHistoryListSectionGroup } from '@onekeyhq/shared/types/history';

import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';
import { TxHistorySectionHeader } from './TxHistorySectionHeader';

type IProps = {
  data: IHistoryListSectionGroup[];
  accountAddress: string;
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
  const { data, accountAddress, onContentSizeChange } = props;
  return (
    <SectionList
      h="100%"
      ListHeaderComponentStyle={{
        mt: '$4',
        mb: '$2',
      }}
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={data}
      renderSectionHeader={({ section }) => (
        <TxHistorySectionHeader {...section} />
      )}
      ListHeaderComponent={TxHistoryListHeader}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize="$10"
      renderItem={({ item }) => (
        <TxHistoryListItem historyTx={item} accountAddress={accountAddress} />
      )}
    />
  );
}

export { TxHistoryListView };
