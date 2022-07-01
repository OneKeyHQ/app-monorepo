import { Token } from '@onekeyhq/engine/src/types/token';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTx,
  IEncodedTx,
  IFeeInfoSelected,
  ISignedTx,
  ISwapInfo,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';

import { IDappSourceInfo } from '../../background/IBackgroundApi';

import type { SwapQuoteTx } from '../Swap/typings';

export enum SendRoutes {
  SendLegacy = 'SendLegacy',
  PreSendToken = 'PreSendToken',
  PreSendAddress = 'PreSendAddress',
  PreSendAmount = 'PreSendAmount',
  SendConfirm = 'SendConfirm',
  SendConfirmFromDapp = 'SendConfirmFromDapp',
  SendEditFee = 'SendEditFee',
  TokenApproveAmountEdit = 'TokenApproveAmountEdit',
  SendAuthentication = 'SendAuthentication',
  SignMessageConfirm = 'SignMessageConfirm',
  SwapPreview = 'SwapPreview',
}

export type TokenApproveAmountEditParams = {
  tokenApproveAmount: string;
  isMaxAmount: boolean;
  sourceInfo?: IDappSourceInfo | undefined;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx;
};

export type EditFeeParams = {
  encodedTx?: IEncodedTx;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
  resendActionInfo?: SendConfirmResendActionInfo;
};

export type PreSendParams = ITransferInfo;

export type SendLegacyParams = EditFeeParams & {
  token?: Token;
  to?: string;
};

export type TransferSendParamsPayload = SendConfirmPayloadBase & {
  to: string;
  account: {
    id: string;
    name: string;
    address: string;
  };
  network: {
    id: string;
    name: string;
  };
  value: string;
  isMax: boolean;
  token: {
    idOnNetwork: string;
    logoURI: string;
    name: string;
    symbol: string;
    balance?: string;
  };
};

export type SendConfirmFromDappParams = {
  query?: string;
};
export type SendConfirmActionType = 'speedUp' | 'cancel';
export type SendConfirmResendActionInfo = {
  type: SendConfirmActionType;
  replaceHistoryId?: string;
};
export type SendConfirmPayloadBase = {
  payloadType: 'Transfer' | 'InternalSwap';
};
export type SendConfirmPayload =
  | SendConfirmPayloadBase
  | TransferSendParamsPayload // ITransferInfo
  | SwapQuoteTx;
export type SendConfirmOnSuccessData = {
  signedTx?: ISignedTx;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx | null;
};
export type SendConfirmPayloadInfo = {
  type: 'Transfer' | 'InternalSwap';
  transferInfo?: ITransferInfo;
  swapInfo?: ISwapInfo;
};
export type SendConfirmParams = EditFeeParams & {
  payloadType?: string; // TODO remove
  payload?: SendConfirmPayload; // use payload.payloadType // TODO remove
  payloadInfo?: SendConfirmPayloadInfo;
  onSuccess?: (tx: ISignedTx, data?: SendConfirmOnSuccessData) => void;
  sourceInfo?: IDappSourceInfo;
  // TODO remove, use resendActionInfo instead
  actionType?: SendConfirmActionType; // 'speedUp' | 'cancel';
  // resendActionInfo?: SendConfirmResendActionInfo;
  backRouteName?: keyof SendRoutesParams;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
};

export type SendAuthenticationParams = Omit<
  SendConfirmParams,
  'feeInfoEditable' | 'feeInfoUseFeeInTx'
> & {
  accountId: string;
  walletId: string;
  networkId: string;
  unsignedMessage?: IUnsignedMessageEvm;
  encodedTx?: IEncodedTx;
};

export type SignMessageConfirmParams = {
  sourceInfo?: IDappSourceInfo;
  unsignedMessage: IUnsignedMessageEvm;
};

export type SendRoutesParams = {
  [SendRoutes.SendLegacy]: SendLegacyParams;
  [SendRoutes.PreSendToken]: PreSendParams;
  [SendRoutes.PreSendAddress]: PreSendParams;
  [SendRoutes.PreSendAmount]: PreSendParams;
  [SendRoutes.SendEditFee]: EditFeeParams;
  [SendRoutes.TokenApproveAmountEdit]: TokenApproveAmountEditParams;
  [SendRoutes.SendConfirmFromDapp]: SendConfirmFromDappParams;
  [SendRoutes.SendConfirm]: SendConfirmParams;
  [SendRoutes.SendAuthentication]: SendAuthenticationParams;
  [SendRoutes.SignMessageConfirm]: SignMessageConfirmParams;
  [SendRoutes.SwapPreview]: undefined;
};
