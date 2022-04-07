import {
  IBroadcastedTx,
  IFeeInfoSelected,
} from '@onekeyhq/engine/src/types/vault';

import { IDappCallParams } from '../../background/IBackgroundApi';

export enum SendRoutes {
  Send = 'Send',
  SendConfirm = 'SendConfirm',
  SendEditFee = 'SendEditFee',
  SendAuthentication = 'SendAuthentication',
}
export type EditFeeParams = {
  encodedTx?: any;
  feeInfoSelected?: IFeeInfoSelected;
  backRouteName?: string;
  source?: IDappCallParams;
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
  token: {
    idOnNetwork: string;
    logoURI: string;
    name: string;
    symbol: string;
  };
};

export type SendParams = EditFeeParams & {
  payloadType?: string;
  payload?: TransferSendParamsPayload | any;
  onSuccess?: (tx: IBroadcastedTx) => void;
};

export type SendAuthenticationParams = SendParams & {
  accountId: string;
  networkId: string;
};

export type SendRoutesParams = {
  [SendRoutes.Send]: EditFeeParams;
  [SendRoutes.SendEditFee]: EditFeeParams;
  [SendRoutes.SendConfirm]: SendParams;
  [SendRoutes.SendAuthentication]: SendAuthenticationParams;
};
