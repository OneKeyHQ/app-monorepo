import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';
import { getDisplayedActions } from '../../utils/txAction';

type IProps = {
  decodedTx: IDecodedTx;
  componentType?: ETxActionComponentType;
  tableLayout?: boolean;
};

function TxActionsListView(props: IProps) {
  const {
    decodedTx,
    componentType = ETxActionComponentType.ListView,
    tableLayout,
  } = props;
  const actions = getDisplayedActions({ decodedTx });
  const action = actions[0];

  // TODO: multiple actions

  const { components } = getTxActionMeta({
    action,
  });

  const TxActionComponent = components[componentType];

  return (
    <TxActionComponent
      action={action}
      tableLayout={tableLayout}
      networkId={decodedTx.networkId}
    />
  );
}

export { TxActionsListView };
