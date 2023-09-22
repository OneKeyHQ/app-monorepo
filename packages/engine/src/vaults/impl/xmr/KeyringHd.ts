import { getMoneroApi } from '@onekeyhq/core/src/chains/xmr/sdkXmr';
import { MoneroNetTypeEnum } from '@onekeyhq/core/src/chains/xmr/sdkXmr/moneroUtil/moneroUtilTypes';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { COINTYPE_XMR as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { batchGetPrivateKeys } from '../../../secret';
import { AccountType } from '../../../types/account';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { ChainSigner } from '../../../proxy';
import type { DBSimpleAccount, DBVariantAccount } from '../../../types/account';
import type { IUnsignedMessageCommon } from '../../../types/message';
import type { SignedTx } from '../../../types/provider';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type { IClientApi, IEncodedTxXmr, ISendFundsArgs } from './types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.xmr.hd;

  override getSigners(): Promise<Record<string, ChainSigner>> {
    throw new Error('getSigners moved to core.');
  }

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    return this.basePrepareAccountsHd(params, {
      accountType: AccountType.VARIANT,
      usedIndexes: params.indexes,
    });
  }

  override async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    return this.signTransactionOld(unsignedTx, options);
    // return this.baseSignTransaction(unsignedTx, options);
  }

  override async signMessage(
    messages: IUnsignedMessageCommon[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  async prepareAccountsOld(
    params: IPrepareHdAccountsParams,
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
          rawPrivateKey: bufferUtils.bytesToHex(rawPrivateKey),
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
        bufferUtils.toBuffer(publicSpendKey),
        bufferUtils.toBuffer(publicViewKey),
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

  async signTransactionOld(
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
        rawPrivateKey: bufferUtils.bytesToHex(rawPrivateKey),
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

      pub_spendKey_string: publicSpendKey || '',
      sec_spendKey_string: privateSpendKey,
      sec_viewKey_string: privateViewKey,

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
