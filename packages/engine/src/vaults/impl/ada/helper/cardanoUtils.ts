import type { DBUTXOAccount } from '../../../../types/account';
import type { IChangeAddress } from '../types';

// PROTO.CardanoAddressType.BASE
const CardanoAddressTypeBASE = 0;

export const getChangeAddress = (dbAccount: DBUTXOAccount): IChangeAddress => ({
  address: dbAccount.address,
  addressParameters: {
    path: dbAccount.path,
    addressType: CardanoAddressTypeBASE,
    stakingPath: `${dbAccount.path.slice(0, -3)}2/0`,
  },
});
