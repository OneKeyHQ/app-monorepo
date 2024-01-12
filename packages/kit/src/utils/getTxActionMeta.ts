import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import {
  TxActionFunctionCallT0,
  TxActionFunctionCallT1,
} from '../components/TxAction/TxActionFunctionCall';
import {
  TxActionTokenApproveT0,
  TxActionTokenApproveT1,
} from '../components/TxAction/TxActionTokenApprove';
import {
  TxActionTransferT0,
  TxActionTransferT1,
} from '../components/TxAction/TxActionTransfer';

import type { ITxActionComponents } from '../components/TxAction/types';

/*
T0: UI component in ListView
T1: UI component in DetailView
 */

export function getTxActionMeta({ action }: { action: IDecodedTxAction }) {
  let components: ITxActionComponents;

  switch (action.type) {
    case EDecodedTxActionType.ASSET_TRANSFER:
      components = {
        T0: TxActionTransferT0,
        T1: TxActionTransferT1,
      };
      break;
    case EDecodedTxActionType.TOKEN_APPROVE:
      components = {
        T0: TxActionTokenApproveT0,
        T1: TxActionTokenApproveT1,
      };
      break;
    default:
      components = {
        T0: TxActionFunctionCallT0,
        T1: TxActionFunctionCallT1,
      };
  }

  return {
    components,
  };
}
