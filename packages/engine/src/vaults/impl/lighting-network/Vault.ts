/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import {
  InsufficientBalance,
  InvalidAddress,
  WrongPassword,
} from '../../../errors';
import {
  type IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  type IEncodedTx,
  type ITransferInfo,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import ClientLighting from './helper/clientLighting';
import { signature } from './helper/signature';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type {
  Account,
  DBAccount,
  DBVariantAccount,
} from '../../../types/account';
import type { IDecodedTxLegacy, IFeeInfo } from '../../types';
import type { IEncodedTxLighting } from './types';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  async getClient(
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    return this.getClientCache(password, passwordLoadedCallback);
  }

  // client: axios
  private getClientCache = memoizee(
    (password?: string, passwordLoadedCallback?: (isLoaded: boolean) => void) =>
      new ClientLighting(async () =>
        this.exchangeToken(password, passwordLoadedCallback),
      ),
    {
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  private async exchangeToken(
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    try {
      const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
      const address = dbAccount.addresses.normalizedAddress;
      const hashPubKey = bytesToHex(sha256(dbAccount.pub));
      const { entropy } = (await this.engine.dbApi.getCredential(
        this.walletId,
        password ?? '',
      )) as ExportedSeedCredential;
      const sign = await signature({
        msgPayload: {
          type: 'register',
          pubkey: hashPubKey,
          address,
        },
        engine: this.engine,
        path: dbAccount.addresses.realPath,
        password: password ?? '',
        entropy,
      });
      passwordLoadedCallback?.(true);
      return {
        hashPubKey,
        address,
        signature: sign,
      };
    } catch (e) {
      if (e instanceof WrongPassword) {
        passwordLoadedCallback?.(false);
      }
      throw e;
    }
  }

  override addressFromBase(account: DBAccount): Promise<string> {
    return Promise.resolve('');
  }

  override getFetchBalanceAddress(account: DBVariantAccount): Promise<string> {
    return Promise.resolve(account.addresses.normalizedAddress);
  }

  async getCurrentBalanceAddress(): Promise<string> {
    const account = (await this.getDbAccount()) as DBVariantAccount;
    return account.addresses.normalizedAddress;
  }

  override async validateAddress(address: string): Promise<string> {
    try {
      await this._decodedInvoceCache(address);
      return address;
    } catch (e) {
      throw new InvalidAddress();
    }
  }

  _decodedInvoceCache = memoizee(
    async (invoice: string) => {
      const client = await this.getClient();
      return client.decodedInvoice(invoice);
    },
    {
      maxAge: getTimeDurationMs({ seconds: 30 }),
    },
  );

  override async fetchFeeInfo(
    encodedTx: IEncodedTxLighting,
  ): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    return {
      customDisabled: true,
      limit: new BigNumber(encodedTx.fee ?? '0').toFixed(),
      prices: ['1'],
      defaultPresetIndex: '0',
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null,
    };
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxLighting> {
    console.log('====>: ', transferInfo);
    const invoice = await this._decodedInvoceCache(transferInfo.to);
    console.log('====> invoice: ', invoice);
    const balanceAddress = await this.getCurrentBalanceAddress();
    const balance = await this.getBalances([{ address: balanceAddress }]);
    const balanceBN = new BigNumber(balance[0] || '0');
    const amount = invoice.millisatoshis
      ? new BigNumber(invoice.millisatoshis).dividedBy(1000)
      : new BigNumber(invoice.satoshis ?? '0');
    // if (balanceBN.isLessThan(amount)) {
    //   throw new InsufficientBalance();
    // }
    // if (!invoice.paymentRequest) {
    //   throw new Error('Invalid invoice');
    // }

    const client = await this.getClient();
    const nonce = await client.getNextNonce(balanceAddress);
    const description = invoice.tags.find(
      (tag) => tag.tagName === 'description',
    );
    return {
      invoice: invoice.paymentRequest,
      amount: amount.toFixed(),
      expired: `${invoice.timeExpireDate ?? ''}`,
      created: `${Date.now()}`,
      nonce,
      description: description?.data as string,
      fee: 0,
    };
  }

  override async decodeTx(
    encodedTx: IEncodedTxLighting,
    payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let extraInfo = null;
    if (encodedTx.description) {
      extraInfo = {
        memo: encodedTx.description,
      };
    }
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: dbAccount.name,
      signer: '',
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          nativeTransfer: {
            tokenInfo: token,
            from: dbAccount.name,
            to: '',
            amount: new BigNumber(encodedTx.amount).toFixed(),
            amountValue: encodedTx.amount,
            extraInfo: null,
          },
          direction: IDecodedTxDirection.OUT,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      encodedTx,
      payload,
      extraInfo,
    };

    return decodedTx;
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async getAccountBalance(
    tokenIds: string[],
    withMain?: boolean,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ): Promise<(BigNumber | undefined)[]> {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const account = (await this.getDbAccount()) as DBVariantAccount;
    const [mainBalance] = await this.getBalances(
      [
        {
          address: account.addresses.normalizedAddress,
        },
      ],
      password,
      passwordLoadedCallback,
    );
    return [mainBalance].concat(ret);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ): Promise<(BigNumber | undefined)[]> {
    const result = await Promise.all(
      requests.map(async ({ address }) => {
        const client = await this.getClient(password);
        return client.getBalance(address);
      }),
    );
    return result;
  }

  async createInvoice(
    amount: string,
    description?: string,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    const client = await this.getClient(password);
    const address = await this.getCurrentBalanceAddress();
    return client.createInvoice(address, amount, description);
  }
}
