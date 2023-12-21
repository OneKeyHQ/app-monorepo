import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';
import { getDisplayedActions } from '../../utils/txAction';

type IProps = {
  historyTx?: IAccountHistoryTx;
  decodedTx: IDecodedTx;
  accountAddress: string;
  componentType?: 'T0' | 'T1';
};

function TxActionsListView(props: IProps) {
  const { decodedTx, accountAddress, componentType = 'T0' } = props;
  const actions = getDisplayedActions({ decodedTx });
  const action = actions[0];

  // TODO: multiple actions

  const { components } = getTxActionMeta({
    action,
  });

  const TxActionComponent = components[componentType];

  return <TxActionComponent action={action} accountAddress={accountAddress} />;
}

export { TxActionsListView };
