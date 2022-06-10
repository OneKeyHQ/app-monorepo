import { Token } from '@onekeyhq/engine/src/types/token';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfoSelected,
  ISignedTx,
  ITransferInfo,
} from '@onekeyhq/engine/src/vaults/types';

import { IDappCallParams } from '../../background/IBackgroundApi';

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
  sourceInfo?: IDappCallParams | undefined;
  encodedTx?: IEncodedTx;
  decodedTx?: IDecodedTxLegacy;
};

export type EditFeeParams = {
  encodedTx?: IEncodedTx;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
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
export type SendConfirmPayloadBase = {
  payloadType: 'Transfer' | 'InternalSwap';
};
export type SendConfirmPayload =
  | SendConfirmPayloadBase
  | TransferSendParamsPayload
  | SwapQuoteTx;
export type SendConfirmParams = EditFeeParams & {
  payloadType?: string; // TODO remove
  payload?: SendConfirmPayload; // use payload.payloadType
  onSuccess?: (tx: ISignedTx) => void;
  sourceInfo?: IDappCallParams;
  actionType?: SendConfirmActionType;
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
  sourceInfo?: IDappCallParams;
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
