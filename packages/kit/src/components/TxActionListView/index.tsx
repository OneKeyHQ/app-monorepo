import type { ComponentProps } from 'react';

import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type { EReplaceTxType, IDecodedTx } from '@onekeyhq/shared/types/tx';

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
  replaceType?: EReplaceTxType;
  swapInfo?: ISwapTxInfo;
  hideValue?: boolean;
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
    replaceType,
    swapInfo,
    hideValue,
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
      key={decodedTx.txid}
      action={action}
      decodedTx={decodedTx}
      tableLayout={tableLayout}
      componentProps={componentProps}
      showIcon={showIcon}
      nativeTokenTransferAmountToUpdate={nativeTokenTransferAmountToUpdate}
      isSendNativeToken={isSendNativeToken}
      replaceType={replaceType}
      swapInfo={swapInfo}
      hideValue={hideValue}
    />
  );
}

export { TxActionsListView };
