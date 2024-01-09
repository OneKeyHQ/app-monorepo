import { useIntl } from 'react-intl';

import { Divider, Empty, SectionList, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IHistoryListSectionGroup } from '@onekeyhq/shared/types/history';

import { HistoryListItem } from './HistoryListItem';
import { TxHistoryListHeader } from './TxHistoryListHeader';

import type { IHistoryListItemProps } from './HistoryListItem';

type IProps = {
  data: IHistoryListSectionGroup[];
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  tableLayout?: boolean;
  showHeader?: boolean;
  onItemPress?: () => void; // test only, should remove in the future
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
  const { data, showHeader, onItemPress, tableLayout, onContentSizeChange } =
    props;

  return (
    <SectionList
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={data}
      renderSectionHeader={({ section: { title } }) => (
        <SectionList.SectionHeader title={title} />
      )}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={60}
      renderItem={({ item }: { item: IHistoryListItemProps }) => (
        <HistoryListItem
          title={item.title}
          description={item.description}
          avatar={item.avatar}
          change={item.change}
          changeDescription={item.changeDescription}
          pending={item.pending}
          tableLayout={tableLayout}
          onPress={onItemPress}
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
