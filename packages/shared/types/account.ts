import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { INetworkAccountAddressDetail } from './address';

export type INetworkAccount = IDBAccount & {
  addressDetail: INetworkAccountAddressDetail;
};
