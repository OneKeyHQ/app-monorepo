import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';

export enum EModalSendRoutes {
  SendAssetInput = 'SendAssetInput',
  SendAddressInput = 'SendAddressInput',
  SendAmountInput = 'SendAmountInput',
  SendConfirm = 'SendConfirm',
  SendProgress = 'SendProgress',
  SendFeedback = 'SendFeedback',
}

export type IModalSendParamList = {
  [EModalSendRoutes.SendAssetInput]: undefined;
  [EModalSendRoutes.SendAddressInput]: undefined;
  [EModalSendRoutes.SendAmountInput]: {
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendConfirm]: {
    unsignedTx: IUnsignedTxPro;
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendProgress]: {
    unsignedTx: IUnsignedTxPro;
    transfersInfo: ITransferInfo[];
  };
};
