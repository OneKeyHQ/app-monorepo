import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';
import { getDisplayedActions } from '../../utils/txAction';

type IProps = {
  historyTx?: IAccountHistoryTx;
  decodedTx: IDecodedTx;
  componentType?: 'T0' | 'T1';
  tableLayout?: boolean;
};

function TxActionsListView(props: IProps) {
  const { decodedTx, componentType = 'T0', tableLayout } = props;
  const actions = getDisplayedActions({ decodedTx });
  const action = actions[0];

  // TODO: multiple actions

  const { components } = getTxActionMeta({
    action,
  });

  const TxActionComponent = components[componentType];

  return <TxActionComponent action={action} tableLayout={tableLayout} />;
}

export { TxActionsListView };
