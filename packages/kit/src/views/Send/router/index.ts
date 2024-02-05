import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken } from '@onekeyhq/shared/types/token';

export enum EModalSendRoutes {
  SendAssetInput = 'SendAssetInput',
  SendDataInput = 'SendDataInput',
  SendConfirm = 'SendConfirm',
  SendProgress = 'SendProgress',
  SendFeedback = 'SendFeedback',
  SendCustomFee = 'SendCustomFee',
}

export type IModalSendParamList = {
  [EModalSendRoutes.SendAssetInput]: {
    networkId: string;
    accountId: string;
    address?: string;
    amount?: string;
  };
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
    onSuccess?: (txs: ISignedTxPro[]) => void;
    onFail?: (error: Error) => void;
  };
  [EModalSendRoutes.SendProgress]: {
    networkId: string;
    accountId: string;
    unsignedTxs: IUnsignedTxPro[];
    onSuccess?: (txs: ISignedTxPro[]) => void;
    onFail?: (error: Error) => void;
  };
  [EModalSendRoutes.SendCustomFee]: {
    networkId: string;
    accountId: string;
    customFee: IFeeInfoUnit;
    onApply: (feeInfo: IFeeInfoUnit) => void;
  };
};
