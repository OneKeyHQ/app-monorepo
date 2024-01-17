import { Stack } from '@onekeyhq/components';
import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
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
        decodedTx={decodedTx}
        tableLayout={tableLayout}
        componentType={ETxActionComponentType.ListView}
      />
    </Stack>
  );
}

export { TxHistoryListItem };
