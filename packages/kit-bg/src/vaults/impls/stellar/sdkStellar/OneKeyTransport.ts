/* eslint-disable spellcheck/spell-checker */

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

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
    params?: unknown[];
    path?: string; // Horizon API path, e.g., '/accounts/:account_id'
  }): Promise<T> {
    const res: T[] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
        networkId: this.networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: input.method,
              params: input.params ?? [],
              path: input.path,
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
   * getHealth - Get node health status
   * Proxied through OneKey servers
   */
  async getHealth(): Promise<{ status: string }> {
    return this.request({
      method: 'GET',
      path: '/health',
    });
  }

  /**
   * getLatestLedger - Get the most recent known ledger
   * Proxied through OneKey servers
   */
  async getLatestLedger(): Promise<{
    id: string;
    sequence: number;
    closeTime: string;
    headerXdr: string;
    metadataXdr: string;
  }> {
    return this.request({
      method: 'GET',
      path: '/ledgers',
      params: [{ order: 'desc', limit: 1 }],
    });
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
      method: 'POST',
      path: '/ledger_entries',
      params: [params],
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
      method: 'GET',
      path: '/fee_stats',
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
      method: 'POST',
      path: '/transactions',
      params: [{ tx: transaction }],
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
      method: 'GET',
      path: `/transactions/${hash}`,
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
      method: 'POST',
      path: '/simulate_transaction',
      params: [{ transaction }],
    });
  }

  /**
   * getNetwork - Obtain network configuration
   * Proxied through OneKey servers
   */
  async getNetwork(): Promise<{
    friendbotUrl?: string;
    passphrase: string;
    protocolVersion: number;
  }> {
    return this.request({
      method: 'GET',
      path: '/network',
    });
  }

  /**
   * getVersionInfo - Access version information
   * Proxied through OneKey servers
   */
  async getVersionInfo(): Promise<{
    version: string;
    commit_hash: string;
    build_timestamp: string;
    captive_core_version: string;
    protocol_version: number;
  }> {
    return this.request({
      method: 'GET',
      path: '/version',
    });
  }

  /**
   * getEvents - Retrieve contract events
   * Proxied through OneKey servers
   */
  async getEvents(params: {
    startLedger: number;
    filters?: Array<{
      type?: string;
      contractIds?: string[];
      topics?: Array<string[]>;
    }>;
    pagination?: {
      cursor?: string;
      limit?: number;
    };
  }): Promise<{
    events: any[];
    latestLedger: number;
    cursor?: string;
  }> {
    return this.request({
      method: 'POST',
      path: '/events',
      params: [params],
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
    return this.request({
      method: 'GET',
      path: `/accounts/${address}`,
    });
  }
}
