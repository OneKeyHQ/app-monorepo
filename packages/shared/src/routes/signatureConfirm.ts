import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferPayload } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import type { ISendTxOnSuccessData } from '../../types/tx';

export enum EModalSignatureConfirmRoutes {
  TxConfirm = 'TxConfirm',
}

export type IModalSignatureConfirmParamList = {
  [EModalSignatureConfirmRoutes.TxConfirm]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    sourceInfo?: IDappSourceInfo;
    signOnly?: boolean;
    useFeeInTx?: boolean;
    feeInfoEditable?: boolean;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    transferPayload?: ITransferPayload;
    popStack?: boolean;
  };
};
