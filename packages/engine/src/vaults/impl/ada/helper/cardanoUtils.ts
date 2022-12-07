import { PROTO } from '@onekeyfe/hd-core';

import { DBUTXOAccount } from '../../../../types/account';
import { IChangeAddress } from '../types';

export const getChangeAddress = (dbAccount: DBUTXOAccount): IChangeAddress => ({
  address: dbAccount.address,
  addressParameters: {
    path: dbAccount.path,
    addressType: PROTO.CardanoAddressType.BASE,
    stakingPath: `${dbAccount.path.slice(0, -3)}2/0`,
  },
});
