import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import { COINTYPE_ETH as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../../errors';
import { Signer, Verifier } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';

import type { DBSimpleAccount } from '../../../../types/account';
import type { IPrepareImportedAccountsParams } from '../../../types';
import { pubkeyToAddress } from '../utils';

type Curve = 'secp256k1' | 'ed25519';

export class KeyringImported extends KeyringImportedBase {
  async getVerifier(pub: string): Promise<Verifier> {
    const provider =
      await this.vault.engine.providerManager.getChainInfoByNetworkId(
        this.networkId,
      );
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }

    return new Verifier(pub, provider.curve as Curve);
  }

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

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey).toString('hex');
    // TODO: remove addressFromPub from proxy.ts
    const address = await pubkeyToAddress(await this.getVerifier(pub));
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.SIMPLE,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address,
      },
    ]);
  }
}
