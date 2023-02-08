import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { fromSeed } from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import sha3 from 'js-sha3';

import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';
import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { Signer } from '../../../proxy';
import { AccountType } from '../../../types/account';

import { calcBip32ExtendedKey } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, indexes, names } = params;

    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const mnemonic = mnemonicFromEntropy(entropy, password);
    const seed = mnemonicToSeedSync(mnemonic);
    const rootKey = fromSeed(seed, {
      messagePrefix: 'x18XMR Signed Message:\n',
      bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
      },
      pubKeyHash: 0x7f,
      scriptHash: 0xc4,
      wif: 0x3f,
    });

    const extendedKey = calcBip32ExtendedKey(HARDEN_PATH_PREFIX, rootKey);
    const key = extendedKey.derive(0);
    const rawPrivateKey = key.privateKey;

    if (!rawPrivateKey) {
      throw new OneKeyInternalError('Unable to get raw private key.');
    }

    const rawSecretSpendKey = sha3.keccak_256.update(rawPrivateKey).digest();
    // const secretSpendKey = XMRModule.lib.sc_reduce32(rawSecretSpendKey);
    // const secretViewKey = XMRModule.lib.hash_to_scalar(secretSpendKey);
    // const publicSpendKey =
    //   XMRModule.lib.secret_key_to_public_key(secretSpendKey);
    // const publicViewKey = XMRModule.lib.secret_key_to_public_key(secretViewKey);
    return [];
  }
}
