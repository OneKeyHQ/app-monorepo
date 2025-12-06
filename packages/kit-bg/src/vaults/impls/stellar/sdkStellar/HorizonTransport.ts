/* eslint-disable spellcheck/spell-checker */
import BigNumber from 'bignumber.js';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { SAC_TOKEN_ASSET_TYPES, SAC_TOKEN_DECIMALS } from '../utils';

interface IHorizonLedgerRecord {
  id: string;
  sequence: number;
  hash: string;
  closed_at: string;
  header_xdr: string;
}

type IHorizonLedgerResponse = IHorizonLedgerRecord & {
  _embedded?: {
    records?: IHorizonLedgerRecord[];
  };
};

interface IFeeStatsResponse {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: {
    max: string;
    min: string;
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
  max_fee: {
    max: string;
    min: string;
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
}

interface ISubmitTransactionResponse {
  hash: string;
  ledger: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
}

interface ITransactionResponse {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  successful: boolean;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
}

interface IAccountResponse {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
}

interface IRootResponse {
  network_passphrase: string;
  current_protocol_version: number;
  horizon_version: string;
  core_version?: string;
}

/**
 * Horizon API Transport
 * Directly connects to public Stellar Horizon REST API
 *
 * Horizon is Stellar's RESTful HTTP API server that provides access to:
 * - Account information and balances
 * - Transaction history
 * - Operations and effects
 * - Submit transactions
 * - Network statistics
 *
 * Official Documentation:
 * https://developers.stellar.org/docs/data/horizon
 */
export class HorizonTransport {
  private horizonUrl: string;

  constructor({
    horizonUrl,
    networkId,
  }: {
    horizonUrl?: string;
    networkId?: string;
  }) {
    // Use custom Horizon URL if provided, otherwise use public endpoints
    if (horizonUrl) {
      this.horizonUrl = horizonUrl;
    } else if (networkId?.includes('testnet')) {
      this.horizonUrl = 'https://horizon-testnet.stellar.org';
    } else {
      this.horizonUrl = 'https://horizon.stellar.org';
    }
  }

  /**
   * Make HTTP request to Horizon API
   */
  private async request<T>(input: {
    method: 'GET' | 'POST';
    path: string;
    params?: Record<string, string | number>;
    body?: string;
  }): Promise<T> {
    const { method, path, params, body } = input;

    let url = `${this.horizonUrl}${path}`;

    // Add query parameters for GET requests
    if (method === 'GET' && params) {
      const query = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ).toString();
      url = `${url}?${query}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type':
          method === 'POST'
            ? 'application/x-www-form-urlencoded'
            : 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OneKeyInternalError(
        `Horizon API error: ${response.status} - ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * getHealth - Get node health status
   * Horizon doesn't have a dedicated health endpoint, so we check root
   */
  async getHealth(): Promise<{ status: string }> {
    try {
      await this.request<Record<string, unknown>>({ method: 'GET', path: '/' });
      return { status: 'healthy' };
    } catch (error) {
      throw new OneKeyInternalError('Horizon API is unhealthy', error);
    }
  }

  /**
   * getLatestLedger - Get the most recent known ledger
   * https://developers.stellar.org/docs/data/horizon/api-reference/resources/ledgers/single
   */
  async getLatestLedger(): Promise<{
    id: string;
    sequence: number;
    closeTime: string;
    headerXdr: string;
    metadataXdr: string;
  }> {
    const response = await this.request<IHorizonLedgerResponse>({
      method: 'GET',
      path: '/ledgers',
      params: { order: 'desc', limit: 1 },
    });

    // Horizon returns {_embedded: {records: [...]}}
    const ledger = response._embedded?.records?.[0] ?? response;

    return {
      id: ledger.hash || ledger.id,
      sequence: ledger.sequence,
      closeTime: ledger.closed_at,
      headerXdr: ledger.header_xdr,
      metadataXdr: '', // Horizon doesn't provide metadataXdr
    };
  }

  /**
   * getFeeStats - Get statistics about inclusion fees for transactions
   * https://developers.stellar.org/docs/data/horizon/api-reference/resources/fee-stats
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
    const response = await this.request<IFeeStatsResponse>({
      method: 'GET',
      path: '/fee_stats',
    });

    // Map Horizon fee_charged to inclusionFee format
    return {
      sorobanInclusionFee: {
        min: '0',
        max: '0',
        mode: '0',
        p10: '0',
        p20: '0',
        p30: '0',
        p40: '0',
        p50: '0',
        p60: '0',
        p70: '0',
        p80: '0',
        p90: '0',
        p95: '0',
        p99: '0',
      },
      inclusionFee: response.fee_charged,
      latestLedger: parseInt(response.last_ledger, 10),
    };
  }

  /**
   * sendTransaction - Submit a transaction to the network
   * https://developers.stellar.org/docs/data/horizon/api-reference/resources/submit-transaction
   *
   * @param transaction - Base64-encoded TransactionEnvelope XDR
   */
  async sendTransaction(transaction: string): Promise<{
    hash: string;
    status: 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';
    latestLedger: number;
    latestLedgerCloseTime: string;
    errorResultXdr?: string;
    diagnosticEventsXdr?: string[];
  }> {
    interface SubmitTransactionResponse {
      hash: string;
      ledger: number;
      envelope_xdr: string;
      result_xdr: string;
      result_meta_xdr: string;
    }

    try {
      const response = await this.request<ISubmitTransactionResponse>({
        method: 'POST',
        path: '/transactions',
        body: `tx=${encodeURIComponent(transaction)}`,
      });

      return {
        hash: response.hash,
        status: 'PENDING',
        latestLedger: response.ledger,
        latestLedgerCloseTime: new Date().toISOString(),
      };
    } catch (error) {
      // Parse Horizon error response
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Horizon error';

      return {
        hash: '',
        status: 'ERROR',
        latestLedger: 0,
        latestLedgerCloseTime: new Date().toISOString(),
        errorResultXdr: errorMessage,
      };
    }
  }

  /**
   * getTransaction - Get details for a specific transaction
   * https://developers.stellar.org/docs/data/horizon/api-reference/resources/transactions/single
   *
   * @param hash - Transaction hash (hex string)
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
    try {
      const response = await this.request<ITransactionResponse>({
        method: 'GET',
        path: `/transactions/${hash}`,
      });

      return {
        status: response.successful ? 'SUCCESS' : 'FAILED',
        latestLedger: response.ledger,
        latestLedgerCloseTime: response.created_at,
        ledger: response.ledger,
        createdAt: response.created_at,
        envelopeXdr: response.envelope_xdr,
        resultXdr: response.result_xdr,
        resultMetaXdr: response.result_meta_xdr,
      };
    } catch (error) {
      return {
        status: 'NOT_FOUND',
        latestLedger: 0,
        latestLedgerCloseTime: new Date().toISOString(),
      };
    }
  }

  /**
   * getAccountInfo - Get account information
   * https://developers.stellar.org/docs/data/horizon/api-reference/resources/accounts/single
   *
   * This is Horizon's primary method for getting account data including ALL trustlines
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
    const response = await this.request<IAccountResponse>({
      method: 'GET',
      path: `/accounts/${address}`,
    });

    // Find native balance
    const nativeBalance =
      response.balances.find((b) => b.asset_type === 'native')?.balance || '0';

    const balances =
      response.balances?.map((b) => {
        if (
          SAC_TOKEN_ASSET_TYPES.includes(b.asset_type) ||
          b.asset_type === 'native'
        ) {
          const balance = new BigNumber(b.balance)
            .shiftedBy(SAC_TOKEN_DECIMALS)
            .toFixed(0);
          return {
            ...b,
            balance,
          };
        }
        return b;
      }) ?? [];

    console.log('====>getAccountInfo: balances: ', balances);
    return {
      balance: new BigNumber(nativeBalance)
        .shiftedBy(SAC_TOKEN_DECIMALS)
        .toFixed(0),
      sequence: response.sequence,
      subentry_count: response.subentry_count,
      balances,
    };
  }

  /**
   * getLedgerEntries - Not supported by Horizon API
   * This is a Soroban RPC specific method
   * Horizon uses REST endpoints for specific resources instead
   */
  async getLedgerEntries(
    _keys: string[],
    _xdrFormat?: 'base64' | 'json',
  ): Promise<{
    latestLedger: number;
    entries: Array<{
      key: string;
      xdr: string;
      lastModifiedLedgerSeq: number;
      liveUntilLedgerSeq?: number;
    }>;
  }> {
    throw new OneKeyInternalError(
      'getLedgerEntries is not supported by Horizon API. Use Soroban RPC (JsonRpcTransport) instead.',
    );
  }

  /**
   * simulateTransaction - Not supported by Horizon API
   * This is a Soroban RPC specific method for contract simulation
   */
  async simulateTransaction(_transaction: string): Promise<any> {
    throw new OneKeyInternalError(
      'simulateTransaction is only supported by Soroban RPC (JsonRpcTransport)',
    );
  }

  /**
   * getNetwork - Get network configuration
   * Derived from Horizon root endpoint
   */
  async getNetwork(): Promise<{
    friendbotUrl?: string;
    passphrase: string;
    protocolVersion: number;
  }> {
    const response = await this.request<IRootResponse>({
      method: 'GET',
      path: '/',
    });

    return {
      passphrase: response.network_passphrase,
      protocolVersion: response.current_protocol_version,
      friendbotUrl: response.network_passphrase.includes('Test')
        ? 'https://friendbot.stellar.org'
        : undefined,
    };
  }

  /**
   * getVersionInfo - Get Horizon server version
   */
  async getVersionInfo(): Promise<{
    version: string;
    commit_hash: string;
    build_timestamp: string;
    captive_core_version: string;
    protocol_version: number;
  }> {
    const response = await this.request<IRootResponse>({
      method: 'GET',
      path: '/',
    });

    return {
      version: response.horizon_version,
      commit_hash: '',
      build_timestamp: '',
      captive_core_version: response.core_version ?? '',
      protocol_version: response.current_protocol_version,
    };
  }

  /**
   * getEvents - Not supported by Horizon API
   * This is a Soroban RPC specific method for contract events
   */
  async getEvents(_params: {
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
    throw new OneKeyInternalError(
      'getEvents is only supported by Soroban RPC (JsonRpcTransport) for smart contract events',
    );
  }
}
