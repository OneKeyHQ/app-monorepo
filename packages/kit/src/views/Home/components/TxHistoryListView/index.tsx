import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Avatar,
  Divider,
  Empty,
  Icon,
  Image,
  ListItem,
  SectionList,
  SizableText,
  Stack,
  XStack,
  ZStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';

import { HistoryListItem } from './HistoryListItem';
import { TxHistoryListHeader } from './TxHistoryListHeader';
import { TxHistoryListItem } from './TxHistoryListItem';
import { TxHistorySectionHeader } from './TxHistorySectionHeader';

import type { IHistoryListItemProps } from './HistoryListItem';

type IProps = {
  data: IHistoryListSectionGroup[];
  accountAddress: string;
  isLoading?: boolean;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  tableLayout?: boolean;
  showHeader?: boolean;
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

const ItemSeparatorComponent = ({ leadingItem }) => {
  const { section, index } = leadingItem;

  if (!section || index === section.data.length - 1) {
    return null;
  }

  return <Divider mx="$5" />;
};

const ListFooterComponent = () => <Stack h="$5" />;

function TxHistoryListView(props: IProps) {
  const { data, showHeader, accountAddress, tableLayout, onContentSizeChange } =
    props;

  return (
    <SectionList
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={data}
      // renderSectionHeader={({ section }) => (
      //   <TxHistorySectionHeader {...section} />
      // )}
      renderSectionHeader={({ section: { title } }) => (
        <SectionList.SectionHeader title={title} />
      )}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={60}
      // renderItem={({ item }: { item: IAccountHistoryTx }) => (
      //   <TxHistoryListItem
      //     key={item.id}
      //     historyTx={item}
      //     accountAddress={accountAddress}
      //   />
      // )}
      renderItem={({ item }: { item: IHistoryListItemProps }) => (
        <HistoryListItem
          title={item.title}
          description={item.description}
          avatar={item.avatar}
          change={item.change}
          changeDescription={item.changeDescription}
          tableLayout={tableLayout}
          onPress={() => console.log('clicked')}
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
