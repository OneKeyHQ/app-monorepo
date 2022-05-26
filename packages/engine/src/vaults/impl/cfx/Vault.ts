/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { Conflux } from '@onekeyfe/blockchain-libs/dist/provider/chains/cfx/conflux';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented, OneKeyInternalError } from '../../../errors';
import { extractResponseError, fillUnsignedTx } from '../../../proxy';
import { Account, DBAccount, DBVariantAccount } from '../../../types/account';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  settings = settings;

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

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    throw new NotImplemented();
  }

  decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    throw new NotImplemented();
  }

  buildEncodedTxFromTransfer(transferInfo: ITransferInfo): Promise<any> {
    throw new Error('Method not implemented.');
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
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
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
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

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
