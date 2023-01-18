import type { Account as BaseAccount } from './account';
import type { Network as BaseNetwork } from './network';
import type { Token as BaseToken } from './token';
import type { Wallet as BaseWallet } from './wallet';
import type { IJsonRpcResponse } from '@onekeyfe/cross-inpage-provider-types';

export type INetwork = BaseNetwork;
export type IWallet = BaseWallet;
export type IAccount = BaseAccount;
export type IToken = BaseToken;

export interface IJsonRpcResponsePro<T> extends IJsonRpcResponse<T> {
  error?: any;
}
