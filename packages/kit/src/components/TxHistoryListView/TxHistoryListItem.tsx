import { Stack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

type IProps = {
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  tableLayout?: boolean;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout, onPress } = props;
  const { decodedTx } = historyTx;

  return (
    <Stack onPress={() => onPress?.(historyTx)}>
      <TxActionsListView
        historyTx={historyTx}
        decodedTx={decodedTx}
        tableLayout={tableLayout}
        componentType="T0"
      />
    </Stack>
  );
}

export { TxHistoryListItem };
