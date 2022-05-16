import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { DBVariantAccount } from '../../../types/account';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('CFX signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }
}
