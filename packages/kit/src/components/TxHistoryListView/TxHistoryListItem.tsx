import { Stack } from '@onekeyhq/components';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxActionsListView } from '../TxActionListView';

type IProps = {
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  tableLayout?: boolean;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout } = props;
  const { decodedTx } = historyTx;

  return (
    <Stack>
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
