import type { ComponentProps } from 'react';

import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getTxActionMeta } from '../../utils/getTxActionMeta';

import type { ListItem } from '../ListItem';

type IProps = {
  decodedTx: IDecodedTx;
  componentType?: ETxActionComponentType;
  nativeTokenTransferAmountToUpdate?: string;
  showIcon?: boolean;
  tableLayout?: boolean;
  componentProps?: ComponentProps<typeof ListItem>;
  isSendNativeToken?: boolean;
};

function TxActionsListView(props: IProps) {
  const {
    decodedTx,
    componentType = ETxActionComponentType.ListView,
    componentProps,
    nativeTokenTransferAmountToUpdate,
    isSendNativeToken,
    showIcon,
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
      decodedTx={decodedTx}
      tableLayout={tableLayout}
      componentProps={componentProps}
      showIcon={showIcon}
      nativeTokenTransferAmountToUpdate={nativeTokenTransferAmountToUpdate}
      isSendNativeToken={isSendNativeToken}
    />
  );
}

export { TxActionsListView };
