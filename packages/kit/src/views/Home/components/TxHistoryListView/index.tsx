import { useIntl } from 'react-intl';

import {
  Empty,
  ListItem,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAccountHistoryTx,
  IHistoryListSectionGroup,
} from '@onekeyhq/shared/types/history';

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

const fakeData = [
  {
    title: 'DEC 20, 2023',
    data: [
      {
        title: 'Send',
        type: 'send',
      },
    ],
  },
];

const getTitle = (type) => {
  if (type === 'send') return 'Send';
};

function TxHistoryListView(props: IProps) {
  const { data, accountAddress, onContentSizeChange } = props;
  console.log(data);
  return (
    <SectionList
      h="100%"
      scrollEnabled={platformEnv.isWebTouchable}
      onContentSizeChange={onContentSizeChange}
      sections={fakeData}
      // renderSectionHeader={({ section }) => (
      //   <TxHistorySectionHeader {...section} />
      // )}
      ListHeaderComponent={TxHistoryListHeader}
      ListEmptyComponent={TxHistoryListEmpty}
      estimatedItemSize={60}
      // renderItem={({ item }: { item: IAccountHistoryTx }) => (
      //   <TxHistoryListItem
      //     key={item.id}
      //     historyTx={item}
      //     accountAddress={accountAddress}
      //   />
      // )}
      renderItem={({ item }) => (
        <ListItem>
          <ListItem.Text
            primary={item.title}
            secondary={
              <XStack space="$0.5">
                <SizableText size="$bodyMd" color="$textSubdued">
                  To
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  addr1q8x...dsnackw2
                </SizableText>
              </XStack>
            }
          />
        </ListItem>
      )}
    />
  );
}

export { TxHistoryListView };
