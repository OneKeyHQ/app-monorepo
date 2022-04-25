import { Token } from '@onekeyhq/engine/src/types/token';
import {
  IBroadcastedTx,
  IFeeInfoSelected,
} from '@onekeyhq/engine/src/types/vault';
import { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';

import { IDappCallParams } from '../../background/IBackgroundApi';

export enum SendRoutes {
  Send = 'Send',
  SendConfirm = 'SendConfirm',
  SendConfirmFromDapp = 'SendConfirmFromDapp',
  SendEditFee = 'SendEditFee',
  TokenApproveAmountEdit = 'TokenApproveAmountEdit',
  SendAuthentication = 'SendAuthentication',
  SignMessageConfirm = 'SignMessageConfirm',
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
  backRouteName?: keyof SendRoutesParams;
};

export type SendParams = EditFeeParams & {
  token?: Token;
};

export type TransferSendParamsPayload = {
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

export type SendConfirmParams = EditFeeParams & {
  payloadType?: string;
  payload?: TransferSendParamsPayload | any;
  onSuccess?: (tx: IBroadcastedTx) => void;
  sourceInfo?: IDappCallParams;
};

export type SendAuthenticationParams = SendConfirmParams & {
  accountId: string;
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
};
