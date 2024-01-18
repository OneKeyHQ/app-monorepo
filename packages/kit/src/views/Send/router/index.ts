import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
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
  };
  [EModalSendRoutes.SendDataInput]: {
    networkId: string;
    accountId: string;
    isNFT: boolean;
    nfts?: IAccountNFT[];
    token?: IToken;
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
  [EModalSendRoutes.SendCustomFee]: {
    networkId: string;
    accountId: string;
    customFee: IFeeInfoUnit;
    onApply: (feeInfo: IFeeInfoUnit) => void;
  };
};
