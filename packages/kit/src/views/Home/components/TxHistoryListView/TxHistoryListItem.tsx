import { Stack } from '@onekeyhq/components';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxActionsListView } from '../../../../components/TxActionListView';

type IProps = {
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx } = props;
  const { decodedTx } = historyTx;

  return (
    <Stack>
      <TxActionsListView
        historyTx={historyTx}
        decodedTx={decodedTx}
        componentType="T0"
      />
    </Stack>
  );
}

export { TxHistoryListItem };
