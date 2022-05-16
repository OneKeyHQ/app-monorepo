import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { KeyringImportedBase } from '../../keyring/KeyringImportedBase';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('EVM signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys(password));

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
    };
  }
}
