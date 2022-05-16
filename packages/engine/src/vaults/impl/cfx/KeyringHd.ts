import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { DBVariantAccount } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('CFX signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return { [selectedAddress]: new Signer(privateKey, password, 'secp256k1') };
  }
}
