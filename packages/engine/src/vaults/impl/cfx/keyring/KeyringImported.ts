import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_CFX as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { ChainSigner, Verifier } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringImportedBase } from '../../../keyring/KeyringImportedBase';
import { pubkeyToAddress, signTransactionWithSigner } from '../utils';

import { CURVE_NAME } from './constant';

import type { DBVariantAccount } from '../../../../types/account';
import type {
  IPrepareImportedAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../../types';

export class KeyringImported extends KeyringImportedBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const selectedAddress = dbAccount.addresses[this.networkId];

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('CFX signers number should be 1.');
    } else if (addresses[0] !== selectedAddress) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const [privateKey] = Object.values(await this.getPrivateKeys({ password }));

    return {
      [selectedAddress]: new ChainSigner(privateKey, password, CURVE_NAME),
    };
  }

  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { name, privateKey } = params;
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey).toString('hex');
    // TODO: remove addressFromPub & addressToBase from proxy.ts
    const chainId = await this.vault.getNetworkChainId();
    const addressOnNetwork = await pubkeyToAddress(
      new Verifier(pub, CURVE_NAME),
      chainId,
    );
    const baseAddress = await this.vault.addressToBase(addressOnNetwork);
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${pub}`,
        name: name || '',
        type: AccountType.VARIANT,
        path: '',
        coinType: COIN_TYPE,
        pub,
        address: baseAddress,
        addresses: { [this.networkId]: addressOnNetwork },
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

    return signTransactionWithSigner(unsignedTx, signer);
  }
}
