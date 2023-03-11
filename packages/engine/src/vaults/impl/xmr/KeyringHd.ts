import LWSClient from '@mymonero/mymonero-lws-client';
import axios from 'axios';
import { mnemonicFromEntropy } from '@onekeyfe/blockchain-libs/dist/secret';
import { mnemonicToSeedSync } from 'bip39';

import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { getMoneroApi } from './sdk';
import { MoneroNetTypeEnum } from './sdk/moneroUtil/moneroUtilTypes';
import { getRawPrivateKeyFromSeed } from './utils';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type { SignedTx } from '../../../types/provider';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxXmr, ISendFundsArgs } from './types';

const walletUrl = 'https://node.onekey.so/mymonero';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, names, template } = params;

    // only support primary address for now
    const indexes = [0];

    const network = await this.getNetwork();
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const moneroApi = await getMoneroApi();

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
      const { publicSpendKey, publicViewKey } =
        await moneroApi.getKeyPairFromRawPrivatekey({
          rawPrivateKey,
          index,
        });

      if (!publicSpendKey || !publicViewKey) {
        throw new OneKeyInternalError('Unable to get public spend/view key.');
      }

      const path = `${pathPrefix}/${index}`;

      const address = moneroApi.pubKeysToAddress(
        network.isTestnet
          ? MoneroNetTypeEnum.TestNet
          : MoneroNetTypeEnum.MainNet,
        index !== 0,
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
        address: '',
        addresses: { [this.networkId]: address },
      });
    }
    console.log(ret);
    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const moneroApi = await getMoneroApi();
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      options.password || '',
    )) as ExportedSeedCredential;

    const mnemonic = mnemonicFromEntropy(entropy, options.password || '');
    const seed = mnemonicToSeedSync(mnemonic);
    const { pathPrefix } = slicePathTemplate(dbAccount.template as string);
    const rawPrivateKey = getRawPrivateKeyFromSeed(seed, pathPrefix);
    if (!rawPrivateKey) {
      throw new OneKeyInternalError('Unable to get raw private key.');
    }

    const { publicSpendKey, privateViewKey, privateSpendKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey,
      });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    const sendFundsArgs: ISendFundsArgs = {
      destinations: encodedTx.destinations,
      from_address_string: encodedTx.address,
      is_sweeping: encodedTx.shouldSweep,
      nettype: encodedTx.nettype,
      priority: encodedTx.priority,

      pub_spendKey_string: Buffer.from(publicSpendKey || []).toString('hex'),
      sec_spendKey_string: Buffer.from(privateSpendKey).toString('hex'),
      sec_viewKey_string: Buffer.from(privateViewKey || []).toString('hex'),

      fromWallet_didFailToBoot: false,
      fromWallet_didFailToInitialize: false,
      fromWallet_needsImport: false,
      hasPickedAContact: false,
      manuallyEnteredPaymentID: '',
      manuallyEnteredPaymentID_fieldIsVisible: false,
      requireAuthentication: false,
      resolvedAddress: '',
      resolvedAddress_fieldIsVisible: false,
      resolvedPaymentID: '',
      resolvedPaymentID_fieldIsVisible: false,
    };
    const signedTx = await moneroApi.sendFunds(sendFundsArgs);
    return signedTx;
  }
}
