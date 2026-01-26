import { Keypair, StellarSdk } from '.';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import type { IJsonRpcParams } from '@onekeyhq/shared/src/request/JsonRPCRequest';

import type { ISimulateTransactionResponse } from './types';

/**
 * OneKey Stellar RPC Transport
 * Proxies all Horizon API requests through OneKey servers
 */
export class OneKeyTransport {
  backgroundApi: IBackgroundApi;

  networkId: string;

  constructor({
    backgroundApi,
    networkId,
  }: {
    backgroundApi: IBackgroundApi;
    networkId: string;
  }) {
    this.backgroundApi = backgroundApi;
    this.networkId = networkId;
  }

  /**
   * Send RPC request through OneKey proxy
   */
  private async request<T>(input: {
    method: string;
    params?: IJsonRpcParams;
  }): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: input.method,
              params: input.params,
            },
          },
        ],
      });

    const response = res?.[0];
    if (!response) {
      throw new OneKeyLocalError('No response received from Stellar proxy');
    }

    return response;
  }

  /**
   * getLedgerEntries - Access live on-chain state
   * Proxied through OneKey servers
   */
  async getLedgerEntries(
    keys: string[],
    xdrFormat?: 'base64' | 'json',
  ): Promise<{
    latestLedger: number;
    entries: Array<{
      key: string;
      xdr: string;
      lastModifiedLedgerSeq: number;
      liveUntilLedgerSeq?: number;
    }>;
  }> {
    const params: Record<string, unknown> = { keys };
    if (xdrFormat) {
      params.xdrFormat = xdrFormat;
    }
    return this.request({
      method: 'getLedgerEntries',
      params,
    });
  }

  /**
   * getFeeStats - Get statistics about inclusion fees for transactions
   * Proxied through OneKey servers
   */
  async getFeeStats(): Promise<{
    sorobanInclusionFee: {
      min: string;
      max: string;
      mode: string;
      p10: string;
      p20: string;
      p30: string;
      p40: string;
      p50: string;
      p60: string;
      p70: string;
      p80: string;
      p90: string;
      p95: string;
      p99: string;
    };
    inclusionFee: {
      min: string;
      max: string;
      mode: string;
      p10: string;
      p20: string;
      p30: string;
      p40: string;
      p50: string;
      p60: string;
      p70: string;
      p80: string;
      p90: string;
      p95: string;
      p99: string;
    };
    latestLedger: number;
  }> {
    return this.request({
      method: 'getFeeStats',
    });
  }

  /**
   * sendTransaction - Submit a transaction to the network
   * Proxied through OneKey servers
   */
  async sendTransaction(transaction: string): Promise<{
    hash: string;
    status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';
    latestLedger: number;
    latestLedgerCloseTime: string;
    errorResultXdr?: string;
    diagnosticEventsXdr?: string[];
  }> {
    return this.request({
      method: 'sendTransaction',
      params: { transaction },
    });
  }

  /**
   * getTransaction - Get details for a specific transaction
   * Proxied through OneKey servers
   */
  async getTransaction(hash: string): Promise<{
    status: 'SUCCESS' | 'NOT_FOUND' | 'FAILED';
    latestLedger: number;
    latestLedgerCloseTime: string;
    oldestLedger?: number;
    oldestLedgerCloseTime?: string;
    applicationOrder?: number;
    envelopeXdr?: string;
    resultXdr?: string;
    resultMetaXdr?: string;
    ledger?: number;
    createdAt?: string;
  }> {
    return this.request({
      method: 'getTransaction',
      params: { hash },
    });
  }

  /**
   * simulateTransaction - Test a contract invocation without execution
   * Proxied through OneKey servers
   */
  async simulateTransaction(
    transaction: string,
  ): Promise<ISimulateTransactionResponse> {
    return this.request({
      method: 'simulateTransaction',
      params: { transaction },
    });
  }

  /**
   * getAccountInfo - Get account information (Horizon-specific helper)
   * This is a convenience method that maps to Horizon's /accounts endpoint
   */
  async getAccountInfo(address: string): Promise<{
    balance: string;
    sequence: string;
    subentry_count: number;
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>;
  }> {
    const baseAddress = StellarSdk.extractBaseAddress(address);
    const accountId = Keypair.fromPublicKey(baseAddress).xdrAccountId();
    const ledgerKey = StellarSdk.xdr.LedgerKey.account(
      new StellarSdk.xdr.LedgerKeyAccount({ accountId }),
    );

    const response = await this.getLedgerEntries([ledgerKey.toXDR('base64')]);

    if (!response.entries || response.entries.length === 0) {
      throw new OneKeyInternalError(`Account ${address} not found`);
    }

    // Decode the account data from XDR
    const accountData = StellarSdk.xdr.LedgerEntryData.fromXDR(
      response.entries[0].xdr,
      'base64',
    );

    const account = accountData.account();

    // Extract balance and account info
    const nativeBalance = account.balance().toBigInt().toString();
    const sequence = account.seqNum().toString();
    const subentryCount = account.numSubEntries();

    console.log('=====>>>>> getAccountInfo: ', {
      nativeBalance,
      sequence,
      subentryCount,
    });

    // Note: Account entry does NOT contain trustlines
    // Trustlines are separate ledger entries that must be queried individually
    const balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }> = [
      {
        asset_type: 'native',
        balance: nativeBalance,
      },
    ];

    return {
      balance: nativeBalance,
      sequence,
      subentry_count: subentryCount,
      balances,
    };
  }
}
