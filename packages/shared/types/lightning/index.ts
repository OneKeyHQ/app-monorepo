import type { IUnionMsgType } from '@onekeyhq/core/src/chains/lightning/types';

import type { IDevicePassphraseParams } from '../device';

export type * from './accounts';
export type * from './invoice';

export type ISignApiMessageParams = {
  msgPayload: IUnionMsgType;
  address: string;
  path: string;
  password?: string;
  connectId?: string;
  deviceId?: string;
  deviceCommonParams?: IDevicePassphraseParams | undefined;
};
