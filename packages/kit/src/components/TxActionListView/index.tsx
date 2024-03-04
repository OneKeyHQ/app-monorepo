import type { ComponentProps } from 'react';

import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';
import { getDisplayedActions } from '../../utils/txAction';

import type { ListItem } from '../ListItem';

type IProps = {
  decodedTx: IDecodedTx;
  componentType?: ETxActionComponentType;
  tableLayout?: boolean;
  nativeTokenTransferAmountToUpdate?: string;
  componentProps?: ComponentProps<typeof ListItem>;
};

function TxActionsListView(props: IProps) {
  const {
    decodedTx,
    componentType = ETxActionComponentType.ListView,
    componentProps,
    tableLayout,
    nativeTokenTransferAmountToUpdate,
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
      decodedTx={decodedTx}
      componentProps={componentProps}
      nativeTokenTransferAmountToUpdate={nativeTokenTransferAmountToUpdate}
    />
  );
}

export { TxActionsListView };
