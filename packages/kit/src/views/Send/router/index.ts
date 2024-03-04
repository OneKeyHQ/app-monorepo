import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

export enum EModalSendRoutes {
  SendDataInput = 'SendDataInput',
  SendConfirmFromDApp = 'SendConfirmFromDApp',
  SendConfirm = 'SendConfirm',
  SendFeedback = 'SendFeedback',
  SendCustomFee = 'SendCustomFee',
}

export type IModalSendParamList = {
  [EModalSendRoutes.SendDataInput]: {
    networkId: string;
    accountId: string;
    isNFT: boolean;
    nfts?: IAccountNFT[];
    token?: IToken;
    address?: string;
    amount?: string;
  };
  [EModalSendRoutes.SendConfirm]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    sourceInfo?: IDappSourceInfo;
    signOnly?: boolean;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
  };
  [EModalSendRoutes.SendConfirmFromDApp]: undefined;
  [EModalSendRoutes.SendCustomFee]: {
    networkId: string;
    accountId: string;
    customFee: IFeeInfoUnit;
    onApply: (feeInfo: IFeeInfoUnit) => void;
  };
};
