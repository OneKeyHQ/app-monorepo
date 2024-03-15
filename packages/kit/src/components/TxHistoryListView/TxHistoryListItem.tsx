import { TxActionsListView } from '@onekeyhq/kit/src/components/TxActionListView';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

type IProps = {
  index: number;
  historyTx: IAccountHistoryTx;
  onPress?: (historyTx: IAccountHistoryTx) => void;
  showIcon?: boolean;
  tableLayout?: boolean;
};

function TxHistoryListItem(props: IProps) {
  const { historyTx, tableLayout, onPress, index, showIcon } = props;

  if (!historyTx || !historyTx.decodedTx) return null;

  return (
    <TxActionsListView
      decodedTx={historyTx.decodedTx}
      tableLayout={tableLayout}
      showIcon={showIcon}
      componentType={ETxActionComponentType.ListView}
      componentProps={{
        onPress: () => onPress?.(historyTx),
        // ...(tableLayout &&
        //   index % 2 && {
        //     bg: '$bgSubdued',
        //   }),
      }}
    />
  );
}

export { TxHistoryListItem };
