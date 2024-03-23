import type { IOneKeyAPIBaseResponse } from '@onekeyhq/shared/types/request';

/** Accounts */
export type ICreateUserResponse = IOneKeyAPIBaseResponse<{
  id: number;
  login: string;
}>;

export type IAuthParams = {
  login: string;
  password: string;
  refresh_token: string;
};

export type IAuthResponse = {
  access_token: string;
  refresh_token: string;
};

export type IBalanceResponse = {
  balance: number;
  currency: string;
  unit: string;
};

export type IBatchBalanceResponse = {
  balance: number;
  address: string;
};

/** Signature */
export const LightningScenario = 'onekey-lightning-network';

type IRegisterMsgType = {
  scenario: typeof LightningScenario;
  type: 'register';
  pubkey: string;
  address: string;
  randomSeed: number;
};
type IAuthMsgType = {
  scenario: typeof LightningScenario;
  type: 'auth';
  pubkey: string;
  address: string;
  timestamp: number;
  randomSeed: number;
};
type IPaymentBolt11MsgType = {
  scenario: typeof LightningScenario;
  type: 'transfer';
  invoice: string;
  paymentHash: string;
  expired: string;
  created: number;
  nonce: number;
  randomSeed: number;
};

export type IUnionMsgType =
  | IRegisterMsgType
  | IAuthMsgType
  | IPaymentBolt11MsgType;
