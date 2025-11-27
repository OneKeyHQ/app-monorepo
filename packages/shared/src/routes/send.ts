import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
  ITransferPayload,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { ITokenSelectorParamList } from './assetSelector';
import type { INetworkAccount } from '../../types/account';
import type { EDeriveAddressActionType } from '../../types/address';
import type { IAccountHistoryTx } from '../../types/history';
import type { EReplaceTxType, ISendTxOnSuccessData } from '../../types/tx';

export enum EModalSendRoutes {
  SendDataInput = 'SendDataInput',
  SendConfirmFromDApp = 'SendConfirmFromDApp',
  SendConfirmFromSwap = 'SendConfirmFromSwap',
  SendConfirm = 'SendConfirm',
  SendFeedback = 'SendFeedback',
  SendReplaceTx = 'SendReplaceTx',
  SendSelectToken = 'SendSelectToken',
  SendSelectDeriveAddress = 'SendSelectDeriveAddress',
}

export type IModalSendParamList = {
  [EModalSendRoutes.SendSelectToken]: ITokenSelectorParamList;
  [EModalSendRoutes.SendDataInput]: {
    networkId: string;
    accountId: string;
    isNFT: boolean;
    nfts?: IAccountNFT[];
    token?: IToken | null;
    address?: string;
    amount?: string;
    onSuccess?: (txs: ISendTxOnSuccessData[]) => void;
    onFail?: (error: Error) => void;
    onCancel?: () => void;
    isAllNetworks?: boolean;
  };
  [EModalSendRoutes.SendConfirm]: {
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
  [EModalSendRoutes.SendConfirmFromDApp]: undefined;
  [EModalSendRoutes.SendConfirmFromSwap]: {
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
  };
  [EModalSendRoutes.SendReplaceTx]: {
    networkId: string;
    accountId: string;
    replaceType: EReplaceTxType;
    replaceEncodedTx: IEncodedTx;
    historyTx: IAccountHistoryTx;
    onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  };
  [EModalSendRoutes.SendSelectDeriveAddress]: {
    networkId: string;
    indexedAccountId: string;
    walletId: string;
    accountId: string;
    actionType?: EDeriveAddressActionType;
    onSelected?: ({
      account,
      deriveInfo,
      deriveType,
    }: {
      account: INetworkAccount;
      deriveInfo: IAccountDeriveInfo;
      deriveType: IAccountDeriveTypes;
    }) => void;
    onUnmounted?: () => void;
    tokenMap?: Record<string, ITokenFiat>;
    token?: IToken;
  };
};
