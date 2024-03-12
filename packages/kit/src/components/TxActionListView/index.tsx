import type { ComponentProps } from 'react';

import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';

import type { ListItem } from '../ListItem';

type IProps = {
  decodedTx: IDecodedTx;
  componentType?: ETxActionComponentType;
  tableLayout?: boolean;
  nativeTokenTransferAmountToUpdate?: string;
  showIcon?: boolean;
  componentProps?: ComponentProps<typeof ListItem>;
};

function TxActionsListView(props: IProps) {
  const {
    decodedTx,
    componentType = ETxActionComponentType.ListView,
    componentProps,
    tableLayout,
    nativeTokenTransferAmountToUpdate,
    showIcon,
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
      showIcon={showIcon}
      nativeTokenTransferAmountToUpdate={nativeTokenTransferAmountToUpdate}
    />
  );
}

export { TxActionsListView };
