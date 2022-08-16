import { IWalletConnectSession } from '@walletconnect/types';

import { ISimpleDbWalletConnectAccountInfo } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';
import { Account } from '@onekeyhq/engine/src/types/account';
import { Network } from '@onekeyhq/engine/src/types/network';
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
import { OneKeyWalletConnector } from '../../components/WalletConnect/OneKeyWalletConnector';
import { WalletService } from '../../components/WalletConnect/types';
import { WalletConnectClientForDapp } from '../../components/WalletConnect/WalletConnectClientForDapp';

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
  SendFeedbackReceipt = 'SendFeedbackReceipt',
}

export type TokenApproveAmountEditParams = {
  tokenApproveAmount: string;
  isMaxAmount: boolean;
  sourceInfo?: IDappSourceInfo | undefined;
  encodedTx?: IEncodedTx | null;
  decodedTx?: IDecodedTx;
  sendConfirmParams: SendConfirmParams;
};

export type EditFeeParams = SendConfirmSharedParams & {
  sendConfirmParams: SendConfirmParams;
};

export type PreSendParams = ITransferInfo;

export type SendLegacyParams = SendConfirmSharedParams & {
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
export type SendConfirmSharedParams = {
  encodedTx?: IEncodedTx;
  resendActionInfo?: SendConfirmResendActionInfo;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
  onModalClose?: () => void;
};
export type SendConfirmParams = SendConfirmSharedParams & {
  payloadType?: string; // TODO remove
  payload?: SendConfirmPayload; // use payload.payloadType // TODO remove
  payloadInfo?: SendConfirmPayloadInfo;
  onSuccess?: (tx: ISignedTx, data?: SendConfirmOnSuccessData) => void;
  onFail?: (error: Error) => void;
  sourceInfo?: IDappSourceInfo;
  // TODO remove, use resendActionInfo instead
  actionType?: SendConfirmActionType; // 'speedUp' | 'cancel';
  // resendActionInfo?: SendConfirmResendActionInfo;
  backRouteName?: keyof SendRoutesParams;
  feeInfoUseFeeInTx: boolean;
  feeInfoEditable: boolean;
  onDetail?: (txid: string) => any;
  signOnly?: boolean;
};

export type IWalletConnectExternalAccountInfo = {
  accountInfo?: ISimpleDbWalletConnectAccountInfo;
  session?: IWalletConnectSession;
  client?: WalletConnectClientForDapp;
  walletService?: WalletService;
  currentNetwork: Network;
  currentAccount: Account;
};

export type IWalletConnectSendInfo = {
  connector: OneKeyWalletConnector;
  externalAccountInfo: IWalletConnectExternalAccountInfo;
  client: WalletConnectClientForDapp;
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

export type SendFeedbackReceiptParams = {
  txid: string;
  closeModal?: () => any;
  onDetail?: (txid: string) => any;
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
  [SendRoutes.SendFeedbackReceipt]: SendFeedbackReceiptParams;
};
