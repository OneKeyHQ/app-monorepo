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
  [EModalSendRoutes.SendAssetInput]: {
    networkId: string;
    accountId: string;
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendAddressInput]: {
    networkId: string;
    accountId: string;
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendAmountInput]: {
    networkId: string;
    accountId: string;
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendConfirm]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    transfersInfo: ITransferInfo[];
  };
  [EModalSendRoutes.SendProgress]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    transfersInfo: ITransferInfo[];
  };
};
