// TODO move to upper

// import type { DBUTXOAccount } from '@onekeyhq/engine/src/types/account';
// import type { IChangeAddress } from '@onekeyhq/engine/src/vaults/impl/ada/types';

// // PROTO.CardanoAddressType.BASE
// const CardanoAddressTypeBASE = 0;

// export const getChangeAddress = (dbAccount: DBUTXOAccount): IChangeAddress => ({
//   address: dbAccount.address,
//   addressParameters: {
//     path: dbAccount.path,
//     addressType: CardanoAddressTypeBASE,
//     stakingPath: `${dbAccount.path.slice(0, -3)}2/0`,
//   },
// });
export function getChangeAddress() {
  throw new Error(
    'ADA getChangeAddress not implemented in core, move it to upper layer',
  );
}
