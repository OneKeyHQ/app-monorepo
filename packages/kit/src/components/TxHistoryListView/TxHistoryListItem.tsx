import { Stack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

type IProps = {
  index: number;
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  tableLayout?: boolean;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout, onPress, index } = props;
  const { decodedTx } = historyTx;

  return (
    <Stack onPress={() => onPress?.(historyTx)}>
      <Stack>
        <TxActionsListView
          decodedTx={decodedTx}
          tableLayout={tableLayout}
          componentType={ETxActionComponentType.ListView}
          componentProps={{
            borderRadius: '$3',
            backgroundColor: tableLayout && index % 2 === 0 ? '$bgSubdued' : '',
          }}
        />
      </Stack>
    </Stack>
  );
}

export { TxHistoryListItem };
