import { Stack } from '@onekeyhq/components';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxActionsListView } from '../../../../components/TxActionListView';

type IProps = {
  historyTx: IAccountHistoryTx;
  accountAddress: string;
  onPress?: (historyTx: IAccountHistoryTx) => void;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, accountAddress } = props;
  const { decodedTx } = historyTx;

  return (
    <Stack>
      <TxActionsListView
        historyTx={historyTx}
        decodedTx={decodedTx}
        accountAddress={accountAddress}
        componentType="T0"
      />
    </Stack>
  );
}

export { TxHistoryListItem };
