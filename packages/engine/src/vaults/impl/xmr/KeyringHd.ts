import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { mnemonicToSeedSync } from 'bip39';

import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';

import { getInstance } from './sdk/moneroCore/instance';
import { MoneroNetTypeEnum } from './sdk/moneroCore/moneroCoreTypes';
import { MoneroModule } from './sdk/moneroCore/monoreModule';
import { getKeyPairFromRawPrivatekey, getRawPrivateKeyFromSeed } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';

const HARDEN_PATH_PREFIX = `m/44'/${COIN_TYPE as string}'/0'/0`;
const ACCOUNT_NAME_PREFIX = 'XMR';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, indexes, names, template } = params;
    const network = await this.getNetwork();
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const instance = await getInstance();
    const xmrModule = new MoneroModule(instance);

    const mnemonic = mnemonicFromEntropy(entropy, password);
    const seed = mnemonicToSeedSync(mnemonic);
    const { pathPrefix } = slicePathTemplate(template);
    const rawPrivateKey = getRawPrivateKeyFromSeed(seed, pathPrefix);
    if (!rawPrivateKey) {
      throw new OneKeyInternalError('Unable to get raw private key.');
    }

    const ret = [];
    const impl = await this.getNetworkImpl();
    const { prefix } = getAccountNameInfoByTemplate(impl, template);
    for (const index of indexes) {
      const { publicSpendKey, publicViewKey, privateViewKey } =
        getKeyPairFromRawPrivatekey({
          xmrModule,
          rawPrivateKey,
          index,
        });

      if (!publicSpendKey || !publicViewKey) {
        throw new OneKeyInternalError('Unable to get public spend/view key.');
      }

      const path = `${pathPrefix}/${index}`;

      const address = xmrModule.pubKeysToAddress(
        network.isTestnet
          ? MoneroNetTypeEnum.TestNet
          : MoneroNetTypeEnum.MainNet,
        false,
        publicSpendKey,
        publicViewKey,
      );

      const name = (names || [])[index] || `${prefix} #${index + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub: `${Buffer.from(publicSpendKey).toString('hex')},${Buffer.from(
          publicViewKey,
        ).toString('hex')}`,
        privateViewKey: Buffer.from(privateViewKey).toString('hex'),
        address: '',
        addresses: { [this.networkId]: address },
      });
    }
    return ret;
  }
}
