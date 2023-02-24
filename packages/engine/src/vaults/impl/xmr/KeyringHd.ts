import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { fromSeed } from 'bip32';
import { mnemonicToSeedSync } from 'bip39';
import sha3 from 'js-sha3';

import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';

import { getInstance } from './sdk/instance';
import { calcBip32ExtendedKey } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

import type { XMRModule } from './types';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;
const ACCOUNT_NAME_PREFIX = 'XMR';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, indexes, names } = params;
    const network = await this.getNetwork();
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const inst = await getInstance();

    console.log(inst);

    debugger;

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

    const rawSecretSpendKey = new Uint8Array(
      sha3.keccak_256.update(rawPrivateKey).arrayBuffer(),
    );
    let secretSpendKey = xmrModule.lib.sc_reduce32(rawSecretSpendKey);
    const secretViewKey = xmrModule.lib.hash_to_scalar(secretSpendKey);

    let publicSpendKey = new Uint8Array();
    let publicViewKey = new Uint8Array();

    const ret = [];
    for (const index of indexes) {
      if (index === 0) {
        publicSpendKey = xmrModule.lib.secret_key_to_public_key(secretSpendKey);
        publicViewKey = xmrModule.lib.secret_key_to_public_key(secretViewKey);
      } else {
        const m = xmrModule.lib.get_subaddress_secret_key(
          secretViewKey,
          0,
          index,
        );
        secretSpendKey = xmrModule.lib.sc_add(m, secretSpendKey);
        publicSpendKey = xmrModule.lib.secret_key_to_public_key(secretSpendKey);
        publicViewKey = xmrModule.lib.scalarmultKey(
          publicSpendKey,
          secretViewKey,
        );
      }

      const path = `${HARDEN_PATH_PREFIX}/${index}`;

      const address = xmrModule.lib.pub_keys_to_address(
        network.isTestnet
          ? xmrModule.lib.MONERO_TESTNET
          : xmrModule.lib.MONERO_MAINNET,
        index !== 0,
        publicSpendKey,
        publicViewKey,
      );

      const name =
        (names || [])[index] || `${ACCOUNT_NAME_PREFIX} #${index + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: `${Buffer.from(publicSpendKey).toString('hex')},${Buffer.from(
          publicViewKey,
        ).toString('hex')}`,
        address: '',
        addresses: { [this.networkId]: address },
      });
    }
    return ret;
  }
}
