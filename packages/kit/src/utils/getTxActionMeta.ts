import { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import {
  TxActionFunctionCallDetailView,
  TxActionFunctionCallListView,
} from '../components/TxAction/TxActionFunctionCall';
import {
  TxActionTokenApproveDetailView,
  TxActionTokenApproveListView,
} from '../components/TxAction/TxActionTokenApprove';
import {
  TxActionTransferDetailView,
  TxActionTransferListView,
} from '../components/TxAction/TxActionTransfer';

import type { ITxActionComponents } from '../components/TxAction/types';

export function getTxActionMeta({ action }: { action: IDecodedTxAction }) {
  let components: ITxActionComponents;

  switch (action.type) {
    case EDecodedTxActionType.ASSET_TRANSFER:
      components = {
        [ETxActionComponentType.ListView]: TxActionTransferListView,
        [ETxActionComponentType.DetailView]: TxActionTransferDetailView,
      };
      break;
    case EDecodedTxActionType.TOKEN_APPROVE:
      components = {
        [ETxActionComponentType.ListView]: TxActionTokenApproveListView,
        [ETxActionComponentType.DetailView]: TxActionTokenApproveDetailView,
      };
      break;
    case EDecodedTxActionType.FUNCTION_CALL:
      components = {
        [ETxActionComponentType.ListView]: TxActionFunctionCallListView,
        [ETxActionComponentType.DetailView]: TxActionFunctionCallDetailView,
      };
      break;
    default:
      components = {
        [ETxActionComponentType.ListView]: TxActionFunctionCallListView,
        [ETxActionComponentType.DetailView]: TxActionFunctionCallDetailView,
      };
  }

  return {
    components,
  };
}
