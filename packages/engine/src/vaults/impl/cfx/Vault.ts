/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { Conflux, address as confluxAddress } from 'js-conflux-sdk';
import memoizee from 'memoizee';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
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
  IUnsignedTxPro,
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

  getClientCache = memoizee(
    async (rpcUrl, chainId) => this.getConfluxClient(rpcUrl, chainId),
    {
      promise: true,
      max: 1,
    },
  );

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const chainId = await this.getNetworkChainId();
    return this.getClientCache(rpcURL, chainId);
  }

  getConfluxClient(url: string, chainId: string) {
    return new Conflux({
      url,
      networkId: Number(chainId),
    });
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

  buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  async fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    throw new Error('Method not implemented.');
  }

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented.');
  }

  override async getOutputAccount(): Promise<Account> {
    const dbAccount = (await this.getDbAccount({
      noCache: true,
    })) as DBVariantAccount;
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

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    const { address } = await this.getOutputAccount();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
    );
  }

  override async validateAddress(address: string): Promise<string> {
    const isValid = confluxAddress.isValidCfxAddress(address);
    const normalizedAddress = isValid ? address.toLowerCase() : undefined;

    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  // Chain only functionalities below.

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getClient();
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return client.request(request);
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override createClientFromURL(_url: string): BaseClient {
    throw new NotImplemented();
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
