import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EParseTxType } from '@onekeyhq/shared/types/signatureConfirm';
import {
  EDecodedTxActionType,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

function getCustomHexDataAlertTitleIds(decodedTx: IDecodedTx) {
  const ids: ETranslations[] = [];
  if (decodedTx.isCustomHexData) {
    ids.push(ETranslations.send_hex_data_contract_interaction_warning);
  }

  if (decodedTx.isToContract) {
    ids.push(ETranslations.send_contract_address_detected_warning);
  }

  if (
    decodedTx.txParseType === EParseTxType.Approve ||
    decodedTx.actions?.find(
      (action) => action.type === EDecodedTxActionType.TOKEN_APPROVE,
    )
  ) {
    ids.push(ETranslations.send_hex_data_operations_warning);
  }

  if (
    decodedTx.txParseType === EParseTxType.Unknown &&
    decodedTx.actions?.every(
      (action) =>
        action.type === EDecodedTxActionType.UNKNOWN ||
        action.type === EDecodedTxActionType.FUNCTION_CALL,
    )
  ) {
    ids.push(ETranslations.send_unrecognized_hex_data_risky_warning);
  }

  return ids;
}

export { getCustomHexDataAlertTitleIds };
