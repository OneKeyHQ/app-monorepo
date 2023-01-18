import { CoinType, newSecp256k1Address } from '@glif/filecoin-address';

import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_FIL as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

import { signTransaction } from './utils';

import type { DBVariantAccount } from '../../../types/account';
import type { SignedTx } from '../../../types/provider';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('FIL signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, privateKey } = params;
    const network = await this.getNetwork();
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey);
    const pubUncompressed = secp256k1.transformPublicKey(pub);
    const pubHex = pub.toString('hex');

    const address = newSecp256k1Address(
      pubUncompressed,
      network.isTestnet ? CoinType.TEST : CoinType.MAIN,
    ).toString();

    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pubHex}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub: pubHex,
        address,
        addresses: { [this.networkId]: address },
      },
    ]);
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const selectedAddress = (dbAccount as DBVariantAccount).addresses[
      this.networkId
    ];

    const signers = await this.getSigners(options.password || '', [
      selectedAddress,
    ]);
    const signer = signers[selectedAddress];

    return signTransaction(unsignedTx, signer);
  }
}
