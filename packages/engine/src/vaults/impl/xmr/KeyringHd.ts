import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { batchGetPrivateKeys } from '../../../secret';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { getMoneroApi } from './sdk';
import { MoneroNetTypeEnum } from './sdk/moneroUtil/moneroUtilTypes';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { DBVariantAccount } from '../../../types/account';
import type { SignedTx } from '../../../types/provider';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  IUnsignedTxPro,
} from '../../types';
import type { IClientApi, IEncodedTxXmr, ISendFundsArgs } from './types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { password, names, template } = params;

    // only support primary address for now
    const indexes = [0];

    const network = await this.getNetwork();
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const moneroApi = await getMoneroApi();

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const [privateKeyInfo] = batchGetPrivateKeys(
      'ed25519',
      seed,
      password,
      pathPrefix,
      [pathSuffix.replace('{index}', '0')],
    );

    const rawPrivateKey = decrypt(password, privateKeyInfo.extendedKey.key);

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

      const path = `${pathPrefix}/${pathSuffix.replace(
        '{index}',
        index.toString(),
      )}`;

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
    return ret;
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const { password = '' } = options;
    const dbAccount = await this.getDbAccount();
    const moneroApi = await getMoneroApi();
    const clientApi = await this.getClientApi<IClientApi>();
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix, pathSuffix } = slicePathTemplate(
      dbAccount.template as string,
    );

    const [privateKeyInfo] = batchGetPrivateKeys(
      'ed25519',
      seed,
      password,
      pathPrefix,
      [pathSuffix.replace('{index}', '0')],
    );

    const rawPrivateKey = decrypt(password, privateKeyInfo.extendedKey.key);

    if (!rawPrivateKey) {
      throw new OneKeyInternalError('Unable to get raw private key.');
    }

    const { publicSpendKey, privateViewKey, privateSpendKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey,
      });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    let destinations = [...encodedTx.destinations];

    if (encodedTx.shouldSweep) {
      destinations = destinations.map((destination) => ({
        to_address: destination.to_address,
        send_amount: '0',
      }));
    }

    const sendFundsArgs: ISendFundsArgs = {
      destinations,
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
    const signedTx = await moneroApi.sendFunds(
      sendFundsArgs,
      clientApi.mymonero,
    );
    return signedTx;
  }
}
