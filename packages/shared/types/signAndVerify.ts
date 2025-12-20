import type { IServerNetwork } from '.';
import type { INetworkAccount } from './account';

export enum ESignAndVerifyAction {
  Sign = 'sign',
  Verify = 'verify',
}

export interface ISignAccount {
  account: INetworkAccount;
  network: IServerNetwork;
  deriveType?: string;
  deriveLabel?: string;
}
