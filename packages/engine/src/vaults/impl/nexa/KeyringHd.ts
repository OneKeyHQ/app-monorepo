// import { COINTYPE_NEXA as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

// import { OneKeyInternalError } from '../../../errors';
// import { slicePathTemplate } from '../../../managers/derivation';
// import { getDefaultAccountNameInfoByImpl } from '../../../managers/impl';
// import { batchGetPublicKeys } from '../../../secret';
// import { KeyringHdBase } from '../../keyring/KeyringHdBase';
// import { AddressEncodings } from '../../utils/btcForkChain/types';

// import type { ExportedSeedCredential } from '../../../dbs/base';
// import { Verifier, type Signer } from '../../../proxy';
// import type { CurveName } from '../../../secret';
// import { AccountType, type DBAccount } from '../../../types/account';
// import type { IPrepareSoftwareAccountsParams } from '../../types';
// import { pubkeyToAddress } from './utils';

// // m/44'/397'/0', m/44'/397'/1', m/44'/397'/2'
// const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;
// export class KeyringHd extends KeyringHdBase {
//   override getSigners(
//     password: string,
//     addresses: string[],
//   ): Promise<Record<string, Signer>> {
//     throw new Error('Method not implemented.');
//   }

//   override async prepareAccounts(
//     params: IPrepareSoftwareAccountsParams,
//   ): Promise<DBAccount[]> {
//     const curve: CurveName = 'secp256k1';
//     const accountNamePrefix = 'NEXA';
//     const hardened = true;

//     const { password, indexes, names } = params;
//     const { seed } = (await this.engine.dbApi.getCredential(
//       this.walletId,
//       password,
//     )) as ExportedSeedCredential;

//     const pubkeyInfos = batchGetPublicKeys(
//       curve,
//       seed,
//       password,
//       PATH_PREFIX,
//       indexes.map((index) => `${index}${hardened ? "'" : ''}`),
//     );

//     if (pubkeyInfos.length !== indexes.length) {
//       throw new OneKeyInternalError('Unable to get publick key.');
//     }

//     const ret = [];
//     let index = 0;
//     for (const info of pubkeyInfos) {
//       const {
//         path,
//         extendedKey: { key: pubkey },
//       } = info;
//       const pub = pubkey.toString('hex');
//       const name =
//         (names || [])[index] || `${accountNamePrefix} #${indexes[index] + 1}`;
//       const chainId = await this.vault.getNetworkChainId();
//       const addressOnNetwork = await pubkeyToAddress(
//         new Verifier(pub, curve),
//         chainId,
//       );
//       ret.push({
//         id: `${this.walletId}--${path}`,
//         name,
//         type: AccountType.UTXO,
//         path,
//         coinType: COIN_TYPE,
//         pub,
//         address: pub,
//         addresses: { [this.networkId]: addressOnNetwork },
//       });
//       index += 1;
//     }
//     return ret;
//   }
// }

import { KeyringHd as KeyringHdBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringHd';

export class KeyringHd extends KeyringHdBtcFork {}

