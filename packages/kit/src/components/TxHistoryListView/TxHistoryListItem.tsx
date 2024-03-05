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
    <TxActionsListView
      decodedTx={decodedTx}
      tableLayout={tableLayout}
      componentType={ETxActionComponentType.ListView}
      componentProps={{
        backgroundColor: tableLayout && index % 2 === 1 ? '$bgSubdued' : '',
        onPress: () => onPress?.(historyTx),
      }}
    />
  );
}

export { TxHistoryListItem };
