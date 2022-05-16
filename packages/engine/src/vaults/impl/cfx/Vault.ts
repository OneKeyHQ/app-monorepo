/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Conflux } from '@onekeyfe/blockchain-libs/dist/provider/chains/cfx/conflux';
import { batchGetPublicKeys } from '@onekeyfe/blockchain-libs/dist/secret';
import { secp256k1 } from '@onekeyfe/blockchain-libs/dist/secret/curves';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_CFX as COIN_TYPE } from '../../../constants';
import { ExportedSeedCredential } from '../../../dbs/base';
import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { extractResponseError, fillUnsignedTx } from '../../../proxy';
import {
  Account,
  AccountType,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import {
  IApproveInfo,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IPrepareHardwareAccountsParams,
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  private async getJsonRPCClient(): Promise<Conflux> {
    return (await this.engine.providerManager.getClient(
      this.networkId,
    )) as Conflux;
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    throw new Error('Method not implemented.');
  }

  decodeTx(encodedTx: IEncodedTxAny, payload?: any): Promise<any> {
    throw new NotImplemented();
  }

  buildEncodedTxFromTransfer(transferInfo: ITransferInfo): Promise<any> {
    throw new Error('Method not implemented.');
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTxAny,
    amount: string,
  ): Promise<IEncodedTxAny> {
    throw new Error('Method not implemented.');
  }

  buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<UnsignedTx> {
    throw new Error('Method not implemented.');
  }

  fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    throw new Error('Method not implemented.');
  }

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

  private async _correctDbAccountAddress(dbAccount: DBAccount) {
    dbAccount.address = await this.engine.providerManager.selectAccountAddress(
      this.networkId,
      dbAccount,
    );
  }

  async simpleTransfer(
    payload: {
      to: string;
      value: string;
      tokenIdOnNetwork?: string;
      extra?: { [key: string]: any };
      gasPrice: string; // TODO remove gasPrice
      gasLimit: string;
    },
    options: ISignCredentialOptions,
  ) {
    debugLogger.engine('CFX simpleTransfer', payload);
    const { to, value, tokenIdOnNetwork, extra, gasLimit, gasPrice } = payload;
    const { networkId } = this;
    const network = await this.getNetwork();
    const dbAccount = await this.getDbAccount();
    // TODO what's this mean: correctDbAccountAddress
    await this._correctDbAccountAddress(dbAccount);
    const token = await this.engine.getOrAddToken(
      networkId,
      tokenIdOnNetwork ?? '',
      true,
    );
    const valueBN = new BigNumber(value);
    const extraCombined = {
      ...extra,
      feeLimit: new BigNumber(gasLimit),
      feePricePerUnit: new BigNumber(gasPrice),
    };
    // TODO buildUnsignedTx
    const unsignedTx = await this.engine.providerManager.buildUnsignedTx(
      networkId,
      fillUnsignedTx(network, dbAccount, to, valueBN, token, extraCombined),
    );
    return this.signAndSendTransaction(unsignedTx, options);
  }

  async updateEncodedTx(
    encodedTx: IEncodedTxAny,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxAny> {
    throw new Error('Method not implemented.');
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const ret = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.addresses?.[this.networkId] || '',
    };
    if (ret.address.length === 0) {
      // TODO: remove selectAccountAddress from proxy
      const address = await this.engine.providerManager.selectAccountAddress(
        this.networkId,
        dbAccount,
      );
      await this.engine.dbApi.addAccountAddress(
        dbAccount.id,
        this.networkId,
        address,
      );
      ret.address = address;
    }
    return ret;
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  // Chain only functionalities below.

  override async prepareWatchingAccount(
    target: string,
    name: string,
  ): Promise<DBVariantAccount> {
    // TODO: remove addressToBase from proxy.ts
    const address = await this.engine.providerManager.addressToBase(
      this.networkId,
      target,
    );
    return {
      id: `watching--${COIN_TYPE}--${address}`,
      name: name || '',
      type: AccountType.VARIANT,
      path: '',
      coinType: COIN_TYPE,
      pub: '', // TODO: only address is supported for now.
      address,
      addresses: { [this.networkId]: target },
    };
  }

  override async prepareImportedAccount(
    privateKey: Buffer,
    name: string,
  ): Promise<DBVariantAccount> {
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = secp256k1.publicFromPrivate(privateKey).toString('hex');
    // TODO: remove addressFromPub & addressToBase from proxy.ts
    const addressOnNetwork = await this.engine.providerManager.addressFromPub(
      this.networkId,
      pub,
    );
    const baseAddress = await this.engine.providerManager.addressToBase(
      this.networkId,
      addressOnNetwork,
    );
    return Promise.resolve({
      id: `imported--${COIN_TYPE}--${pub}`,
      name: name || '',
      type: AccountType.VARIANT,
      path: '',
      coinType: COIN_TYPE,
      pub,
      address: baseAddress,
      addresses: { [this.networkId]: addressOnNetwork },
    });
  }

  override async prepareSoftwareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    const { walletId, password, indexes, names } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      walletId,
      password,
    )) as ExportedSeedCredential;

    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      "m/44'/503'/0'/0", // TODO: constant
      indexes.map((index) => index.toString()),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pub = pubkey.toString('hex');
      const addressOnNetwork = await this.engine.providerManager.addressFromPub(
        this.networkId,
        pub,
      );
      const baseAddress = await this.engine.providerManager.addressToBase(
        this.networkId,
        addressOnNetwork,
      );
      const name = (names || [])[index] || `CFX #${indexes[index] + 1}`;
      ret.push({
        id: `${walletId}--${path}`,
        name,
        type: AccountType.VARIANT,
        path,
        coinType: COIN_TYPE,
        pub,
        address: baseAddress,
        addresses: { [this.networkId]: addressOnNetwork },
      });
      index += 1;
    }
    return ret;
  }

  override async prepareHardwareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBVariantAccount>> {
    throw new NotImplemented();
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getJsonRPCClient();
    try {
      return await client.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  createClientFromURL(url: string): Conflux {
    return new Conflux(url);
  }
}
