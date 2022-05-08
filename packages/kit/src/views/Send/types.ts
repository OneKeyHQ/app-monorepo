import { Token } from '@onekeyhq/engine/src/types/token';
import {
  IBroadcastedTx,
  IFeeInfoSelected,
} from '@onekeyhq/engine/src/types/vault';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { IDappCallParams } from '../../background/IBackgroundApi';

import type { SwapQuote } from '../Swap/typings';

export enum SendRoutes {
  Send = 'Send',
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
  encodedTx?: any;
  decodedTx?: any;
};

export type EditFeeParams = {
  encodedTx?: any;
  feeInfoSelected?: IFeeInfoSelected;
  autoConfirmAfterFeeSaved?: boolean;
};

export type SendParams = EditFeeParams & {
  token?: Token;
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
  | SwapQuote;
export type SendConfirmParams = EditFeeParams & {
  payloadType?: string;
  payload?: SendConfirmPayload;
  onSuccess?: (tx: IBroadcastedTx) => void;
  sourceInfo?: IDappCallParams;
  actionType?: SendConfirmActionType;
  backRouteName?: keyof SendRoutesParams;
};

export type SendAuthenticationParams = SendConfirmParams & {
  accountId: string;
  walletId: string;
  networkId: string;
  unsignedMessage?: IUnsignedMessageEvm;
  encodedTx?: any;
};

export type SignMessageConfirmParams = {
  sourceInfo?: IDappCallParams;
  unsignedMessage: IUnsignedMessageEvm;
};

export type SendRoutesParams = {
  [SendRoutes.Send]: SendParams;
  [SendRoutes.SendEditFee]: EditFeeParams;
  [SendRoutes.TokenApproveAmountEdit]: TokenApproveAmountEditParams;
  [SendRoutes.SendConfirmFromDapp]: SendConfirmFromDappParams;
  [SendRoutes.SendConfirm]: SendConfirmParams;
  [SendRoutes.SendAuthentication]: SendAuthenticationParams;
  [SendRoutes.SignMessageConfirm]: SignMessageConfirmParams;
  [SendRoutes.SwapPreview]: undefined;
};
