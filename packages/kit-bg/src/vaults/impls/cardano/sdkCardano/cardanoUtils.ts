import type { IAdaChangeAddress } from '@onekeyhq/core/src/chains/ada/types';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';

// PROTO.CardanoAddressType.BASE
const CardanoAddressTypeBASE = 0;

export const getChangeAddress = (
  dbAccount: IDBUtxoAccount,
): IAdaChangeAddress => {
  const path = `${dbAccount.path}/0/0`;
  return {
    address: dbAccount.address,
    addressParameters: {
      path,
      addressType: CardanoAddressTypeBASE,
      stakingPath: `${path.slice(0, -3)}2/0`,
    },
  };
};
