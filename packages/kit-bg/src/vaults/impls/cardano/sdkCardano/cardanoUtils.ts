import type { IAdaChangeAddress } from '@onekeyhq/core/src/chains/ada/types';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

// PROTO.CardanoAddressType.BASE
const CardanoAddressTypeBASE = 0;

export const getChangeAddress = (
  dbAccount: IDBUtxoAccount,
): IAdaChangeAddress => ({
  address: dbAccount.address,
  addressParameters: {
    path: dbAccount.path,
    addressType: CardanoAddressTypeBASE,
    stakingPath: `${dbAccount.path.slice(0, -3)}2/0`,
  },
});
