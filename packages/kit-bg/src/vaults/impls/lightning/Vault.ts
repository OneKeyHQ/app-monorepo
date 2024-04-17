/* eslint-disable @typescript-eslint/no-unused-vars */
import { sha256 } from '@noble/hashes/sha256';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientLightning from './sdkLightning/ClientLightning';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  async getClient() {
    return this.getClientCache();
  }

  private getClientCache = memoizee(
    async () => {
      const network = await this.getNetwork();
      const _client = await this.backgroundApi.serviceLightning.getClient();
      return new ClientLightning(
        this.backgroundApi,
        _client,
        network.isTestnet,
      );
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;

    return Promise.resolve({
      isValid: true,
      networkId,
      address: '',
      baseAddress: '',
      normalizedAddress: account.address,
      displayAddress: '',
      allowEmptyAddress: true,
    });
  }

  override async getAccountAddress(): Promise<string> {
    return Promise.resolve(
      (await this.getAccount()).addressDetail.normalizedAddress,
    );
  }

  override buildEncodedTx(params: IBuildEncodedTxParams): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
  }

  override buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const { isTestnet } = await this.getNetwork();
    return validateBtcAddress({
      network: getBtcForkNetwork(isTestnet ? IMPL_TBTC : IMPL_BTC),
      address,
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new Error('Method not implemented.');
  }

  override validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new Error('Method not implemented.');
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new Error('Method not implemented.');
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new Error('Method not implemented.');
  }

  async exchangeToken(account?: INetworkAccount) {
    const { isTestnet } = await this.getNetwork();
    const usedAccount = account || (await this.getAccount());
    const address = usedAccount.addressDetail.normalizedAddress;
    const hashPubKey = bufferUtils.bytesToHex(sha256(usedAccount.pub ?? ''));
    let password = '';
    if (accountUtils.isHdWallet({ walletId: this.walletId })) {
      const ret =
        await this.backgroundApi.servicePassword.promptPasswordVerify();
      password = ret.password;
    }
    const client = await this.getClient();
    const signTemplate = await client.fetchSignTemplate(address, 'auth');
    if (signTemplate.type !== 'auth') {
      throw new Error('Invalid auth sign template');
    }
    const timestamp = Date.now();
    const keyring = this.keyring as KeyringHd;
    let connectId;
    let deviceId;
    let deviceCommonParams;
    if (accountUtils.isHwWallet({ walletId: this.walletId })) {
      const { dbDevice, deviceCommonParams: _deviceCommonParams } =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId: this.walletId,
        });
      connectId = dbDevice.connectId;
      deviceId = dbDevice.deviceId;
      deviceCommonParams = _deviceCommonParams;
    }
    const sign = await keyring.signApiMessage({
      msgPayload: {
        ...signTemplate,
        pubkey: hashPubKey,
        address,
        timestamp,
      },
      address,
      path: accountUtils.buildLnToBtcPath({
        path: usedAccount.path,
        isTestnet,
      }),
      password,
      connectId,
      deviceId,
      deviceCommonParams,
    });
    const res = await client.refreshAccessToken({
      hashPubKey,
      address,
      signature: sign,
      timestamp,
      randomSeed: signTemplate.randomSeed,
    });
    await this.backgroundApi.simpleDb.lightning.updateCredential({
      address,
      credential: res.accessToken,
    });
    return res;
  }
}
